import type { GroupSlice } from '../sim/types';

interface Props {
  admitted: GroupSlice[];
  pool: GroupSlice[];
}

/**
 * Legend doubling as the disparate-impact readout: each group's admitted share plus
 * its delta against the pool baseline (over-/under-represented vs. who applied).
 */
export function Legend({ admitted, pool }: Props) {
  const poolById = new Map(pool.map((p) => [p.groupId, p.pct]));

  return (
    <ul className="legend">
      {admitted.map((s) => {
        const base = poolById.get(s.groupId) ?? 0;
        const delta = s.pct - base;
        const rounded = Math.round(delta);
        const dir = rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat';
        return (
          <li className="legend__row" key={s.groupId}>
            <span className="legend__swatch" style={{ background: s.color }} />
            <span className="legend__label">{s.label}</span>
            <span className="legend__pct">{Math.round(s.pct)}%</span>
            <span className={`delta delta--${dir}`}>
              {dir === 'up' ? '▲' : dir === 'down' ? '▼' : '—'}
              {rounded !== 0 && Math.abs(rounded)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
