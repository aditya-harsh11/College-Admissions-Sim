import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import type { GroupSlice } from '../sim/types';

interface Props {
  data: GroupSlice[];
  classSize: number;
}

/**
 * Donut of the admitted-class demographics. Slice count is held constant (groups that
 * fall to 0% shrink to nothing rather than disappearing) so Recharts morphs smoothly
 * between weightings instead of jumping.
 */
export function Donut({ data, classSize }: Props) {
  return (
    <div className="donut">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="pct"
            nameKey="label"
            innerRadius="64%"
            outerRadius="98%"
            startAngle={90}
            endAngle={-270}
            paddingAngle={1}
            stroke="none"
            isAnimationActive
            animationDuration={450}
            animationEasing="ease-out"
          >
            {data.map((s) => (
              <Cell key={s.groupId} fill={s.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="donut__center">
        <span className="donut__num">{classSize}</span>
        <span className="donut__cap">admitted</span>
      </div>
    </div>
  );
}
