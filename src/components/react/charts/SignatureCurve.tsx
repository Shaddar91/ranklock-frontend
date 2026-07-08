//THE signature coaching chart (/players/:id economy curve) — your OWN per-minute soul
//curve, FIXED, overlaid against a comparison cohort you pick (a league, optionally
//narrowed to a hero). Two deliberately-distinct series whose SINGLE source of colour is
//sigSeriesColor (chartTheme); the caller's caption names those same colours via
//sigSeriesWord, so legend + caption + line colours can never drift:
//  • solid, thick AMBER line  — YOU: your real per-minute curve, FIXED (never changes when
//                               you pick a league/hero — that is the whole feature).
//  • dashed CYAN line         — the selected league (+hero) cohort MEDIAN (p50). Changing
//                               the league/hero moves ONLY this line.
//  • faint CYAN band          — the cohort's p25–p75 spread (optional; hidden from legend).
//The `you`/`cmp`/`band` dataKeys are fixed; callers pass the visible labels (youLabel is
//always "You"; comparisonLabel names the picked tier, e.g. "Ascendant average"). Recharts
//ComposedChart. The palette is theme-STABLE on purpose (tokens.css --econ-*).
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
  sigSeriesColor,
  tooltipContentStyle,
  tooltipItemStyle,
  tooltipLabelStyle,
} from './chartTheme';

export interface SignaturePoint {
  //game minute (t_seconds / 60) — the x value.
  min: number;
  //YOUR value at this minute (the fixed personal curve), or absent for a gap.
  you?: number;
  //the comparison cohort median (p50) at this minute, or absent.
  cmp?: number;
  //the comparison cohort p25..p75 spread, or absent. Recharts draws a range Area when
  //the datum resolves to a [low, high] tuple.
  band?: [number, number];
}

interface SignatureCurveProps {
  data: SignaturePoint[];
  height?: number;
  //Always "You" — the fixed personal line. Kept a prop only so it reads from one place.
  youLabel?: string;
  //The picked comparison's label, e.g. "Ascendant average" / "Ascendant · Haze average".
  //Omit to hide the comparison series entirely (no cohort available).
  comparisonLabel?: string;
  //metric noun for the tooltip/axis ("souls" | "last hits").
  metricLabel?: string;
  //Draw-on mount animation (default true). Set false for deterministic renders where the
  //animation can't complete — SSR/headless screenshots, snapshot tests — so every line is
  //present immediately. (recharts' mount animation never finishes under headless
  //virtual-time, so a screenshot of an animated chart is blank.)
  animate?: boolean;
}

const fmtK = (v: ChartFmtValue) =>
  typeof v === 'number' ? (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v))) : String(v ?? '');

export default function SignatureCurve({
  data,
  height = 320,
  youLabel = 'You',
  comparisonLabel,
  metricLabel = 'souls',
  animate = true,
}: SignatureCurveProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={gridStroke} strokeOpacity={0.5} vertical={false} />
        <XAxis
          dataKey="min"
          type="number"
          domain={['dataMin', 'dataMax']}
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
          formatter={(v: ChartFmtValue) => `${fmtK(v)} ${metricLabel}`}
          labelFormatter={(m) => `Minute ${m}`}
        />
        {/* legendType="plainline" forces each swatch to a colour+dash line segment, so the
            legend encodes BOTH hue and style — that is what makes it obvious which line is
            which. The p25–p75 band is legendType="none" to keep the legend to the two
            concepts that matter (You / the tier average). */}
        <Legend wrapperStyle={{ fontSize: 12, color: 'var(--muted)' }} iconType="plainline" />
        {comparisonLabel && (
          //Cohort spread first ⇒ it sits BEHIND the two lines. A range Area (value is the
          //[p25, p75] tuple) shaded faint cyan; no draw-on animation (a band can't
          //meaningfully sweep, and this keeps headless screenshots honest).
          <Area
            type="monotone"
            name="cohort range"
            dataKey="band"
            legendType="none"
            stroke="none"
            fill={sigSeriesColor.comparison}
            fillOpacity={0.1}
            isAnimationActive={false}
            connectNulls
          />
        )}
        {comparisonLabel && (
          //The comparison cohort median — cyan, dashed, no dots. The ONLY series that moves
          //when you change the league/hero selector.
          <Line
            type="monotone"
            name={comparisonLabel}
            dataKey="cmp"
            stroke={sigSeriesColor.comparison}
            strokeWidth={2.4}
            strokeDasharray="7 5"
            dot={false}
            connectNulls
            isAnimationActive={animate}
          />
        )}
        {/* YOU — drawn LAST so the personal curve sits on top of the cohort. Solid, thick,
            amber, with small dots: this is the star of the chart and it is FIXED (identical
            for every league/hero the user picks). */}
        <Line
          type="monotone"
          name={youLabel}
          dataKey="you"
          stroke={sigSeriesColor.you}
          strokeWidth={3}
          dot={{ r: 2, fill: sigSeriesColor.you, strokeWidth: 0 }}
          activeDot={{ r: 4 }}
          connectNulls
          isAnimationActive={animate}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
