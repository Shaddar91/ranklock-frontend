//Per-minute economy — up to TWO league curves and TWO picked players, each slot drawn
//ONLY when the caller passes its label (the comparison set is caller-composed; every
//series can be toggled out without touching the others). Deliberately-distinct series —
//SINGLE source of truth for their colors is econSeriesColor (chartTheme), and the
//caller's caption names those same colors via useEconSeriesWords, so legend + caption +
//line colors can never drift:
//  • solid, filled area  — League A's median curve (`you` slot; the skin's lead accent)
//  • long-dash line      — League B's median curve (`cohort` slot)
//  • short-dash line     — the FIRST picked player's own per-minute curve (one
//                          caller-supplied `player` value per point; amber in every skin)
//  • med-dash line       — the SECOND compared player's per-minute curve (`player2`);
//                          a second warm hue (coral) so the two players never read as one
//The palette is THEME-AWARE: skins re-skin the --econ-* vars (themes.css), and the
//caption color words follow through chartTheme's skin-keyed word map, so the words stay
//literally true in every skin. The dash styles keep the series apart even where a skin
//puts hues close together (foundry keeps the default palette outright — its own oranges
//would collide "your rank" with amber "You").
//Callers pass the visible labels (youLabel/cohortLabel/playerLabel/player2Label) from
//their selection state — league display name, player name (+ hero). The
//`you`/`cohort`/`player`/`player2` dataKeys are fixed INTERNAL slot names only; no
//user-visible wording comes from them. Recharts ComposedChart.
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
  //League A's value at THIS minute (`you` slot), NaN where that league has no sample,
  //or absent when no League A series is drawn. Every series key is optional: the point
  //grid is the UNION of whichever series the caller composed, none of them the "base".
  you?: number;
  //League B's value at THIS minute (`cohort` slot) — same contract as `you`.
  cohort?: number;
  //Optional player-overlay value at THIS minute — the picked player's own per-minute
  //curve point (getPlayerEconomyCurve `you`), NaN where they have no sample, or absent
  //for no overlay. Drives the amber `player` series: a rising personal curve, not a level.
  player?: number;
  //Optional SECOND compared player's per-minute value at THIS minute (their own
  //getPlayerEconomyCurve `you`), NaN where they have no sample, or absent when no second
  //player is picked. Drives the coral `player2` series — the compare-two-players line.
  player2?: number;
  //[p25, p75] of the league in the `you` / `cohort` slot at THIS minute (cumulative view only);
  //absent where the league has no band. Recharts draws a range Area from the tuple.
  youBand?: [number, number];
  cohortBand?: [number, number];
}

interface EconomyCurveProps {
  data: EconomyPoint[];
  height?: number;
  //Visible legend + tooltip labels for the series — EVERY series renders only while its
  //label is passed (that is the in/out-of-chart switch; omit a label and its series,
  //legend entry, and tooltip row all disappear without touching the others). Callers
  //derive the labels from their selection state: youLabel/cohortLabel are the two league
  //display names (League A / League B medians, not the user), playerLabel/player2Label
  //the picked players' names (+ hero scope). The `you`/`cohort`/`player`/`player2`
  //dataKeys stay fixed internal slot names.
  youLabel?: string;
  cohortLabel?: string;
  playerLabel?: string;
  player2Label?: string;
  //Thin-sample rendering (Component 11 / B6): true fades the corresponding player line so a
  //curve resting on fewer than THIN_SAMPLE_MIN_MATCHES games reads as tentative next to the
  //million-sample rank bands. The lines are already dashed; faint is the thinness signal.
  playerFaint?: boolean;
  player2Faint?: boolean;
  //Draw-on mount animation for the two cohort curves (default true). Set false for
  //deterministic renders where the animation can't complete — SSR/headless
  //screenshots, snapshot tests — so the lines are present immediately.
  animate?: boolean;
  //Visible x-window in game minutes. Omitted → the full curve (['dataMin','dataMax']). The
  //Lane Lab island passes [0, 12] to DEFAULT the view to early game (C5/S2 — the rank gap
  //lives in the laning phase; the curves converge late). allowDataOverflow CLIPS to the
  //window rather than dropping data, so a zoom-out control can restore the whole match.
  xDomain?: [number, number];
  //Draw each drawn league's p25–p75 band behind its median line (default true). The island
  //passes false in the 'rate' view, where a spread of cumulative quantiles has no meaning.
  bands?: boolean;
}

const fmtK = (v: ChartFmtValue) =>
  typeof v === 'number' ? (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)) : String(v ?? '');

export default function EconomyCurve({
  data,
  height = 300,
  youLabel,
  cohortLabel,
  playerLabel,
  player2Label,
  playerFaint = false,
  player2Faint = false,
  animate = true,
  xDomain,
  bands = true,
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
        {/* League bands FIRST so they sit behind the lines: a range Area per drawn league (the
            datum is the [p25, p75] tuple), faint in the league's own hue, legendType="none" so
            the legend keeps to the four named series. No draw-on animation for a band. */}
        {youLabel && bands && (
          <Area
            type="monotone"
            name={`${youLabel} middle half`}
            dataKey="youBand"
            legendType="none"
            stroke="none"
            fill={econSeriesColor.you}
            fillOpacity={0.12}
            isAnimationActive={false}
          />
        )}
        {cohortLabel && bands && (
          <Area
            type="monotone"
            name={`${cohortLabel} middle half`}
            dataKey="cohortBand"
            legendType="none"
            stroke="none"
            fill={econSeriesColor.cohort}
            fillOpacity={0.1}
            isAnimationActive={false}
          />
        )}
        {youLabel && (
          //League A's filled area (the skin's lead series accent) — drawn only while the
          //caller keeps it in the comparison set (label passed), like every other slot.
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
        )}
        {cohortLabel && (
          //Long-dash line for League B — the second, independently selected league.
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
        )}
        {playerLabel && (
          //Amber (every skin) per-minute line for the picked player: their OWN curve
          //(getPlayerEconomyCurve `you`), one value per minute, so it rises with the match.
          //connectNulls bridges the minutes with no sample. Its values fold into the y-domain
          //automatically, so a high late-game net worth stays on-chart. Short-dash + amber
          //keeps it distinct from the long-dash cohort line.
          <Line
            type="linear"
            name={playerLabel}
            dataKey="player"
            stroke={econSeriesColor.player}
            strokeWidth={2.2}
            strokeDasharray="2 3"
            strokeOpacity={playerFaint ? 0.45 : 1}
            dot={false}
            connectNulls
            isAnimationActive={false}
            legendType="plainline"
          />
        )}
        {player2Label && (
          //Coral (every skin) per-minute line for the SECOND compared player: their OWN curve
          //(getPlayerEconomyCurve `you`), one value per minute. A distinct warm hue + a
          //medium dash ("5 3") keeps it apart from the amber short-dash first player and the
          //long-dash cohort, so two players + two rank lines stay tellable on one chart.
          <Line
            type="linear"
            name={player2Label}
            dataKey="player2"
            stroke={econSeriesColor.player2}
            strokeWidth={2.2}
            strokeDasharray="5 3"
            strokeOpacity={player2Faint ? 0.45 : 1}
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
