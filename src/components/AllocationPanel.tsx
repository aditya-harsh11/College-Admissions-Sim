import type { CSSProperties } from 'react';
import type { Criterion, Weights } from '../sim/types';

interface Props {
  criteria: Criterion[];
  weights: Weights;
  /** `auto` balances to 100 on every move; `manual` lets the total drift and shows a number field. */
  mode: 'auto' | 'manual';
  /** When true the rubric is committed: inputs disabled and the panel greys out. */
  locked: boolean;
  finalized: boolean;
  /**
   * Legacy gate (Sandbox): when `false`, the commit button is disabled until the budget hits 100.
   * Omit it (study flow) to keep the button always enabled — the parent validates on submit and
   * shows the "doesn't add to 100" popup instead.
   */
  canFinalize?: boolean;
  /** Primary-button label when ready to commit (study flow uses "Continue"). */
  ctaLabel?: string;
  /** Small label above the title. Pass null to hide it (the study flow has its own progress bar). */
  kicker?: string | null;
  onFinalize: () => void;
  onChange: (key: Criterion['key'], value: number) => void;
  /** Fired when a slider drag begins, so the parent can switch the donut to live mode + log it. */
  onDragStart: (key: Criterion['key']) => void;
}

/**
 * The rubric: one slider per criterion plus the live budget badge. In manual mode the
 * point value becomes a typeable field. Controls are intentionally monochrome (ink on
 * paper) — all the color in the piece is reserved for the demographic outcome on the right.
 */
export function AllocationPanel({
  criteria,
  weights,
  mode,
  locked,
  finalized,
  canFinalize,
  ctaLabel = 'Finalize rubric',
  kicker = 'Step 01',
  onFinalize,
  onChange,
  onDragStart,
}: Props) {
  const total = criteria.reduce((sum, c) => sum + weights[c.key], 0);
  const valid = total === 100;
  const manual = mode === 'manual';

  return (
    <section className={`panel rubric ${locked ? 'rubric--locked' : ''}`}>
      <header className="panel__head">
        <div>
          {kicker && <p className="panel__kicker">{kicker}</p>}
          <h2 className="panel__title">Your rubric</h2>
        </div>
        <div className={`budget ${valid ? '' : 'budget--invalid'}`}>
          <span className="budget__num">{total}</span>
          <span className="budget__den">/ 100 pts</span>
        </div>
      </header>

      <div className="sliders">
        {criteria.map((c) => {
          const v = weights[c.key];
          return (
            <label className="slider" key={c.key}>
              <div className="slider__top">
                <span className="slider__label">{c.label}</span>
                <span className="slider__chip">
                  {manual ? (
                    <input
                      type="number"
                      className="slider__num"
                      min={0}
                      max={100}
                      value={v}
                      disabled={locked}
                      onChange={(e) =>
                        onChange(c.key, e.target.value === '' ? 0 : Number(e.target.value))
                      }
                      aria-label={`${c.label} points`}
                    />
                  ) : (
                    <strong>{v}</strong>
                  )}
                  <em>pts</em>
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={v}
                disabled={locked}
                onChange={(e) => onChange(c.key, Number(e.target.value))}
                onPointerDown={() => onDragStart(c.key)}
                style={{ '--fill': `${v}%` } as CSSProperties}
                aria-label={c.label}
              />
              <span className="slider__blurb">{c.blurb}</span>
            </label>
          );
        })}
      </div>

      <div className="rubric__footer">
        {finalized ? (
          <span className="rubric__status">✓ Rubric finalized</span>
        ) : (
          <button
            className="btn btn--primary"
            disabled={locked || canFinalize === false}
            onClick={onFinalize}
          >
            {canFinalize === false ? 'Balance to 100 to finalize' : ctaLabel}
          </button>
        )}
      </div>
    </section>
  );
}
