import { type CSSProperties } from 'react';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import {
  activeCategories,
  describeShift,
  yearTotal,
  type DemographicDataset,
} from './demographics';
import { useYearScrubber } from '../hooks/useYearScrubber';
import { YearStepper } from './YearStepper';

const fmt = (n: number) => n.toFixed(1);
/** Height of one legend row, in px — the ranked rows glide between these slots. */
const ROW = 40;

/**
 * The experimental stimulus: the real undergraduate racial composition of a university, scrubbed
 * across four snapshots. The stacked bar resizes, the headline % rolls, and the legend rows
 * physically re-rank as you move through time, so the shift literally happens in front of the
 * participant. `onExplored` fires once every year has been viewed (gates Continue).
 *
 * 07-03 asks baked in: the shifting % and the YEAR are shown together with the year moved DOWN,
 * front-and-center under the bar so it can't be skimmed past (item 4); groups animate up/down in
 * rank (item 5) with a one-line summary once all years are seen; the source line is plain,
 * non-clickable text (item 10).
 */
export function DemographicShift({
  dataset,
  onExplored,
}: {
  dataset: DemographicDataset;
  onExplored?: () => void;
}) {
  const { years, series, focus } = dataset;
  const scrub = useYearScrubber(years, 'demo', onExplored);
  const yi = scrub.index;

  const cats = activeCategories(dataset);
  const total = yearTotal(dataset, yi);

  // Rank the groups by their share in the current year → each row's vertical slot.
  const ranked = [...cats].sort((a, b) => (series[b.key][yi] ?? 0) - (series[a.key][yi] ?? 0));
  const rankOf = new Map(ranked.map((c, r) => [c.key, r]));

  const focusCat = cats.find((c) => c.key === focus) ?? cats[0];
  const focusNow = useAnimatedNumber(series[focus][yi] ?? 0);
  const focusDelta = (series[focus][yi] ?? 0) - (series[focus][0] ?? 0);

  return (
    <div className="shift">
      <div className="shift__head">
        <p className="panel__kicker">{dataset.scope}</p>
        <h3 className="shift__title">
          {dataset.title}, {years[0]}–{years[years.length - 1]}
        </h3>
      </div>

      {/* Prominent headline: the shifting % of the focus group, kept large (item 4). */}
      <div className="shift__stat">
        <span className="shift__big">
          {focusNow.toFixed(1)}
          <span className="shift__pct">%</span>
        </span>
        <span className="shift__statmeta">
          <span className="shift__cap">identify as {focusCat.short}</span>
          {yi === 0 ? (
            <span className="delta delta--flat">earliest year on record</span>
          ) : (
            <span className={`delta ${focusDelta < 0 ? 'delta--down' : 'delta--up'}`}>
              {focusDelta > 0 ? '▲ +' : '▼ '}
              {fmt(Math.abs(focusDelta))} pts since {years[0]}
            </span>
          )}
        </span>
      </div>

      {/* The stacked bar — segments ease to their new width as the year changes. */}
      <div className="shift__bar" role="img" aria-label={`Composition in ${years[yi]}`}>
        {cats.map((c) => {
          const v = series[c.key][yi] ?? 0;
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

      {/* The YEAR, moved DOWN and made big so participants are forced to see it (item 4). */}
      <div className="shift__yearband">
        <span className="shift__yearbig">{years[yi]}</span>
        <span className="shift__yearcap">
          step {yi + 1} of {years.length}
        </span>
      </div>

      <YearStepper
        years={years}
        index={scrub.index}
        seen={scrub.seen}
        onSetYear={scrub.setYear}
      />

      {/* Ranked legend — rows physically re-order (glide) as groups rise and fall (item 5). */}
      <ul className="shift__legend" style={{ height: cats.length * ROW } as CSSProperties}>
        {cats.map((c) => {
          const v = series[c.key][yi] ?? 0;
          const d = v - (series[c.key][0] ?? 0);
          const prev = yi > 0 ? v - (series[c.key][yi - 1] ?? 0) : 0;
          const dCls = Math.abs(d) < 0.05 ? 'delta--flat' : d > 0 ? 'delta--up' : 'delta--down';
          const trend = prev > 0.05 ? '▲' : prev < -0.05 ? '▼' : '–';
          return (
            <li
              key={c.key}
              className="shift__legrow"
              style={{ transform: `translateY(${(rankOf.get(c.key) ?? 0) * ROW}px)` } as CSSProperties}
            >
              <span className="shift__legtrend" aria-hidden>
                {trend}
              </span>
              <span className="shift__swatch" style={{ background: c.color }} />
              <span className="shift__leglabel">{c.short}</span>
              <span className="shift__legpct">{fmt(v)}%</span>
              <span className={`delta ${dCls}`}>
                {d > 0.05 ? '+' : d < -0.05 ? '−' : ''}
                {Math.abs(d) < 0.05 ? '–' : fmt(Math.abs(d))}
              </span>
            </li>
          );
        })}
      </ul>

      {/* One-line summary of the whole shift, revealed once every year has been viewed (item 5). */}
      {scrub.allSeen && <p className="shift__summary">{describeShift(dataset)}</p>}

      {/* Real data, but a plain non-clickable line — don't advertise "clickability" (item 10). */}
      <p className="shift__source">{dataset.source}</p>
    </div>
  );
}
