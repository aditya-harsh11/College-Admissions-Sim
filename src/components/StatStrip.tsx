import { useAnimatedNumber } from '../hooks/useAnimatedNumber';

interface StatProps {
  caption: string;
  value: number;
  suffix?: string;
  baseline: number;
  /** How many decimals to show. */
  decimals?: number;
}

function Stat({ caption, value, suffix = '', baseline, decimals = 0 }: StatProps) {
  const shown = useAnimatedNumber(value);
  const delta = value - baseline;
  const rounded = Math.round(delta * (decimals ? 10 ** decimals : 1)) / (decimals ? 10 ** decimals : 1);
  const dir = rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat';

  return (
    <div className="stat">
      <span className="stat__cap">{caption}</span>
      <span className="stat__val">
        {shown.toFixed(decimals)}
        <span className="stat__suffix">{suffix}</span>
      </span>
      <span className={`delta delta--${dir}`}>
        {dir === 'up' ? '▲' : dir === 'down' ? '▼' : '—'}
        {rounded !== 0 && `${Math.abs(rounded).toFixed(decimals)} vs pool`}
        {rounded === 0 && 'even with pool'}
      </span>
    </div>
  );
}

interface Props {
  firstGenPct: number;
  poolFirstGenPct: number;
  avgTestIndex: number;
  poolTestIndex: number;
}

/** Two animated headline numbers that tick as the rubric changes. */
export function StatStrip({ firstGenPct, poolFirstGenPct, avgTestIndex, poolTestIndex }: Props) {
  return (
    <div className="statstrip">
      <Stat
        caption="First-gen share"
        value={firstGenPct}
        suffix="%"
        baseline={poolFirstGenPct}
      />
      <Stat caption="Avg test score" value={avgTestIndex} baseline={poolTestIndex} />
    </div>
  );
}
