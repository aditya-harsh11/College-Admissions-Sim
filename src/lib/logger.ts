// ─────────────────────────────────────────────────────────────────────────────
// Interaction logger (study requirement #8).
//
// Captures every participant action with a millisecond timestamp so we can
// reconstruct ORDER, DWELL TIME, and REVISIONS — not just the final rubric.
// Events buffer in memory; `saveResponse()` flushes the whole session.
//
// Storage is deliberately behind ONE function (`flush`) so we can swap the
// current console/localStorage sink for a Google Sheet (Apps Script POST) later
// without touching any call site. (DEV_NOTES Plan A/B.)
// ─────────────────────────────────────────────────────────────────────────────

export interface LoggedEvent {
  /** Milliseconds since session start (monotonic, sub-ms precision). */
  t: number;
  /** Wall-clock ISO timestamp. */
  ts: string;
  type: string;
  [key: string]: unknown;
}

const t0 = performance.now();
// A throwaway session id (no crypto dependency) — enough to key one participant's run.
const sessionId = `${Date.now().toString(36)}-${Math.floor(performance.now()).toString(36)}`;

const buffer: LoggedEvent[] = [];

/** Record one event. `type` is a short verb; `data` is any structured payload. */
export function logEvent(type: string, data: Record<string, unknown> = {}): void {
  buffer.push({
    t: Math.round((performance.now() - t0) * 1000) / 1000,
    ts: new Date().toISOString(),
    type,
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

/**
 * Flush the full response (final state + every logged event). Swap the body for a
 * `fetch()` POST to a Google Apps Script endpoint when we wire up the Sheet — the
 * call sites (e.g. handleFinalize) don't change.
 */
export async function saveResponse(meta: Record<string, unknown> = {}): Promise<void> {
  const payload = {
    sessionId,
    savedAt: new Date().toISOString(),
    durationMs: Math.round(performance.now() - t0),
    ...meta,
    events: getEvents(),
  };

  // Store in the local responses database (server/server.mjs → data/responses.db). If the server
  // isn't running (e.g. the static hub build), fall back to localStorage so nothing is lost.
  try {
    const r = await fetch('/api/response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(`bad status ${r.status}`);
    console.info('[saveResponse] stored in database', payload.sessionId);
  } catch (e) {
    try {
      localStorage.setItem(`response:${sessionId}`, JSON.stringify(payload));
    } catch {
      // localStorage can throw in private mode / sandboxed iframes — logging is best-effort.
    }
    console.warn('[saveResponse] database unavailable — saved to localStorage instead', e);
  }
}
