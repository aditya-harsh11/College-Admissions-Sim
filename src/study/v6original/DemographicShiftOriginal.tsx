/* eslint-disable react-hooks/refs -- archived pre-redesign v6 code, preserved verbatim (commit
   84a3b40); the current build reworked this `seen` ref into state. Do not "fix" — it must match
   the original for the ?build=original comparison. */
import { useRef, useState, type CSSProperties } from 'react';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber';
import { logEvent } from '../../lib/logger';
import { RACE_CATEGORIES, SCHOOL, UW_SERIES, YEARS, yearTotal } from './demographicsOriginal';

const fmt = (n: number) => n.toFixed(1);

/**
 * The experimental stimulus: the real undergraduate racial composition of UW–Madison,
 * scrubbed across 1999 → 2025. Segments resize and the headline counts as you move
 * through time, so the shift literally happens in front of the participant.
 * `onExplored` fires once every year has been viewed (used to gate Continue).
 */
export function DemographicShiftOriginal({ onExplored }: { onExplored?: () => void }) {
  const [yi, setYi] = useState(0);
  const seen = useRef(new Set<number>([0]));

  const setYear = (next: number) => {
    if (next === yi || next < 0 || next >= YEARS.length) return;
    setYi(next);
    if (!seen.current.has(next)) {
      seen.current.add(next);
      if (seen.current.size === YEARS.length) onExplored?.();
    }
    logEvent('demo_scrub', { year: YEARS[next] });
  };

  const total = yearTotal(yi);
  const whiteNow = useAnimatedNumber(UW_SERIES.white[yi]);
  const whiteDelta = UW_SERIES.white[yi] - UW_SERIES.white[0];

  return (
    <div className="shift">
      <div className="shift__head">
        <div>
          <p className="panel__kicker">{SCHOOL}</p>
          <h3 className="shift__title">Undergraduate composition, {YEARS[0]}–{YEARS[YEARS.length - 1]}</h3>
        </div>
        <div className="shift__headline">
          <span className="shift__big">{whiteNow.toFixed(1)}<span className="shift__pct">%</span></span>
          <span className="shift__cap">identify as White</span>
          {yi === 0 ? (
            <span className="delta delta--flat">earliest year on record</span>
          ) : (
            <span className={`delta ${whiteDelta < 0 ? 'delta--down' : 'delta--up'}`}>
              {whiteDelta > 0 ? '▲ +' : '▼ '}
              {fmt(Math.abs(whiteDelta))} pts since {YEARS[0]}
            </span>
          )}
        </div>
      </div>

      {/* The stacked bar - segments transition width as the year changes. */}
      <div className="shift__bar" role="img" aria-label={`Composition in ${YEARS[yi]}`}>
        {RACE_CATEGORIES.map((c) => {
          const v = UW_SERIES[c.key][yi] ?? 0;
          const w = total ? (v / total) * 100 : 0;
          return (
            <div
              key={c.key}
              className="shift__seg"
              style={{ width: `${w}%`, background: c.color } as CSSProperties}
              title={`${c.label}: ${fmt(v)}%`}
            >
              {w > 7 && <span className="shift__seglabel">{Math.round(v)}%</span>}
            </div>
          );
        })}
      </div>

      {/* Year scrubber. Four real snapshots; drag or click to move through time. */}
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

      {/* Legend with each group's current share and its change since the first year. */}
      <ul className="shift__legend">
        {RACE_CATEGORIES.map((c) => {
          const v = UW_SERIES[c.key][yi] ?? 0;
          const d = v - (UW_SERIES[c.key][0] ?? 0);
          const dCls = Math.abs(d) < 0.05 ? 'delta--flat' : d > 0 ? 'delta--up' : 'delta--down';
          return (
            <li key={c.key} className="shift__legrow">
              <span className="shift__swatch" style={{ background: c.color }} />
              <span className="shift__leglabel">{c.short}</span>
              <span className="shift__legpct">{fmt(v)}%</span>
              <span className={`delta ${dCls}`}>
                {d > 0.05 ? '▲ +' : d < -0.05 ? '▼ ' : '– '}
                {Math.abs(d) < 0.05 ? '' : fmt(Math.abs(d))}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="shift__source">Source: UW–Madison registrar / Common Data Set. Real figures.</p>
    </div>
  );
}
