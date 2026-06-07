import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import type { GroupSlice } from '../sim/types';

interface Props {
  data: GroupSlice[];
  classSize: number;
  /**
   * When false (e.g. while a slider is actively being dragged) the pie redraws instantly
   * on every change so it tracks the drag live. When true it plays its morph tween — nice
   * for preset clicks and the settle on release.
   */
  animate: boolean;
}

/**
 * Donut of the admitted-class demographics. Slice count is held constant (groups that
 * fall to 0% shrink to nothing rather than disappearing) so Recharts morphs smoothly
 * between weightings instead of jumping.
 */
export function Donut({ data, classSize, animate }: Props) {
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
            isAnimationActive={animate}
            animationDuration={420}
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
