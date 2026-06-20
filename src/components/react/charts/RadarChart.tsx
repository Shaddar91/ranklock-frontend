//Playstyle radar — you vs the cohort one tier above, across 6 axes (0..1).
//Recharts implementation; theme-aware via CSS-var colors.
//
//Honors the `data-radar` art-direction tweak (lib/tweaks): "filled" shades each
//series, "line" drops the fill to outlines only. Read live from <html> so toggling
//it in the Tweaks panel re-renders the radar with no navigation.
import { useEffect, useState } from 'react';
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

//Live-read the `data-radar` tweak from <html> (SSR-safe default: 'filled').
function useRadarMode(): 'filled' | 'line' {
  const [mode, setMode] = useState<'filled' | 'line'>('filled');
  useEffect(() => {
    const read = () => setMode(document.documentElement.dataset.radar === 'line' ? 'line' : 'filled');
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-radar'] });
    return () => obs.disconnect();
  }, []);
  return mode;
}

export default function RadarChart({
  data,
  height = 300,
  youLabel = 'You',
  cohortLabel = 'Next tier',
}: RadarChartProps) {
  const mode = useRadarMode();
  const cohortFill = mode === 'line' ? 0 : 0.08;
  const youFill = mode === 'line' ? 0 : 0.25;
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
          fillOpacity={cohortFill}
          strokeDasharray="5 4"
          strokeWidth={1.6}
        />
        <Radar
          name={youLabel}
          dataKey="you"
          stroke={seriesColor.you}
          fill={seriesColor.you}
          fillOpacity={youFill}
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
