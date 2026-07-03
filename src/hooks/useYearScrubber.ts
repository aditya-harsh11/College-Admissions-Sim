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

  // Stamp the entry time after mount (kept out of render so it stays pure).
  useEffect(() => {
    enteredAt.current = performance.now();
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
  };
}
