// ─────────────────────────────────────────────────────────────────────────────
// Interaction logger (study requirement #8).
//
// Captures every participant action with a millisecond timestamp so we can
// reconstruct ORDER, DWELL TIME, and REVISIONS — not just the final rubric.
// Events buffer in memory; `saveResponse()` flushes the whole session.
//
// Storage lives behind ONE function (`saveResponse`): it POSTs the whole session to a Google Apps
// Script web app, which appends a WIDE row (one per participant: pre/post/delta + demographics) and
// LONG rows (one per logged event) to the Sheet. A localStorage copy is always kept as a backup.
// See google-apps-script.gs in the repo root for the script + deploy steps.
// ─────────────────────────────────────────────────────────────────────────────

export interface LoggedEvent {
  /** Milliseconds since the session started (monotonic, sub-ms precision). */
  elapsedMs: number;
  /** Wall-clock ISO timestamp. */
  timestamp: string;
  /** What happened (e.g. "weight_change", "page_enter"). */
  event: string;
  /** Event-specific fields become their own columns in the Events tab. */
  [key: string]: unknown;
}

const t0 = performance.now();
// A throwaway session id (no crypto dependency) — enough to key one participant's run.
const sessionId = `${Date.now().toString(36)}-${Math.floor(performance.now()).toString(36)}`;

const buffer: LoggedEvent[] = [];

/** Record one event. `event` is a short verb; `data` fields each become their own column. */
export function logEvent(event: string, data: Record<string, unknown> = {}): void {
  buffer.push({
    elapsedMs: Math.round((performance.now() - t0) * 1000) / 1000,
    timestamp: new Date().toISOString(),
    event,
    ...data,
  });
}

// ── Throttled logging ────────────────────────────────────────────────────────
// Dragging a slider fires an onChange per pixel — far too many rows. We SAMPLE
// high-frequency events to at most one per `ms` per key, but always keep a
// TRAILING flush so the final resting value is never dropped. (Randy 06-29:
// "log every 100ms" instead of ~every ms.)
interface ThrottleSlot {
  last: number;
  timer: ReturnType<typeof setTimeout> | null;
  pending: { event: string; data: Record<string, unknown> } | null;
}
const throttleSlots = new Map<string, ThrottleSlot>();

export function logEventThrottled(
  key: string,
  event: string,
  data: Record<string, unknown> = {},
  ms = 100,
): void {
  const now = performance.now();
  let slot = throttleSlots.get(key);
  if (!slot) {
    slot = { last: -Infinity, timer: null, pending: null };
    throttleSlots.set(key, slot);
  }
  const sinceLast = now - slot.last;
  if (sinceLast >= ms) {
    // Leading edge: enough time has passed, log immediately.
    slot.last = now;
    slot.pending = null;
    logEvent(event, data);
  } else {
    // Inside the window: stash the latest value and ensure a trailing flush fires.
    slot.pending = { event, data };
    if (!slot.timer) {
      slot.timer = setTimeout(() => {
        slot.timer = null;
        if (slot.pending) {
          slot.last = performance.now();
          logEvent(slot.pending.event, slot.pending.data);
          slot.pending = null;
        }
      }, ms - sinceLast);
    }
  }
}

/** A copy of the full event log so far. */
export function getEvents(): LoggedEvent[] {
  return buffer.slice();
}

// ── Per-trial path summary ───────────────────────────────────────────────────
// The "path" a participant takes on a slider is the interesting signal — e.g. dragging a criterion
// up to 93, then settling at 91. We track min/max/count for each (phase, criterion) on EVERY change,
// BEFORE the 100ms throttle, so a transient peak between log samples is never lost. The settled
// value (final) already lives in the `pre_`/`post_` wide columns, so we don't duplicate it here.
// (Randy 06-29: post-process the ms log into per-trial max/min.)
interface TrialAgg {
  min: number;
  max: number;
  /** Number of recorded moves on this slider — a revision/fidget count. */
  n: number;
}
const trials = new Map<string, TrialAgg>();

/** Fold one slider value into its (phase, criterion) running min/max/count. Call on every move. */
export function trackTrial(phase: string, criterion: string, value: number): void {
  const key = `${phase}:${criterion}`;
  const t = trials.get(key);
  if (!t) {
    trials.set(key, { min: value, max: value, n: 1 });
  } else {
    if (value < t.min) t.min = value;
    if (value > t.max) t.max = value;
    t.n += 1;
  }
}

