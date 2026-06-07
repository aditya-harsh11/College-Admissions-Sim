import type { CSSProperties } from 'react';
import type { Criterion, Weights } from '../sim/types';

interface Props {
  criteria: Criterion[];
  weights: Weights;
  onChange: (key: Criterion['key'], value: number) => void;
  /** Fired when a slider drag begins, so the parent can switch the donut to live mode. */
  onDragStart: () => void;
}

/**
 * The rubric: one auto-balancing slider per criterion plus the live budget badge.
 * Controls are intentionally monochrome (ink on paper) — all the color in the piece
 * is reserved for the demographic outcome on the right.
 */
export function AllocationPanel({ criteria, weights, onChange, onDragStart }: Props) {
  const total = criteria.reduce((sum, c) => sum + weights[c.key], 0);
  const valid = total === 100;

  return (
    <section className="panel rubric">
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
                  <strong>{v}</strong>
                  <em>pts</em>
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={v}
                onChange={(e) => onChange(c.key, Number(e.target.value))}
                onPointerDown={onDragStart}
                style={{ '--fill': `${v}%` } as CSSProperties}
                aria-label={c.label}
              />
              <span className="slider__blurb">{c.blurb}</span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
