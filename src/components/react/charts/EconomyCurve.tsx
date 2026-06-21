//Per-minute souls, tier vs tier. The filled cyan area is the SELECTED rank
//tier's median economy; the dashed line is the tier one rank up. Both series
//are rank-cohort medians — NOT the logged-in player. Callers pass the visible
//series labels (youLabel/cohortLabel); the `you`/`cohort` dataKeys are fixed.
//Recharts ComposedChart; theme-aware.
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  axisTick,
  type ChartFmtValue,
  gridStroke,
  seriesColor,
  tooltipContentStyle,
  tooltipItemStyle,
  tooltipLabelStyle,
} from './chartTheme';

export interface EconomyPoint {
  //match minute
  min: number;
  you: number;
  cohort: number;
}

interface EconomyCurveProps {
  data: EconomyPoint[];
  height?: number;
  //Visible legend + tooltip labels for the two series. Both are tier medians,
  //not the user — callers pass the selected band and the one-tier-up rank names
  //so the chart reads as tier-vs-tier. The `you`/`cohort` dataKeys stay fixed.
  youLabel?: string;
  cohortLabel?: string;
  //Optional FLAT reference marker — a single horizontal line at a known value
  //(e.g. a picked player's average net worth), NOT a per-minute series. It is a
  //level, not a trajectory: deliberately flat so it can never be read as a
  //fabricated personal curve. Omitted/null → nothing rendered.
  marker?: { value: number; label: string } | null;
}

const fmtK = (v: ChartFmtValue) =>
  typeof v === 'number' ? (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)) : String(v ?? '');

export default function EconomyCurve({
  data,
  height = 300,
  youLabel = 'Selected tier median',
  cohortLabel = 'One tier up',
  marker = null,
}: EconomyCurveProps) {
  //gate once so the JSX both renders only on a finite value AND narrows away null.
  const m = marker != null && Number.isFinite(marker.value) ? marker : null;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 4 }}>
        <defs>
          <linearGradient id="rl-econ-you" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={seriesColor.you} stopOpacity={0.28} />
            <stop offset="1" stopColor={seriesColor.you} stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={gridStroke} strokeOpacity={0.5} vertical={false} />
        <XAxis
          dataKey="min"
          tick={axisTick}
          tickLine={false}
          axisLine={{ stroke: gridStroke }}
          tickFormatter={(m: number) => `${m}:00`}
        />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} tickFormatter={fmtK} width={40} />
        <Tooltip
          contentStyle={tooltipContentStyle}
          labelStyle={tooltipLabelStyle}
          itemStyle={tooltipItemStyle}
          formatter={fmtK}
          labelFormatter={(m) => `Minute ${m}`}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: 'var(--muted)' }} />
        <Area
          type="monotone"
          name={youLabel}
          dataKey="you"
          stroke={seriesColor.you}
          strokeWidth={2.6}
          fill="url(#rl-econ-you)"
        />
        <Line
          type="monotone"
          name={cohortLabel}
          dataKey="cohort"
          stroke={seriesColor.cohort}
          strokeWidth={2}
          strokeDasharray="6 4"
          dot={false}
        />
        {m && (
          <ReferenceLine
            y={m.value}
            stroke={seriesColor.amber}
            strokeWidth={2}
            strokeDasharray="2 3"
            //extend the y-domain so a high marker (e.g. avg final net worth) stays visible.
            ifOverflow="extendDomain"
            label={{ value: m.label, position: 'insideTopRight', fill: seriesColor.amber, fontSize: 11 }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