/** Flatten the per-trial stats into wide columns, e.g. `pre_grades_min`, `post_testScore_n`. */
export function getTrialSummary(): Record<string, number> {
  const out: Record<string, number> = {};
  trials.forEach((t, key) => {
    const [phase, criterion] = key.split(':');
    out[`${phase}_${criterion}_min`] = t.min;
    out[`${phase}_${criterion}_max`] = t.max;
    out[`${phase}_${criterion}_n`] = t.n;
  });
  return out;
}

export function getSessionId(): string {
  return sessionId;
}

// Deployed Google Apps Script web-app URL (ends in /exec). SHARED with v6 — the same web app routes
// by the `study` field (see google-apps-script.gs): v4 rows land in the "v4 Responses" / "v4 Events"
// tabs (v4 sends no study code, so it's the default), v6 in its own tabs. Left blank → localStorage only.
const SHEET_ENDPOINT =
  'https://script.google.com/macros/s/AKfycby0gduaArnlUSS-XtCFxEaNuKP6khNBAxtrCs2KADomul7V62qULVfZHxXkerPPK9GRSg/exec';

// How many buffered events we've already shipped. Each save sends only the NEW events, so calling
// saveResponse once per page doesn't re-send the whole log every time. Advanced only as far as the
// events a successful POST actually carried — so a failed send retries them, and events logged WHILE
// a POST is in flight are picked up by the next flush (no gaps, no duplicates).
let sentEventCount = 0;

// Saves are serialized through this chain. Per-page saves + the final save can otherwise overlap on
// a slow network; without serialization two of them would slice the same `sentEventCount` range and
// append the same events twice. Chaining guarantees each flush sees the prior flush's advanced count.
let saveChain: Promise<void> = Promise.resolve();

/**
 * Flush the response to the Google Sheet: a WIDE row (`meta.wide`, MERGED into the one row for this
 * participant by name) plus any NEW events since the last flush. The Apps Script upserts the wide
 * row by `name` and appends events, so this is safe to call once per page — incomplete runs are
 * still captured (Randy 06-29). The columns are defined entirely by the caller. We always keep a
 * localStorage backup of the full session too.
 *
 * Pass `complete: true` on the final save so the row is stamped as a finished run.
 */
export function saveResponse(
  meta: { name?: string; wide?: Record<string, unknown>; complete?: boolean } = {},
): Promise<void> {
  saveChain = saveChain.then(() => flushOnce(meta));
  return saveChain;
}

async function flushOnce(meta: {
  name?: string;
  wide?: Record<string, unknown>;
  complete?: boolean;
}): Promise<void> {
  // Snapshot EXACTLY what this flush sends, before any await. Events appended during the POST are
  // beyond `toIndex`, so they belong to the next flush — never dropped, never double-sent.
  const fromIndex = sentEventCount;
  const toIndex = buffer.length;
  const newEvents = buffer.slice(fromIndex, toIndex);
  const payload = {
    name: meta.name ?? '',
    // Timing fields are added here so callers don't have to thread them through. `updatedAt` moves
    // with every save; `submittedAt` is only stamped on the final, completed save.
    wide: {
      updatedAt: new Date().toISOString(),
      durationMs: Math.round(performance.now() - t0),
      ...(meta.complete ? { submittedAt: new Date().toISOString(), complete: true } : {}),
      ...(meta.wide ?? {}),
    },
    events: newEvents,
  };

  const backupLocally = () => {
    try {
      // Back up the FULL session (all events), not just this flush, so localStorage is a complete
      // recovery copy even though the wire payload is incremental.
      localStorage.setItem(
        `response:${sessionId}`,
        JSON.stringify({ ...payload, events: getEvents() }),
      );
    } catch {
      // localStorage can throw in private mode / sandboxed iframes — best-effort.
    }
  };

  if (!SHEET_ENDPOINT) {
    backupLocally();
    console.warn('[saveResponse] no Google Sheet endpoint set — saved to localStorage only');
    return;
  }

  try {
    // Apps Script web apps accept a simple text/plain POST; `no-cors` lets the request through
    // without a readable (CORS-blocked) response — fine for fire-and-forget logging.
    await fetch(SHEET_ENDPOINT, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    // Advance only past the events this flush actually carried (not the live buffer length).
    sentEventCount = toIndex;
    backupLocally();
    console.info('[saveResponse] sent to Google Sheet', payload.name, `(+${newEvents.length} events)`);
  } catch (e) {
    backupLocally();
    console.warn('[saveResponse] send failed — saved to localStorage instead', e);
  }
}
