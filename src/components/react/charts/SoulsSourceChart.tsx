//Souls-by-source, you vs your tier, on the 3-minute grid (migration 048). Each bucket carries TWO
//stacked bars — your sources (solid) beside the tier's (faded) — so the shape of where your net
//worth comes from reads against the cohort at a glance. Souls LOST to deaths are NOT in the stack:
//they draw as a line below zero (their own negative series). Colour is the source encoding, opacity
//the you/tier one; the caller's caption says so. Recharts ComposedChart, theme-aware via chartTheme.
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { SOULS_GROUP_LABEL, SOULS_LOSS_GROUP, SOULS_STACK_GROUPS, soulsKey } from '../../../lib/soulsSources';
import type { SoulsSourceRow } from '../../../lib/soulsSources';
import {
  axisTick,
  type ChartFmtValue,
  gridStroke,
  soulsGroupColor,
  tooltipContentStyle,
  tooltipItemStyle,
  tooltipLabelStyle,
} from './chartTheme';

//Sign-aware k-formatter: losses come through negative, so the axis/tooltip must read "−1.2k".
const fmtK = (v: ChartFmtValue) => {
  if (typeof v !== 'number') return String(v ?? '');
  const k = `${(Math.abs(v) / 1000).toFixed(1)}k`;
  return v < 0 ? `−${k}` : k;
};

interface SoulsSourceChartProps {
  data: SoulsSourceRow[];
  //Draw the tier stack + tier loss line. False while the cohort is still folding — the panel then
  //shows only the player's own stack.
  showTier: boolean;
  height?: number;
}

export default function SoulsSourceChart({ data, showTier, height = 300 }: SoulsSourceChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 4 }} barGap={1} barCategoryGap="16%">
        <CartesianGrid stroke={gridStroke} strokeOpacity={0.5} vertical={false} />
        <XAxis
          dataKey="min"
          tick={axisTick}
          tickLine={false}
          axisLine={{ stroke: gridStroke }}
          tickFormatter={(m: number) => `${m}:00`}
        />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={fmtK} width={44} />
        <ReferenceLine y={0} stroke={gridStroke} />
        <Tooltip
          contentStyle={tooltipContentStyle}
          labelStyle={tooltipLabelStyle}
          itemStyle={tooltipItemStyle}
          formatter={fmtK}
          labelFormatter={(m) => `Minute ${m}`}
        />
        {/* Legend names the six sources ONCE (your bars + the loss line); the faded tier twins are
            legendType="none" so the key stays readable — the caption explains solid=you, faded=tier. */}
        <Legend wrapperStyle={{ fontSize: 12, color: 'var(--muted)' }} />
        {SOULS_STACK_GROUPS.map((g) => (
          <Bar
            key={soulsKey('you', g)}
            name={SOULS_GROUP_LABEL[g]}
            dataKey={soulsKey('you', g)}
            stackId="you"
            fill={soulsGroupColor[g]}
            maxBarSize={26}
            isAnimationActive={false}
          />
        ))}
        {showTier &&
          SOULS_STACK_GROUPS.map((g) => (
            <Bar
              key={soulsKey('tier', g)}
              name={`${SOULS_GROUP_LABEL[g]} · tier`}
              legendType="none"
              dataKey={soulsKey('tier', g)}
              stackId="tier"
              fill={soulsGroupColor[g]}
              fillOpacity={0.42}
              maxBarSize={26}
              isAnimationActive={false}
            />
          ))}
        <Line
          type="monotone"
          name={SOULS_GROUP_LABEL[SOULS_LOSS_GROUP]}
          dataKey={soulsKey('you', SOULS_LOSS_GROUP)}
          stroke={soulsGroupColor.losses}
          strokeWidth={2.2}
          dot={false}
          connectNulls
          isAnimationActive={false}
        />
        {showTier && (
          <Line
            type="monotone"
            name={`${SOULS_GROUP_LABEL[SOULS_LOSS_GROUP]} · tier`}
            legendType="none"
            dataKey={soulsKey('tier', SOULS_LOSS_GROUP)}
            stroke={soulsGroupColor.losses}
            strokeOpacity={0.5}
            strokeDasharray="5 3"
            strokeWidth={2}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
