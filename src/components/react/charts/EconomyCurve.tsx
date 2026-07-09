//Per-minute economy, tier vs tier vs up to TWO picked players. Deliberately-distinct
//series — SINGLE source of truth for their colors is econSeriesColor (chartTheme),
//and the caller's caption names those same colors via econSeriesWord, so legend +
//caption + line colors can never drift:
//  • solid, filled CYAN area  — the SELECTED rank tier's median curve (your rank)
//  • long-dash VIOLET line    — the tier one rank up (the cohort you're chasing)
//  • short-dash AMBER line    — the FIRST picked player's own per-minute curve (one
//                               caller-supplied `player` value per point); omitted for no overlay
//  • med-dash CORAL line      — the SECOND compared player's per-minute curve (`player2`);
//                               a second warm hue so the two players never read as one line;
//                               omitted unless a second player is picked
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
  //Optional player-overlay value at THIS minute — the picked player's own per-minute
  //curve point (getPlayerEconomyCurve `you`), NaN where they have no sample, or absent
  //for no overlay. Drives the amber `player` series: a rising personal curve, not a level.
  player?: number;
  //Optional SECOND compared player's per-minute value at THIS minute (their own
  //getPlayerEconomyCurve `you`), NaN where they have no sample, or absent when no second
  //player is picked. Drives the coral `player2` series — the compare-two-players line.
  player2?: number;
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
  //Names the coral SECOND-player line (the 2nd player's display name); omit to hide it.
  //Same contract as playerLabel — the `player2` dataKey stays fixed.
  player2Label?: string;
  //Draw-on mount animation for the two cohort curves (default true). Set false for
  //deterministic renders where the animation can't complete — SSR/headless
  //screenshots, snapshot tests — so the lines are present immediately.
  animate?: boolean;
  //Visible x-window in game minutes. Omitted → the full curve (['dataMin','dataMax']). The
  //Lane Lab island passes [0, 12] to DEFAULT the view to early game (C5/S2 — the rank gap
  //lives in the laning phase; the curves converge late). allowDataOverflow CLIPS to the
  //window rather than dropping data, so a zoom-out control can restore the whole match.
  xDomain?: [number, number];
}

const fmtK = (v: ChartFmtValue) =>
  typeof v === 'number' ? (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)) : String(v ?? '');

export default function EconomyCurve({
  data,
  height = 300,
  youLabel = 'Your rank average',
  cohortLabel = 'Next rank up',
  playerLabel,
  player2Label,
  animate = true,
  xDomain,
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
        {/* Numeric time axis so the window can CLIP to a domain (SignatureCurve uses the
            same pattern). Default ['dataMin','dataMax'] = whole match; the island passes
            [0,12] to default the visible window to early game (C5/S2). allowDataOverflow
            clips instead of dropping points; allowDecimals keeps the ticks whole minutes. */}
        <XAxis
          dataKey="min"
          type="number"
          domain={xDomain ?? ['dataMin', 'dataMax']}
          allowDataOverflow
          allowDecimals={false}
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
          //Amber per-minute line for the picked player: their OWN curve (getPlayerEconomyCurve
          //`you`), one value per minute, so it rises with the match. connectNulls bridges the
          //minutes with no sample. Its values fold into the y-domain automatically, so a high
          //late-game net worth stays on-chart. Short-dash + amber keeps it distinct from the
          //long-dash violet cohort line.
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
        {player2Label && (
          //Coral per-minute line for the SECOND compared player: their OWN curve
          //(getPlayerEconomyCurve `you`), one value per minute. A distinct warm hue + a
          //medium dash ("5 3") keeps it apart from the amber short-dash first player and the
          //violet long-dash cohort, so two players + two rank lines stay tellable on one chart.
          <Line
            type="linear"
            name={player2Label}
            dataKey="player2"
            stroke={econSeriesColor.player2}
            strokeWidth={2.2}
            strokeDasharray="5 3"
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
