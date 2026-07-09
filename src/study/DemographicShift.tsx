import { type CSSProperties } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import { useScrollLock } from '../hooks/useScrollLock';
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
  advanceMode = 'click',
  chartMode = 'bar',
}: {
  dataset: DemographicDataset;
  onExplored?: () => void;
  /** Demo toggle: how the reader steps years — 'click' chips, 'scroll'-lock, or 'next' Prev/Next. */
  advanceMode?: 'click' | 'scroll' | 'next';
  /** Demo toggle: draw the composition as a stacked bar (default) or a pie (Randy's idea). */
  chartMode?: 'bar' | 'pie';
}) {
  const { years, series, focus } = dataset;
  const scrub = useYearScrubber(years, 'demo', onExplored);
  const yi = scrub.index;
  const scrollLock = advanceMode === 'scroll';

  const cats = activeCategories(dataset);
  const total = yearTotal(dataset, yi);

  // Rank the groups by their share in the current year → each row's vertical slot.
  const ranked = [...cats].sort((a, b) => (series[b.key][yi] ?? 0) - (series[a.key][yi] ?? 0));
  const rankOf = new Map(ranked.map((c, r) => [c.key, r]));

  const focusCat = cats.find((c) => c.key === focus) ?? cats[0];
  const focusNow = useAnimatedNumber(series[focus][yi] ?? 0);
  const focusDelta = (series[focus][yi] ?? 0) - (series[focus][0] ?? 0);

  const lockRef = useScrollLock(scrollLock, scrub, years.length);

  return (
    <div className={`shift ${scrollLock && !scrub.allSeen ? 'shift--locked' : ''}`} ref={lockRef}>
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

      {/* Composition: a stacked bar (default) or, via the demo toggle, a pie (Randy's idea). Both
          ease to the new year's shares. */}
      {chartMode === 'pie' ? (
        <div className="shift__pie" role="img" aria-label={`Composition in ${years[yi]}`}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={cats.map((c) => ({ name: c.short, value: series[c.key][yi] ?? 0, color: c.color }))}
                dataKey="value"
                nameKey="name"
                outerRadius="94%"
                startAngle={90}
                endAngle={-270}
                paddingAngle={1}
                stroke="var(--panel)"
                strokeWidth={2}
                isAnimationActive
                animationDuration={420}
                animationEasing="ease-out"
              >
                {cats.map((c) => (
                  <Cell key={c.key} fill={c.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
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
      )}

      {/* Scroll-lock demo hint: shown while the page is locked on the widget (Ben's idiot-proof idea). */}
      {scrollLock && !scrub.allSeen && (
        <p className="shift__lockhint">Scroll to move through the years — the page unlocks once you’ve seen them all.</p>
      )}

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
        nav={
          advanceMode === 'next'
            ? {
                onPrev: scrub.prev,
                onNext: scrub.next,
                prevDisabled: scrub.cooling || scrub.atStart,
                nextDisabled: scrub.cooling || scrub.atEnd,
              }
            : undefined
        }
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
