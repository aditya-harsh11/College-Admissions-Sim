import { type CSSProperties } from 'react';

/**
 * Presentational year scrubber: a range track plus one clickable chip per snapshot year. Moving it
 * (drag, or click a year) still logs the dwell time between steps (07-03 item 3). Identical chrome
 * for both v6 conditions. Driven by `useYearScrubber` (see hooks/useYearScrubber.ts).
 */
export function YearStepper({
  years,
  index,
  seen,
  onSetYear,
}: {
  years: readonly number[];
  index: number;
  seen: Set<number>;
  onSetYear: (i: number) => void;
}) {
  return (
    <div className="stepper">
      <div className="stepper__scrub">
        <input
          type="range"
          className="shift__range"
          min={0}
          max={years.length - 1}
          step={1}
          value={index}
          onChange={(e) => onSetYear(Number(e.target.value))}
          style={{ '--fill': `${(index / (years.length - 1)) * 100}%` } as CSSProperties}
          aria-label="Year"
        />
        <div className="shift__years">
          {years.map((y, i) => (
            <button
              key={y}
              className={`shift__year ${i === index ? 'shift__year--on' : ''} ${
                seen.has(i) ? 'shift__year--seen' : ''
              }`}
              onClick={() => onSetYear(i)}
            >
              {y}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
