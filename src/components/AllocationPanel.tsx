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
  /** Only allow committing when the budget is exactly spent (total === 100). */
  canFinalize: boolean;
  /** Render the in-panel Finalize footer. False when finalize lives in its own Step 03 section. */
  showFinalize?: boolean;
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
  showFinalize = true,
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
          <p className="panel__kicker">Step 01</p>
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

      {showFinalize && (
        <div className="rubric__footer">
          {finalized ? (
            <span className="rubric__status">✓ Rubric finalized</span>
          ) : (
            <button className="btn btn--primary" disabled={!canFinalize} onClick={onFinalize}>
              {canFinalize ? 'Finalize rubric' : 'Balance to 100 to finalize'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
