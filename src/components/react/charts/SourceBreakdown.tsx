//Gold-source breakdown — you vs cohort per source (lane creeps, neutrals, …) as
//grouped horizontal bars. Recharts BarChart (vertical layout); theme-aware.
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import {
  axisTick,
  type ChartFmtValue,
  gridStroke,
  seriesColor,
  tooltipContentStyle,
  tooltipItemStyle,
  tooltipLabelStyle,
} from './chartTheme';

export interface SourceDatum {
  source: string;
  you: number;
  cohort: number;
}

interface SourceBreakdownProps {
  data: SourceDatum[];
  height?: number;
}

const fmtK = (v: ChartFmtValue) => (typeof v === 'number' ? `${(v / 1000).toFixed(1)}k` : String(v ?? ''));

export default function SourceBreakdown({ data, height = 260 }: SourceBreakdownProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }} barGap={2}>
        <CartesianGrid stroke={gridStroke} strokeOpacity={0.5} horizontal={false} />
        <XAxis type="number" tick={axisTick} tickLine={false} axisLine={{ stroke: gridStroke }} tickFormatter={fmtK} />
        <YAxis
          type="category"
          dataKey="source"
          tick={{ fill: 'var(--text-2)', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={92}
        />
        <Tooltip
          cursor={{ fill: 'var(--overlay)', opacity: 0.35 }}
          contentStyle={tooltipContentStyle}
          labelStyle={tooltipLabelStyle}
          itemStyle={tooltipItemStyle}
          formatter={fmtK}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: 'var(--muted)' }} />
        <Bar name="You" dataKey="you" fill={seriesColor.you} radius={[0, 3, 3, 0]} maxBarSize={11} />
        <Bar name="Tier" dataKey="cohort" fill={seriesColor.cohort} fillOpacity={0.55} radius={[0, 3, 3, 0]} maxBarSize={11} />
      </BarChart>
    </ResponsiveContainer>
  );
}
