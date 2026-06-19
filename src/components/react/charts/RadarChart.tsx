//Playstyle radar — you vs the cohort one tier above, across 6 axes (0..1).
//Recharts implementation; theme-aware via CSS-var colors.
import {
  Radar,
  RadarChart as RechartsRadar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import {
  type ChartFmtValue,
  tooltipContentStyle,
  tooltipItemStyle,
  tooltipLabelStyle,
  seriesColor,
  gridStroke,
} from './chartTheme';

export interface RadarDatum {
  axis: string;
  you: number;
  cohort: number;
}

interface RadarChartProps {
  data: RadarDatum[];
  height?: number;
  youLabel?: string;
  cohortLabel?: string;
}

export default function RadarChart({
  data,
  height = 300,
  youLabel = 'You',
  cohortLabel = 'Next tier',
}: RadarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsRadar data={data} outerRadius="72%">
        <PolarGrid stroke={gridStroke} />
        <PolarAngleAxis
          dataKey="axis"
          tick={{ fill: 'var(--muted)', fontSize: 11, fontFamily: 'var(--display)' }}
        />
        <PolarRadiusAxis domain={[0, 1]} tick={false} axisLine={false} />
        <Radar
          name={cohortLabel}
          dataKey="cohort"
          stroke={seriesColor.cohort}
          fill={seriesColor.cohort}
          fillOpacity={0.08}
          strokeDasharray="5 4"
          strokeWidth={1.6}
        />
        <Radar
          name={youLabel}
          dataKey="you"
          stroke={seriesColor.you}
          fill={seriesColor.you}
          fillOpacity={0.25}
          strokeWidth={2.2}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: 'var(--muted)' }} />
        <Tooltip
          contentStyle={tooltipContentStyle}
          labelStyle={tooltipLabelStyle}
          itemStyle={tooltipItemStyle}
          formatter={(v: ChartFmtValue) => (typeof v === 'number' ? v.toFixed(2) : String(v ?? ''))}
        />
      </RechartsRadar>
    </ResponsiveContainer>
  );
}
