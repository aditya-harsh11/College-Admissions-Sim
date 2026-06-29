import { useRef, useState, type CSSProperties } from 'react';
import { logEvent } from '../lib/logger';
import { PROCESS_STEPS, SCHOOL, YEARS } from './demographics';

/**
 * The control stimulus: how the admissions PROCESS changed over the same 1999 → 2025 span.
 * Same year scrubber and "things change over time" framing as the demographic visual, but the
 * content is process (not who attends) - so it isolates the demographic reveal. `onExplored`
 * fires once every year has been viewed.
 */
export function ProcessTimeline({ onExplored }: { onExplored?: () => void }) {
  const [yi, setYi] = useState(0);
  const seen = useRef(new Set<number>([0]));

  const setYear = (next: number) => {
    if (next === yi || next < 0 || next >= YEARS.length) return;
    setYi(next);
    if (!seen.current.has(next)) {
      seen.current.add(next);
      if (seen.current.size === YEARS.length) onExplored?.();
    }
    logEvent('process_scrub', { year: YEARS[next] });
  };

  const step = PROCESS_STEPS[yi];

  return (
    <div className="shift">
      <div className="shift__head">
        <div>
          <p className="panel__kicker">{SCHOOL}</p>
          <h3 className="shift__title">The admissions process, {YEARS[0]}–{YEARS[YEARS.length - 1]}</h3>
        </div>
        <span className="shift__bigyear">{YEARS[yi]}</span>
      </div>

      {/* The process snapshot for the selected year. */}
      <div className="process__card" key={yi}>
        <h4 className="process__head">{step.head}</h4>
        <p className="process__body">{step.body}</p>
      </div>

      <div className="shift__scrub">
        <input
          type="range"
          className="shift__range"
          min={0}
          max={YEARS.length - 1}
          step={1}
          value={yi}
          onChange={(e) => setYear(Number(e.target.value))}
          style={{ '--fill': `${(yi / (YEARS.length - 1)) * 100}%` } as CSSProperties}
          aria-label="Year"
        />
        <div className="shift__years">
          {YEARS.map((y, i) => (
            <button
              key={y}
              className={`shift__year ${i === yi ? 'shift__year--on' : ''} ${
                seen.current.has(i) ? 'shift__year--seen' : ''
              }`}
              onClick={() => setYear(i)}
            >
              {y}
            </button>
          ))}
        </div>
      </div>
      <p className="shift__source">A general timeline of U.S. college admissions.</p>
    </div>
  );
}
