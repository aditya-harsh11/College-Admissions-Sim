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
  [key: string]: unknown;
}

const t0 = performance.now();
// A throwaway session id (no crypto dependency) — enough to key one participant's run.
const sessionId = `${Date.now().toString(36)}-${Math.floor(performance.now()).toString(36)}`;

const buffer: LoggedEvent[] = [];

/** Record one event. `event` is a short verb; `data` is any structured payload. */
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

// Deployed Google Apps Script web-app URL (ends in /exec). Paste yours here once deployed (see
// google-apps-script.gs). Left blank → responses are kept in localStorage only, so nothing is lost.
const SHEET_ENDPOINT =
  'https://script.google.com/macros/s/AKfycbyIAKvEHSA6mj-VKBlrRCl1sJmXZ0GJ1jy8L9TGyvFBV4V6ILC7Ai6wXTAI725g9N3lzg/exec';

/**
 * Flush the response to the Google Sheet: a WIDE row (`meta.wide`, one per participant) plus the
 * LONG event log. The Apps Script writes whatever columns `wide` contains, so the saved columns are
 * defined entirely by the caller. We always keep a localStorage backup too.
 */
export async function saveResponse(
  meta: { name?: string; wide?: Record<string, unknown> } = {},
): Promise<void> {
  const payload = {
    name: meta.name ?? '',
    // Timing fields are added here so callers don't have to thread them through.
    wide: {
      submittedAt: new Date().toISOString(),
      durationMs: Math.round(performance.now() - t0),
      ...(meta.wide ?? {}),
    },
    events: getEvents(),
  };

  const backupLocally = () => {
    try {
      localStorage.setItem(`response:${sessionId}`, JSON.stringify(payload));
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
    backupLocally();
    console.info('[saveResponse] sent to Google Sheet', payload.name);
  } catch (e) {
    backupLocally();
    console.warn('[saveResponse] send failed — saved to localStorage instead', e);
  }
}
