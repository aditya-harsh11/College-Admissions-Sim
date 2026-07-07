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

/** A copy of the full event log so far. */
export function getEvents(): LoggedEvent[] {
  return buffer.slice();
}

export function getSessionId(): string {
  return sessionId;
}

// Deployed Google Apps Script web-app URL (ends in /exec). SHARED with v4 — the same web app now
// routes by the `study` field in `wide` (see google-apps-script.gs): v6 rows land in the "v6
// Responses" / "v6 Events" tabs, v4 in "v4 Responses" / "v4 Events". Left blank → responses are kept
// in localStorage only, so nothing is lost.
const SHEET_ENDPOINT =
  'https://script.google.com/macros/s/AKfycbzUQ8Ikw4XCOXcxEvvZnzsuVNIvhXWAD2gbqTAxErd8K-JEpCWRK_zxBgsYDZmyF4AnOQ/exec';

// How many buffered events we've already shipped. Each save sends only the NEW events, so calling
// saveResponse once per page (v6 saves on every step) doesn't re-send the whole log and duplicate
// rows in the Events tab. Advanced only as far as a successful POST actually carried, so a failed
// send retries them and events logged mid-POST are picked up by the next flush (no gaps/dupes).
let sentEventCount = 0;

// Saves are serialized through this chain. Per-page saves + the final save can otherwise overlap on
// a slow network; without serialization two of them would slice the same `sentEventCount` range and
// append the same events twice. Chaining guarantees each flush sees the prior flush's advanced count.
let saveChain: Promise<void> = Promise.resolve();

/**
 * Flush the response to the Google Sheet: a WIDE row (`meta.wide`, upserted into the one row for this
 * participant) plus any NEW events since the last flush. The Apps Script writes whatever columns
 * `wide` contains, so the saved columns are defined entirely by the caller. Safe to call once per
 * page — incomplete/abandoned runs are still captured. We always keep a localStorage backup too.
 */
export function saveResponse(
  meta: { id?: string; name?: string; wide?: Record<string, unknown>; complete?: boolean } = {},
): Promise<void> {
  saveChain = saveChain.then(() => flushOnce(meta));
  return saveChain;
}

async function flushOnce(meta: {
  id?: string;
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
    // The app DECLARES how the (generic) Apps Script should store this row, so renaming a column
    // never needs a script redeploy again:
    //   • keyCol — the WIDE column to UPSERT this participant's single row by (v6 = the `id` code).
    //   • tag    — columns prepended to EVERY event row, in order: `id` first, then `name`.
    keyCol: 'id',
    tag: { id: meta.id ?? '', name: meta.name ?? '' },
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
    console.info('[saveResponse] sent to Google Sheet', payload.tag.id, `(+${newEvents.length} events)`);
  } catch (e) {
    backupLocally();
    console.warn('[saveResponse] send failed — saved to localStorage instead', e);
  }
}
