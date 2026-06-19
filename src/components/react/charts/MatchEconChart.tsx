//Match net-worth lead over time — diverging area around zero: amber team lead
//above the axis, sapphire team lead below. The fill gradient switches color at
//the zero crossing. Recharts AreaChart; theme-aware.
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import {
  axisTick,
  type ChartFmtValue,
  gridStroke,
  seriesColor,
  tooltipContentStyle,
  tooltipItemStyle,
  tooltipLabelStyle,
} from './chartTheme';

export interface MatchEconPoint {
  //sample index / minute
  t: number;
  //net-worth lead in k souls; >0 = amber ahead, <0 = sapphire ahead
  lead: number;
}

interface MatchEconChartProps {
  data: MatchEconPoint[];
  height?: number;
}

export default function MatchEconChart({ data, height = 240 }: MatchEconChartProps) {
  const leads = data.map((d) => d.lead);
  const max = leads.length ? Math.max(...leads) : 1;
  const min = leads.length ? Math.min(...leads) : -1;
  //fractional position of the zero line within [max..min] (0 = top, 1 = bottom)
  const zeroOffset = max <= 0 ? 0 : min >= 0 ? 1 : max / (max - min);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 16, right: 16, bottom: 4, left: 4 }}>
        <defs>
          <linearGradient id="rl-econ-lead" x1="0" y1="0" x2="0" y2="1">
            <stop offset={0} stopColor={seriesColor.amber} stopOpacity={0.5} />
            <stop offset={zeroOffset} stopColor={seriesColor.amber} stopOpacity={0.05} />
            <stop offset={zeroOffset} stopColor={seriesColor.sapphire} stopOpacity={0.05} />
            <stop offset={1} stopColor={seriesColor.sapphire} stopOpacity={0.5} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={gridStroke} strokeOpacity={0.4} vertical={false} />
        <XAxis dataKey="t" tick={axisTick} tickLine={false} axisLine={{ stroke: gridStroke }} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={36} tickFormatter={(v: number) => `${v}k`} />
        <ReferenceLine y={0} stroke="var(--border)" />
        <Tooltip
          contentStyle={tooltipContentStyle}
          labelStyle={tooltipLabelStyle}
          itemStyle={tooltipItemStyle}
          formatter={(v: ChartFmtValue) => (typeof v === 'number' ? `${v > 0 ? '+' : ''}${v.toFixed(1)}k` : String(v ?? ''))}
          labelFormatter={(t) => `Mark ${t}`}
        />
        <Area
          type="monotone"
          name="Net-worth lead"
          dataKey="lead"
          stroke={seriesColor.amber}
          strokeWidth={2.4}
          fill="url(#rl-econ-lead)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
