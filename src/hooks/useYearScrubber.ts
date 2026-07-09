import { useEffect, useRef, useState } from 'react';
import { logEvent } from '../lib/logger';

/**
 * Shared year-scrubbing logic for both v6 condition widgets (demographics + process), so the two
 * stay behaviorally identical (07-03 item 6). Owns the current year index and which years have been
 * viewed, and — crucially — logs the DWELL TIME on each year as the participant steps off it
 * (07-03 item 3: reading speed varies, so we record that they actually saw each step). Fires
 * `onExplored` once every year has been seen.
 */
export function useYearScrubber(
  years: readonly number[],
  eventKey: string,
  onExplored?: () => void,
) {
  const [index, setIndex] = useState(0);
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]));
  const enteredAt = useRef(0);
  const firedExplored = useRef(false);

  // Short enforced pause between Next/Prev steps (07-09: so people can't blitz past the years).
  // NOT applied to chip/scrub jumps, which stay instant for side-by-side comparison.
  const [cooling, setCooling] = useState(false);
  const coolTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const PAUSE_MS = 800;

  // Stamp the entry time after mount (kept out of render so it stays pure).
  useEffect(() => {
    enteredAt.current = performance.now();
    return () => {
      if (coolTimer.current) clearTimeout(coolTimer.current);
    };
  }, []);

  const setYear = (next: number) => {
    if (next < 0 || next >= years.length || next === index) return;
    const now = performance.now();
    const from = enteredAt.current || now;
    // dwellMs = how long they lingered on the year they're leaving.
    logEvent(`${eventKey}_step`, {
      fromYear: years[index],
      toYear: years[next],
      dwellMs: Math.round(now - from),
    });
    enteredAt.current = now;
    setIndex(next);
    setSeen((prev) => {
      if (prev.has(next)) return prev;
      const nextSet = new Set(prev);
      nextSet.add(next);
      return nextSet;
    });
  };

  // Paced one-step move for the Next/Prev buttons: advances, then briefly locks the buttons so each
  // year stays on screen for a moment. Chip clicks bypass this (they call setYear directly).
  const stepBy = (dir: number) => {
    if (cooling) return;
    const target = index + dir;
    if (target < 0 || target >= years.length) return;
    setYear(target);
    setCooling(true);
    if (coolTimer.current) clearTimeout(coolTimer.current);
    coolTimer.current = setTimeout(() => setCooling(false), PAUSE_MS);
  };

  useEffect(() => {
    if (!firedExplored.current && seen.size === years.length) {
      firedExplored.current = true;
      onExplored?.();
    }
  }, [seen, years.length, onExplored]);

  return {
    index,
    seen,
    allSeen: seen.size === years.length,
    setYear,
    next: () => stepBy(1),
    prev: () => stepBy(-1),
    cooling,
    atStart: index === 0,
    atEnd: index === years.length - 1,
  };
}
