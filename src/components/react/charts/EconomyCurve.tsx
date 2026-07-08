//Per-minute economy, tier vs tier vs the picked player. Three deliberately-distinct
//series — SINGLE source of truth for their colors is econSeriesColor (chartTheme),
//and the caller's caption names those same colors via econSeriesWord, so legend +
//caption + line colors can never drift:
//  • solid, filled CYAN area  — the SELECTED rank tier's median curve (your rank)
//  • long-dash VIOLET line    — the tier one rank up (the cohort you're chasing)
//  • short-dash AMBER line    — the picked player / "You": a FLAT per-game average,
//                               never a per-minute trajectory
//The palette is theme-STABLE on purpose (tokens.css --econ-*): the caption says the
//literal word "cyan"/"violet"/"amber", so the lines must not re-skin with the theme
//(the foundry skin used to turn "your rank" orange, colliding with amber "You").
//Callers pass the visible labels (youLabel/cohortLabel/playerLabel); the
//`you`/`cohort`/`player` dataKeys are fixed. Recharts ComposedChart.
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
  econSeriesColor,
  gridStroke,
  tooltipContentStyle,
  tooltipItemStyle,
  tooltipLabelStyle,
} from './chartTheme';

export interface EconomyPoint {
  //match minute
  min: number;
  you: number;
  cohort: number;
  //Optional FLAT player-overlay level — the SAME value on every point (the picked
  //player's per-game average for the active metric), or absent for no overlay. It
  //is a level, not a trajectory: deliberately flat so it can never be read as a
  //fabricated per-minute personal curve. Drives the amber `player` series.
  player?: number;
}

interface EconomyCurveProps {
  data: EconomyPoint[];
  height?: number;
  //Visible legend + tooltip labels for the series. you/cohort are tier medians, not
  //the user — callers pass the selected band and the one-tier-up rank names so the
  //chart reads as tier-vs-tier. playerLabel names the flat amber overlay (the picked
  //player's name, or "You"); omit it to hide the overlay entirely. The
  //`you`/`cohort`/`player` dataKeys stay fixed.
  youLabel?: string;
  cohortLabel?: string;
  playerLabel?: string;
  //Draw-on mount animation for the two cohort curves (default true). Set false for
  //deterministic renders where the animation can't complete — SSR/headless
  //screenshots, snapshot tests — so the lines are present immediately.
  animate?: boolean;
}

const fmtK = (v: ChartFmtValue) =>
  typeof v === 'number' ? (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)) : String(v ?? '');

export default function EconomyCurve({
  data,
  height = 300,
  youLabel = 'Selected tier median',
  cohortLabel = 'One tier up',
  playerLabel,
  animate = true,
}: EconomyCurveProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 4 }}>
        <defs>
          <linearGradient id="rl-econ-you" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={econSeriesColor.you} stopOpacity={0.28} />
            <stop offset="1" stopColor={econSeriesColor.you} stopOpacity={0.04} />
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
        {/* legendType="plainline" forces every swatch to a colored line segment that
            honors the series' stroke + dash — so the legend encodes BOTH hue and
            style, and the filled area no longer shows an almost-invisible faint-fill
            swatch. That is what makes it obvious which line is which. */}
        <Legend wrapperStyle={{ fontSize: 12, color: 'var(--muted)' }} iconType="plainline" />
        <Area
          type="monotone"
          name={youLabel}
          dataKey="you"
          stroke={econSeriesColor.you}
          strokeWidth={2.6}
          fill="url(#rl-econ-you)"
          legendType="plainline"
          isAnimationActive={animate}
        />
        <Line
          type="monotone"
          name={cohortLabel}
          dataKey="cohort"
          stroke={econSeriesColor.cohort}
          strokeWidth={2.4}
          strokeDasharray="7 5"
          dot={false}
          legendType="plainline"
          isAnimationActive={animate}
        />
        {playerLabel && (
          //Flat amber level for the picked player / "You": a per-game AVERAGE, drawn
          //straight across so it reads as a reference level, never a per-minute curve.
          //As a real series its value is folded into the y-domain automatically, so a
          //high average (e.g. final net worth) stays on-chart without manual extension.
          //Short-dash + amber keeps it distinct from the long-dash violet cohort line.
          <Line
            type="linear"
            name={playerLabel}
            dataKey="player"
            stroke={econSeriesColor.player}
            strokeWidth={2.2}
            strokeDasharray="2 3"
            dot={false}
            connectNulls
            isAnimationActive={false}
            legendType="plainline"
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
