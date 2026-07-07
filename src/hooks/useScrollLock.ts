import { useEffect, useRef } from 'react';

interface Scrubber {
  index: number;
  allSeen: boolean;
  setYear: (i: number) => void;
}

/**
 * Demo "scroll-to-advance" lock (Ben 07-06 "idiot-proof" idea). When `enabled`, the page LOCKS on the
 * widget once the reader has scrolled the WHOLE chart into view (its bottom — the source line — has
 * reached the viewport): while not every year has been seen, wheeling then steps the YEAR instead of
 * moving the page. Once all years are seen it releases and the page scrolls normally. Attach the
 * returned ref to the widget root. Toggled from ShiftStudy so the lab can compare this against the
 * plain click/scrub version.
 *
 * A non-passive window `wheel` listener does the locking (preventDefault + step). We gate on the
 * widget's live bounding rect (bottom in view) rather than an IntersectionObserver ratio, which is
 * unreliable when the widget is near/over the viewport height. Scrub values are read through refs so
 * the single listener always sees the latest year / allSeen.
 */
export function useScrollLock(enabled: boolean, scrub: Scrubber, yearCount: number) {
  const ref = useRef<HTMLDivElement>(null);
  const idxRef = useRef(scrub.index);
  const allSeenRef = useRef(scrub.allSeen);
  const setYearRef = useRef(scrub.setYear);

  // Keep refs current after every render (updating refs in an effect, not during render).
  useEffect(() => {
    idxRef.current = scrub.index;
    allSeenRef.current = scrub.allSeen;
    setYearRef.current = scrub.setYear;
  });

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;

    let accum = 0;
    const STEP = 60; // wheel delta to advance one year (one firm notch / a few trackpad ticks)

    const onWheel = (e: WheelEvent) => {
      if (allSeenRef.current) return; // all years seen → released, page scrolls normally
      const rect = el.getBoundingClientRect();
      // Lock only once the WHOLE widget has scrolled into view — i.e. its bottom (the source line)
      // has reached the viewport. So the reader scrolls down and sees the full chart first, THEN the
      // page freezes to step the years (rather than locking the moment the top crosses mid-screen).
      if (rect.bottom > window.innerHeight) return;
      e.preventDefault();
      accum += e.deltaY;
      if (accum >= STEP) {
        accum = 0;
        setYearRef.current(Math.min(idxRef.current + 1, yearCount - 1));
      } else if (accum <= -STEP) {
        accum = 0;
        setYearRef.current(Math.max(idxRef.current - 1, 0));
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [enabled, yearCount]);

  return ref;
}
