//Per-sample match net worth ("souls") over time — either the two TEAM totals
//(filled areas, Amber vs Sapphire) or every PLAYER's line, colored by team. One
//caller-composed series list drives whichever view is selected; x-axis is match time
//(mm:ss). Recharts ComposedChart, theme-aware via chartTheme CSS-var colors.
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  axisTick,
  type ChartFmtValue,
  gridStroke,
  tooltipContentStyle,
  tooltipItemStyle,
  tooltipLabelStyle,
} from './chartTheme';
import { duration } from '../../../lib/format';
import type { NetWorthRow } from '../../../lib/matchInspect';

export interface NetWorthSeries {
  key: string;
  name: string;
  color: string;
  opacity?: number;
}

interface Props {
  data: NetWorthRow[];
  series: NetWorthSeries[];
  //teams view fills the area under each of the two lines; players view draws bare lines.
  filled?: boolean;
  legend?: boolean;
  height?: number;
}

const fmtK = (v: ChartFmtValue) =>
  typeof v === 'number' ? (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)) : String(v ?? '');

const fmtSouls = (v: ChartFmtValue) =>
  typeof v === 'number' ? `${Math.round(v).toLocaleString('en-US')} souls` : String(v ?? '');

const fmtTime = (s: ChartFmtValue) => duration(typeof s === 'number' ? s : Number(s));

export default function MatchNetWorthChart({ data, series, filled = false, legend = true, height = 260 }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 4 }}>
        <defs>
          {filled &&
            series.map((s) => (
              <linearGradient key={s.key} id={`rl-nw-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={s.color} stopOpacity={0.35} />
                <stop offset="1" stopColor={s.color} stopOpacity={0.03} />
              </linearGradient>
            ))}
        </defs>
        <CartesianGrid stroke={gridStroke} strokeOpacity={0.5} vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          domain={['dataMin', 'dataMax']}
          tick={axisTick}
          tickLine={false}
          axisLine={{ stroke: gridStroke }}
          tickFormatter={fmtTime}
        />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={40} tickFormatter={fmtK} />
        <Tooltip
          contentStyle={tooltipContentStyle}
          labelStyle={tooltipLabelStyle}
          itemStyle={tooltipItemStyle}
          formatter={fmtSouls}
          labelFormatter={(v) => fmtTime(v as ChartFmtValue)}
        />
        {legend && <Legend wrapperStyle={{ fontSize: 11, color: 'var(--muted)' }} iconType="plainline" />}
        {series.map((s) =>
          filled ? (
            <Area
              key={s.key}
              type="monotone"
              name={s.name}
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={2.4}
              strokeOpacity={s.opacity ?? 1}
              fill={`url(#rl-nw-${s.key})`}
              dot={false}
              isAnimationActive={false}
              legendType="plainline"
            />
          ) : (
            <Line
              key={s.key}
              type="monotone"
              name={s.name}
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={1.8}
              strokeOpacity={s.opacity ?? 1}
              dot={false}
              isAnimationActive={false}
              legendType="plainline"
            />
          ),
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
