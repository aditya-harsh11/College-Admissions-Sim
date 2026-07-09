// ─────────────────────────────────────────────────────────────────────────────
// Refresh / reload persistence for the v6 study (the "cookies" item).
//
// A page refresh must NOT restart the study. We snapshot the whole session to localStorage on every
// change and rehydrate it on load, so a participant who reloads (or whose tab reloads) resumes
// exactly where they were — same participant id, condition, dataset, step, answers, and rubric.
//
// Cleared when the study completes so a reused browser starts a fresh participant. Skipped entirely
// in preview mode (?cond= / ?data=) so Randy's previews never read or clobber a real run.
// ─────────────────────────────────────────────────────────────────────────────

import type { Weights } from '../sim/types';
import type { Condition } from './demographics';

const KEY = 'ca-v6:session';

export interface SavedSession {
  participantId: string;
  condition: Condition;
  dataset: string;
  /** The current Step (kept as a string here so this module doesn't depend on ShiftStudy). */
  step: string;
  name: string;
  /** Race/ethnicity is now a check-all-that-apply list (07-09); `raceOther` holds the "Other" text. */
  raceSel: string[];
  raceOther: string;
  age: string;
  gender: string;
  income: string;
  consented: boolean;
  explored: boolean;
  weights: Weights;
}

export function loadSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(s: SavedSession): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // private mode / sandboxed iframe — best-effort, resume is a nicety not a requirement.
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // best-effort
  }
}
