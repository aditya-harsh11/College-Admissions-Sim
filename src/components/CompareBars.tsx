import type { GroupSlice } from '../sim/types';

interface Props {
  pool: GroupSlice[];
  admitted: GroupSlice[];
}

function StackBar({ slices }: { slices: GroupSlice[] }) {
  return (
    <div className="stack">
      {slices.map((s) => (
        <div
          key={s.groupId}
          className="stack__seg"
          style={{ width: `${s.pct}%`, background: s.color }}
          title={`${s.label}: ${Math.round(s.pct)}%`}
        >
          {s.pct >= 9 && <span className="stack__pct">{Math.round(s.pct)}</span>}
        </div>
      ))}
    </div>
  );
}

/**
 * The headline comparison: who applied vs. who got in. Segment widths transition via
 * CSS, so the two bars visibly "pull apart" as the rubric changes — the clearest way
 * to show a neutral-looking rubric producing a skewed class.
 */
export function CompareBars({ pool, admitted }: Props) {
  return (
    <div className="compare">
      <div className="compare__row">
        <span className="compare__tag">Applicant pool</span>
        <StackBar slices={pool} />
      </div>
      <div className="compare__row">
        <span className="compare__tag compare__tag--accent">Admitted class</span>
        <StackBar slices={admitted} />
      </div>
    </div>
  );
}
