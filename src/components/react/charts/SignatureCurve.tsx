//THE signature coaching chart (/players/:id economy curve) — your OWN per-minute soul
//curve, FIXED, overlaid against a comparison cohort you pick (a league, optionally
//narrowed to a hero). Two deliberately-distinct series whose SINGLE source of colour is
//sigSeriesColor (chartTheme); the caller's caption names those same colours via
//useSigSeriesWords, so legend + caption + line colours can never drift:
//  • solid, thick warm line — YOU: your real per-minute curve, FIXED (never changes when
//                             you pick a league/hero — that is the whole feature). Amber
//                             in every skin (--econ-player).
//  • dashed cool line       — the selected league (+hero) cohort MEDIAN (p50), in the
//                             skin's lead series accent (--econ-you). Changing the
//                             league/hero moves ONLY this line.
//  • faint matching band    — the cohort's p25–p75 spread (optional; hidden from legend).
//The `you`/`cmp`/`band` dataKeys are fixed; callers pass the visible labels (youLabel is
//always "You"; comparisonLabel names the picked tier, e.g. "Ascendant average"). Recharts
//ComposedChart. The palette is THEME-AWARE: skins re-skin the --econ-* vars (themes.css)
//and the caption words follow through chartTheme's skin-keyed word map.
import {
  ComposedChart,
  Area,
  Line,
  LabelList,
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
  //Index of the LAST non-null datum for a series — that is where its on-chart name label
  //is drawn (like a line title trailing off the right edge).
  const lastIdxOf = (key: 'you' | 'cmp') => {
    let last = -1;
    data.forEach((d, i) => {
      if (d[key] != null) last = i;
    });
    return last;
  };
  //A <LabelList content=> renderer that draws the series' name in the line's colour at that
  //series' final point only (offset right so it reads as a trailing title).
  const EndLabel =
    (key: 'you' | 'cmp', text: string | undefined, color: string) =>
    //x/y are typed number|string to match recharts' LabelContentType props (SVGProps x/y),
    //so this render fn is assignable to <LabelList content=>; recharts passes numbers at runtime.
    (props: { x?: number | string; y?: number | string; index?: number }) => {
      if (!text || props.index !== lastIdxOf(key)) return null;
      return (
        <text
          x={Number(props.x ?? 0) + 8}
          y={props.y ?? 0}
          dy={4}
          fill={color}
          fontSize={12}
          fontWeight={700}
          textAnchor="start"
        >
          {text}
        </text>
      );
    };
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 12, right: 72, bottom: 4, left: 4 }}>
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
        <YAxis
          domain={[0, 'dataMax']}
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          tickFormatter={fmtK}
          width={40}
        />
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
          //[p25, p75] tuple) shaded faintly in the cohort hue; no draw-on animation (a band
          //can't meaningfully sweep, and this keeps headless screenshots honest).
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
          //The comparison cohort median — the skin's cohort hue, dashed, no dots. The ONLY
          //series that moves when you change the league/hero selector.
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
          >
            <LabelList
              dataKey="cmp"
              content={EndLabel('cmp', comparisonLabel, sigSeriesColor.comparison)}
            />
          </Line>
        )}
        {/* YOU — drawn LAST so the personal curve sits on top of the cohort. Solid, thick,
            amber (every skin), with small dots: this is the star of the chart and it is
            FIXED (identical for every league/hero the user picks). */}
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
        >
          <LabelList dataKey="you" content={EndLabel('you', youLabel, sigSeriesColor.you)} />
        </Line>
      </ComposedChart>
    </ResponsiveContainer>
  );
}
