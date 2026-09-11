//Lane Lab island — the signature per-minute economy / soul-curve coaching
//surface (brief §7B). ONE hydration root mounted on /lane-lab.
//
//`band` is a rank tier (badge/10, 0..11 — exactly lib/ranks RANKS index).
//band omitted ('All') aggregates every band.
import { useEffect, useId, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, isComputing, isDisabled, isNotFound, isUnauthorized, queryKeys } from '../../lib/apiClient';
import QueryProvider from './QueryProvider';
import { BracketFilter, type BracketValue, Chip, EmptyState, Icon, RankBadge } from './ui/index';
import EconomyCurve from './charts/EconomyCurve';
import { econSeriesColor, useEconSeriesWords } from './charts/chartTheme';
import { useViewer } from './player/usePlayer';
import { getRank, rankFromBadge, subLabel, RANKS, SUBRANK_NUMERALS } from '../../lib/ranks';
import { count, fixed, pct } from '../../lib/format';
import { datasetWindowLabel, ECONOMY_CURVE_DATASET } from '../../lib/dataHorizon';
import {
  type CohortParams,
  type CohortProbeState,
  type PlayerCurveCohortParams,
  type ViewMode,
  cohortParamsFor,
  defaultCohortFromProbe,
  guardedPlayerCurvePoints,
  isThinPlayerSample,
  isThinRankSample,
  laneBandByMinute,
  laneSeriesByMinute,
  leagueSampleCaption,
  mergeEconSeriesByMinute,
  peakPlayerMatches,
  playerCurveParamsFor,
  playerSeriesByMinute,
  RANK_MIN_SAMPLE,
  THIN_SAMPLE_MIN_MATCHES,
} from '../../lib/laneCurve';
import type {
  HeroSummary,
  LaneCurveResponse,
  PlayerEconomy,
  RankCohort,
  SearchResult,
} from '../../types/api';

//A single curve metric: the API token + its human label.
interface MetricOption {
  key: string;
  label: string;
}

const ECON_METRICS: readonly MetricOption[] = [
  { key: 'souls', label: 'Souls' },
  { key: 'last_hits', label: 'Last hits' },
  { key: 'kills', label: 'Kills' },
  { key: 'deaths', label: 'Deaths' },
  { key: 'assists', label: 'Assists' },
  { key: 'damage', label: 'Damage' },
];

//Player-rank-cohort-only metrics (DESIGN §8/§9, migration 052): the team-average Gold never
//folded these five, so offering them there would only ever draw an honest-empty curve — they
//appear in the economy-curve metric list ONLY while the cohort switch is on Player rank.
const ECON_METRICS_RANK_EXTRA: readonly MetricOption[] = [
  { key: 'damage_taken', label: 'Damage taken' },
  { key: 'player_healing', label: 'Healing' },
  { key: 'damage_mitigated', label: 'Mitigated' },
  { key: 'accuracy', label: 'Accuracy' },
  { key: 'level', label: 'Level' },
];
const econMetricsFor = (cohort: RankCohort): readonly MetricOption[] =>
  cohort === 'player_rank' ? [...ECON_METRICS, ...ECON_METRICS_RANK_EXTRA] : ECON_METRICS;

//The /lane-lab/farm-curve endpoint serves only last_hits + souls (backend FARM_METRICS,
//unchanged by 052) regardless of cohort — last-hits is the farm headline, so it defaults there.
const FARM_METRICS: readonly MetricOption[] = [
  { key: 'last_hits', label: 'Last hits' },
];

//---- the cohort switch (DESIGN §9) ------------------------------------------
//Player rank = the new per-player display-rank tables (Ranked-only, since Aug 7, 2026);
//team average = the pre-052 badge-band tables every other Lane Lab panel has always used.
//Copy is verbatim DESIGN §9 so the switch and its caption never drift apart.
const COHORT_OPTIONS: readonly MetricOption[] = [
  { key: 'player_rank', label: 'Player rank' },
  { key: 'team_average', label: 'Team average' },
];
const cohortCaption = (c: RankCohort): string =>
  c === 'player_rank' ? 'Player rank · ranked matches since Aug 7, 2026' : 'Team average · all matches';

const RANK_TIERS: number[] = RANKS.filter((r) => r.tier >= 1).map((r) => r.tier);
//Division select options (DESIGN §9: "All, I–VI"). undefined = the whole league (every
//division); 1..6 narrows to one exact display rank (tier*10+division).
const DIVISION_OPTIONS: readonly { value: number | undefined; label: string }[] = [
  { value: undefined, label: 'All' },
  ...SUBRANK_NUMERALS.map((label, i) => ({ value: i + 1, label })),
];

//---- curve view mode --------------------------------------------------------

const VIEW_MODES: readonly MetricOption[] = [
  { key: 'rate', label: 'Per minute' },
  { key: 'total', label: 'Total' },
];

//---- curve x-window ---------------------------------------------------------
type XWindow = 'early' | 'full';
const X_WINDOWS: readonly MetricOption[] = [
  { key: 'early', label: 'Early game' },
  { key: 'full', label: 'Full game' },
];
//Upper bound of the early-game window, in game minutes (the laning phase where leagues diverge).
const EARLY_GAME_MAX_MIN = 12;

const PER_THOUSAND_BUCKET = 1000;
const bucketScale = (metric: string): number =>
  metric === 'souls' || metric === 'damage' ? PER_THOUSAND_BUCKET : 1;

//The highest rank band (Eternus = badge 110..116 → band 11). Nothing sits above it,
//so League B's "auto" default (one league above League A) resolves to none there.
const TOP_BAND = 11;

//The full rank ladder (Obscurus … Eternus) drives the League A selector here — the
//shared BracketFilter default hides the low ranks, but the lane endpoints serve
//every band, so Lane Lab surfaces them all (with a thin-sample caveat below).
const FULL_TIERS: number[] = RANKS.map((r) => r.tier);

//A BracketValue → the API's `band` param (undefined for 'all' so the call omits
//the param and the backend aggregates every band).
const bandParam = (v: BracketValue): number | undefined => (v === 'all' ? undefined : v);

//Translate a build-ahead query error into the right "coming soon" empty-state
//copy (mirrors AnalyticsPanels.buildAheadMessage, re-stated so the island is
//self-contained). 501/202 are the EXPECTED pre-data states, not failures.
function laneAheadMessage(error: unknown): string {
  if (isDisabled(error)) return 'Coming soon — this part of the stats service is switched off right now.';
  if (isComputing(error)) return 'Computing now — the lane curves are being generated. Check back shortly.';
  return 'Per-minute lane curves are not computed yet. Check back after the next refresh.';
}

//---- the comparison-set entity model ----------------------------------------

//A selected hero: id + display name (from the shared /heroes catalog).
interface HeroPick {
  id: number;
  name: string;
}

//A league series: its API band/tier (undefined = all bands aggregated, or — in player-rank
//mode — no valid tier picked), an optional player-rank division (DESIGN §9; ignored under
//team_average), display name, and whether its chip currently keeps it in the chart.
interface LeagueEntity {
  band: number | undefined;
  division?: number;
  name: string;
  show: boolean;
}

//A picked player series: identity, their EFFECTIVE hero scope (per-player override,
//defaulting to the global hero), their per-game aggregate (stat-line), chip state, and
//the no-games guard verdict (player_hero_games === 0 on their hero ⇒ never drawn).
interface PlayerEntity {
  id: number;
  name: string;
  hero: HeroPick | null;
  overlay: PlayerOverlay | null;
  show: boolean;
  noGames: boolean;
}

interface ComparisonSelection {
  //DESIGN §9: ONE cohort switch drives League A, League B, and every hero-scoped comparison —
  //there is no per-league cohort choice, so a chart can never mix a player-rank curve with a
  //team-average one.
  cohort: RankCohort;
  leagueA: LeagueEntity;
  //null = no League B in the set (League A is 'All'/top and the auto default has no
  //league above it, and none was picked explicitly).
  leagueB: LeagueEntity | null;
  //The global hero scope (null = all heroes).
  hero: HeroPick | null;
  //True when the league curves are hero-scoped: a hero is selected AND a picked player
  //anchors the per-(band, hero) comparison requests. Without an anchor the
  //league curves stay all-heroes and the captions say so (never a silent wrong label).
  heroScopedLeagues: boolean;
  //The anchoring player id for hero-scoped league fetches (first picked player).
  anchorId: number | null;
  p1: PlayerEntity | null;
  p2: PlayerEntity | null;
}

//The visible series name for a player entity: "Name (Hero)" when hero-scoped.
const playerSeriesLabel = (p: { name: string; hero: HeroPick | null }): string =>
  p.hero ? `${p.name} (${p.hero.name})` : p.name;

//The visible series name for a league entity under the active hero scope.
const leagueSeriesLabel = (name: string, sel: Pick<ComparisonSelection, 'hero' | 'heroScopedLeagues'>): string =>
  sel.heroScopedLeagues && sel.hero ? `${name} · ${sel.hero.name} average` : `${name} average`;

//Peak per-minute sample size across a league curve — shown as "n =" so a reader can
//weigh a thin league's curve against a well-sampled one. Structural: serves both the
//band-Gold points and the band x hero Gold comparison points.
function peakSamples(points: ReadonlyArray<{ sample_players: number }> | undefined): number {
  return (points ?? []).reduce((m, p) => Math.max(m, p.sample_players), 0);
}

//---- the picked-player / my-account economy overlay -------------------------

//What's currently overlaid: a searched player, or (isMe) the signed-in caller's own account.
type OverlaySource = { kind: 'player'; player: SearchResult; isMe?: boolean };

interface PlayerOverlay {
  //The picked player's name, or "You" for the signed-in account.
  label: string;
  matches: number;
  badge: number;
  //Every per-game average the per-player economy endpoint serves (C1); a null renders as an
  //em-dash rather than a fabricated value.
  avg_net_worth: number | null;
  souls_per_min: number | null;
  last_hits_per_min: number | null;
  avg_kills: number | null;
  avg_deaths: number | null;
  avg_assists: number | null;
  avg_denies: number | null;
  avg_player_damage: number | null;
}

function overlayFromPlayer(name: string, e: PlayerEconomy): PlayerOverlay {
  return {
    label: name,
    matches: e.matches,
    badge: e.badge,
    avg_net_worth: e.avg_net_worth,
    souls_per_min: e.souls_per_min,
    last_hits_per_min: e.last_hits_per_min,
    avg_kills: e.avg_kills,
    avg_deaths: e.avg_deaths,
    avg_assists: e.avg_assists,
    avg_denies: e.avg_denies,
    avg_player_damage: e.avg_player_damage,
  };
}

//An overlay only has something to draw when it covers real ranked games with a souls
//rate — otherwise the player has "no economy data yet" and the picker empty-states it.
const overlayHasData = (o: PlayerOverlay | null): o is PlayerOverlay =>
  o != null && o.matches > 0 && o.souls_per_min != null;

//The picked player's ESTIMATED 9-minute net worth, projected from their average souls/min
//pace (× 9 min). Only a FALLBACK for a player whose per-minute line is not served yet — the
//verdict marker prefers the measured 9:00 value from their own curve; the estimate is captioned.
const projected9MinSouls = (o: PlayerOverlay): number | null =>
  o.souls_per_min != null ? Math.round(o.souls_per_min * 9) : null;

//Status of the active overlay fetch, handed to the picker for its loading/empty/summary UI.
interface OverlayStatus {
  pending: boolean;
  isError: boolean;
  error: unknown;
  data: PlayerOverlay | null;
  hasData: boolean;
}

//---- the metric toggle ------------------------------------------------------

function MetricToggle({
  metrics,
  value,
  onChange,
  ariaLabel = 'Curve metric',
}: {
  metrics: readonly MetricOption[];
  value: string;
  onChange: (m: string) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="tabs" role="tablist" aria-label={ariaLabel}>
      {metrics.map((m) => (
        <button
          key={m.key}
          type="button"
          role="tab"
          aria-selected={value === m.key}
          className={'tab' + (value === m.key ? ' on' : '')}
          onClick={() => onChange(m.key)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

//---- the comparison-set chip row ---------------------------------------------
function ComparisonSetChips({
  selection,
  onToggle,
}: {
  selection: ComparisonSelection;
  onToggle: (key: 'a' | 'b' | 'p1' | 'p2') => void;
}) {
  const { leagueA, leagueB, p1, p2 } = selection;
  const entries: {
    key: 'a' | 'b' | 'p1' | 'p2';
    color: string;
    label: string;
    checked: boolean;
    note: string | null;
  }[] = [
    { key: 'a', color: econSeriesColor.you, label: leagueSeriesLabel(leagueA.name, selection), checked: leagueA.show, note: null },
    ...(leagueB
      ? [{ key: 'b' as const, color: econSeriesColor.cohort, label: leagueSeriesLabel(leagueB.name, selection), checked: leagueB.show, note: null }]
      : []),
    ...(p1
      ? [{ key: 'p1' as const, color: econSeriesColor.player, label: playerSeriesLabel(p1), checked: p1.show, note: p1.noGames && p1.hero ? `no games on ${p1.hero.name}` : null }]
      : []),
    ...(p2
      ? [{ key: 'p2' as const, color: econSeriesColor.player2, label: playerSeriesLabel(p2), checked: p2.show, note: p2.noGames && p2.hero ? `no games on ${p2.hero.name}` : null }]
      : []),
  ];
  return (
    <div className="panel" style={{ padding: '12px 16px' }}>
      <div className="label-xs" style={{ marginBottom: 8 }}>
        In the chart — uncheck an entity to hide its series (its setup is kept)
      </div>
      <div className="flex" style={{ gap: 8, flexWrap: 'wrap' }}>
        {entries.map((e) => (
          <button
            key={e.key}
            type="button"
            className={'minitog' + (e.checked ? ' on' : '')}
            aria-pressed={e.checked}
            onClick={() => onToggle(e.key)}
          >
            {/* the dot IS the series color — the chip, the legend, and the line agree */}
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: 9,
                height: 9,
                borderRadius: 99,
                background: e.color,
                marginRight: 7,
                opacity: e.checked ? 1 : 0.35,
                verticalAlign: 'baseline',
              }}
            />
            {e.checked ? '✓ ' : ''}
            {e.label}
            {e.note && (
              <span style={{ color: 'var(--loss)', marginLeft: 6, fontSize: 11 }}>— {e.note}</span>
            )}
          </button>
        ))}
      </div>
      {leagueB == null && (
        <p className="muted faint" style={{ fontSize: 11.5, margin: '8px 0 0', lineHeight: 1.4 }}>
          No League B in the set — League A is {selection.leagueA.name === 'All ranks' ? '"All ranks"' : 'the top league'}, so
          the auto default (one league above it) has nothing to point at. Pick League B explicitly to compare two leagues.
        </p>
      )}
    </div>
  );
}

//---- a reusable league-vs-league curve panel (economy or farm) ---------------

function CurvePanel({
  selection,
  fetcher,
  queryKeyFor,
  metrics,
  defaultMetric,
  kicker,
  sampleWindow = null,
}: {
  selection: ComparisonSelection;
  fetcher: (params: CohortParams & { metric?: string }) => Promise<LaneCurveResponse>;
  //Record-shaped (not the named CohortParams) so this matches queryKeys.*'s generic `Query`
  //param structurally, index signature included — see queryKeys in apiClient.ts.
  queryKeyFor: (params: Record<string, string | number | undefined>) => readonly unknown[];
  metrics: readonly MetricOption[];
  defaultMetric: string;
  kicker: string;
  sampleWindow?: string | null;
}) {
  const [metric, setMetric] = useState<string>(defaultMetric);
  //The active metric list is cohort-dependent (ECON_METRICS_RANK_EXTRA only exists in
  //player-rank mode) — if the switch flips away from a metric that no longer applies, fall
  //back to the panel's default rather than leaving the toggle with no tab selected.
  useEffect(() => {
    if (!metrics.some((m) => m.key === metric)) setMetric(defaultMetric);
  }, [metrics, metric, defaultMetric]);
  //The active skin's series color words — re-renders the caption when the skin flips,
  //keeping the words in lockstep with the CSS-var line colors that re-skin live.
  const econWords = useEconSeriesWords();
  const [viewMode, setViewMode] = useState<ViewMode>('rate');
  const [xWindow, setXWindow] = useState<XWindow>('early');
  const xDomain: [number, number] | undefined =
    xWindow === 'early' ? [0, EARLY_GAME_MAX_MIN] : undefined;

  const { cohort, leagueA, leagueB, hero, heroScopedLeagues, anchorId, p1, p2 } = selection;

  const paramsA = cohortParamsFor(cohort, leagueA.band, leagueA.division);
  const paramsB = leagueB ? cohortParamsFor(cohort, leagueB.band, leagueB.division) : null;
  //The same selection under /players/:id/economy-curve's names — that endpoint calls the
  //team-average league `vs_band` and ignores `band` outright (07-review.md §3.1).
  const curveParamsA = playerCurveParamsFor(cohort, leagueA.band, leagueA.division);
  const curveParamsB = leagueB ? playerCurveParamsFor(cohort, leagueB.band, leagueB.division) : null;
  const noTierA = cohort === 'player_rank' && paramsA == null;
  const noTierB = cohort === 'player_rank' && leagueB != null && paramsB == null;

  //---- League A / League B series — two sources, chosen by the hero scope ----
  const laneA = useQuery({
    queryKey: queryKeyFor({ ...(paramsA ?? {}), metric }),
    queryFn: () => fetcher({ ...(paramsA as CohortParams), metric }),
    retry: false,
    enabled: leagueA.show && !heroScopedLeagues && paramsA != null,
  });
  const heroCmpA = useQuery({
    queryKey: queryKeys.playerEconomyCurve(anchorId ?? 0, { metric, ...(curveParamsA ?? {}), hero: hero?.id }),
    queryFn: () => api.getPlayerEconomyCurve(anchorId as number, { metric, ...(curveParamsA as PlayerCurveCohortParams), hero: hero?.id }),
    retry: false,
    enabled: leagueA.show && heroScopedLeagues && curveParamsA != null,
  });
  const laneB = useQuery({
    queryKey: queryKeyFor({ ...(paramsB ?? {}), metric }),
    queryFn: () => fetcher({ ...(paramsB as CohortParams), metric }),
    retry: false,
    enabled: leagueB != null && leagueB.show && !heroScopedLeagues && paramsB != null,
  });
  const heroCmpB = useQuery({
    queryKey: queryKeys.playerEconomyCurve(anchorId ?? 0, { metric, ...(curveParamsB ?? {}), hero: hero?.id }),
    queryFn: () => api.getPlayerEconomyCurve(anchorId as number, { metric, ...(curveParamsB as PlayerCurveCohortParams), hero: hero?.id }),
    retry: false,
    enabled: leagueB != null && leagueB.show && heroScopedLeagues && curveParamsB != null,
  });

  //Metric-echo guard for the hero-scoped league responses (M1/B1(b) spirit): only trust a
  //payload that echoes the metric this panel asked for; `comparison` may also be null when
  //that hero Gold has not folded yet / rich analytics is off — both yield an empty series.
  const cmpA = heroCmpA.data?.metric === metric ? heroCmpA.data.comparison : null;
  const cmpB = heroCmpB.data?.metric === metric ? heroCmpB.data.comparison : null;

  const nA = peakSamples(heroScopedLeagues ? cmpA?.points : laneA.data?.points);
  const nB = peakSamples(heroScopedLeagues ? cmpB?.points : laneB.data?.points);
  const thinA = isThinRankSample(cohort, nA);
  const thinB = isThinRankSample(cohort, nB);
  const effA = leagueA.show && !noTierA && !thinA;
  const effB = (leagueB?.show ?? false) && !noTierB && !thinB;

  const scale = bucketScale(metric);
  const mapA = useMemo(
    () => (!effA ? new Map<number, number>() : heroScopedLeagues ? laneSeriesByMinute(cmpA, 1, viewMode, metric) : laneSeriesByMinute(laneA.data, scale, viewMode, metric)),
    [effA, heroScopedLeagues, cmpA, laneA.data, scale, viewMode, metric],
  );
  const mapB = useMemo(
    () => (!effB ? new Map<number, number>() : heroScopedLeagues ? laneSeriesByMinute(cmpB, 1, viewMode, metric) : laneSeriesByMinute(laneB.data, scale, viewMode, metric)),
    [effB, heroScopedLeagues, cmpB, laneB.data, scale, viewMode, metric],
  );
  //Each league's middle half (p25–p75), drawn as a band behind its median in the cumulative view
  //so two leagues whose medians nearly coincide still show how wide each one really is.
  const bandA = useMemo(
    () => (!effA ? new Map<number, [number, number]>() : heroScopedLeagues ? laneBandByMinute(cmpA, 1) : laneBandByMinute(laneA.data, scale)),
    [effA, heroScopedLeagues, cmpA, laneA.data, scale],
  );
  const bandB = useMemo(
    () => (!effB ? new Map<number, [number, number]>() : heroScopedLeagues ? laneBandByMinute(cmpB, 1) : laneBandByMinute(laneB.data, scale)),
    [effB, heroScopedLeagues, cmpB, laneB.data, scale],
  );

  //---- the two players' own per-minute lines ----------------------------------
  const p1Id = p1?.id ?? null;
  const p1Curve = useQuery({
    queryKey: queryKeys.playerEconomyCurve(p1Id ?? 0, { metric, vs_band: leagueB?.band, hero: p1?.hero?.id }),
    queryFn: () => api.getPlayerEconomyCurve(p1Id as number, { metric, vs_band: leagueB?.band, hero: p1?.hero?.id }),
    retry: false,
    enabled: p1 != null && p1.show,
  });
  const p1NoGames = (p1?.hero != null && p1Curve.data?.player_hero_games === 0) || (p1?.noGames ?? false);
  const p1Points = useMemo(
    () => (p1NoGames ? [] : guardedPlayerCurvePoints(p1Curve.data, metric)),
    [p1NoGames, p1Curve.data, metric],
  );
  const p1ByMinute = useMemo(() => playerSeriesByMinute(p1Points, viewMode, metric), [p1Points, viewMode, metric]);
  const hasP1Curve = p1Points.length > 0;
  //Sample-size disclosure (Component 11 / B6): the n this line actually rests on — the peak
  //per-bucket `matches` from the curve payload — and whether that n is thin (< 5 games), in
  //which case the chart line renders faint and the caption says so.
  const p1PeakN = peakPlayerMatches(p1Points);
  const p1Thin = hasP1Curve && isThinPlayerSample(p1PeakN);

  const p2Id = p2?.id ?? null;
  const p2Curve = useQuery({
    queryKey: queryKeys.playerEconomyCurve(p2Id ?? 0, { metric, vs_band: leagueB?.band, hero: p2?.hero?.id }),
    queryFn: () => api.getPlayerEconomyCurve(p2Id as number, { metric, vs_band: leagueB?.band, hero: p2?.hero?.id }),
    retry: false,
    enabled: p2 != null && p2.show,
  });
  const p2NoGames = (p2?.hero != null && p2Curve.data?.player_hero_games === 0) || (p2?.noGames ?? false);
  const p2Points = useMemo(
    () => (p2NoGames ? [] : guardedPlayerCurvePoints(p2Curve.data, metric)),
    [p2NoGames, p2Curve.data, metric],
  );
  const p2ByMinute = useMemo(() => playerSeriesByMinute(p2Points, viewMode, metric), [p2Points, viewMode, metric]);
  const hasP2Curve = p2Points.length > 0;
  const p2PeakN = peakPlayerMatches(p2Points);
  const p2Thin = hasP2Curve && isThinPlayerSample(p2PeakN);

  //---- merge onto ONE union minute grid ---------------------------------------
  const points = useMemo(
    () =>
      mergeEconSeriesByMinute(
        {
          you: effA ? mapA : null,
          cohort: effB ? mapB : null,
          player: p1?.show ? p1ByMinute : null,
          player2: p2?.show ? p2ByMinute : null,
        },
        viewMode === 'total' ? { you: effA ? bandA : null, cohort: effB ? bandB : null } : undefined,
      ),
    [effA, mapA, effB, mapB, p1, p1ByMinute, p2, p2ByMinute, viewMode, bandA, bandB],
  );

  //"Where's who" labels — every visible series is named by WHAT IT IS (league display
  //name / player name + hero), straight from the selection state.
  const labelA = leagueSeriesLabel(leagueA.name, selection);
  const labelB = leagueB ? leagueSeriesLabel(leagueB.name, selection) : null;
  const labelP1 = p1 ? playerSeriesLabel(p1) : null;
  const labelP2 = p2 ? playerSeriesLabel(p2) : null;

  const metricLabel = metrics.find((m) => m.key === metric)?.label ?? metric;
  const metricLower = metricLabel.toLowerCase();
  //'rate' → the honest "per minute" view (souls earned each minute); 'total' → cumulative.
  const isRate = viewMode === 'rate';
  //DESIGN §9: the sample window is a team-average lineage stamp only — the rank cohort is a
  //different dataset with no stamped entry here, so its caption never claims one.
  const showSampleWindow = cohort === 'team_average' && !heroScopedLeagues;
  //The SERVED cohort drives the caption — never the switch alone.
  const servedCohort: RankCohort = heroScopedLeagues
    ? (cmpA?.cohort ?? cmpB?.cohort ?? cohort)
    : (laneA.data?.cohort ?? laneB.data?.cohort ?? cohort);
  const sampleCaption = leagueSampleCaption(servedCohort, [
    effA && nA > 0 ? { name: leagueA.name, n: nA } : null,
    leagueB != null && effB && nB > 0 ? { name: leagueB.name, n: nB } : null,
  ]);

  //Loading/empty gates. isLoading (not isPending) so a DISABLED query — an unchecked
  //chip — never reads as "loading". 501/202 on the League A source keeps the existing
  //build-ahead empty-state copy.
  const activeA = heroScopedLeagues ? heroCmpA : laneA;
  const anyLoading =
    (leagueA.show && paramsA != null && activeA.isLoading) ||
    (leagueB != null && leagueB.show && paramsB != null && (heroScopedLeagues ? heroCmpB.isLoading : laneB.isLoading)) ||
    (p1 != null && p1.show && p1Curve.isLoading) ||
    (p2 != null && p2.show && p2Curve.isLoading);
  const nothingChecked = !leagueA.show && !(leagueB?.show ?? false) && !(p1?.show ?? false) && !(p2?.show ?? false);
  const emptyMessage = nothingChecked
    ? 'Everything is unchecked — toggle a league or player back into the chart in the comparison set above.'
    : noTierA
      ? 'Player rank has no cohort for Obscurus or "All ranks" — pick a league (Initiate–Eternus) above, or switch to Team average.'
      : thinA
        ? `Only ${count(nA)} players sampled at this rank — Lane Lab needs at least ${RANK_MIN_SAMPLE} to draw a per-rank curve. Try "All divisions" or Team average.`
        : leagueA.show && activeA.isError
          ? laneAheadMessage(activeA.error)
          : `No ${metricLower} data for this selection yet — try another league${cohort === 'player_rank' ? ', a wider division, or Team average' : ' or "All"'}.`;

  return (
    <div className="brass-frame" style={{ padding: '18px 20px' }}>
      <span className="corner tl" />
      <span className="corner br" />
      <div className="between" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="kicker" style={{ marginBottom: 4 }}>{kicker}</div>
          {/* Honest label tracks the data: the rate view IS souls earned per minute, so it
              says "per minute"; the total view is cumulative net worth over the match. */}
          <h2 className="h-sec" style={{ fontSize: 17 }}>
            {metricLabel} {isRate ? 'per minute' : 'over the game'}
          </h2>
        </div>
        {(nA > 0 || nB > 0) && (
          <span className="mono faint" style={{ fontSize: 12 }}>
            {thinA ? (
              <>n = {count(nA)} players sampled — below the {RANK_MIN_SAMPLE} floor for a per-rank curve</>
            ) : sampleCaption ? (
              <>
                {sampleCaption}
                {heroScopedLeagues ? <> · hero-scoped</> : null}
                {showSampleWindow && sampleWindow ? <> · {sampleWindow} sample</> : null}
              </>
            ) : null}
          </span>
        )}
      </div>
      {/* View toggle (per-minute RATE vs cumulative TOTAL) always shows; the metric toggle
          shows only when the panel serves more than one metric. */}
      <div className="flex" style={{ marginBottom: 12, gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <MetricToggle
          metrics={VIEW_MODES}
          value={viewMode}
          onChange={(m) => setViewMode(m as ViewMode)}
          ariaLabel="Curve view — per-minute rate or cumulative total"
        />
        <MetricToggle
          metrics={X_WINDOWS}
          value={xWindow}
          onChange={(w) => setXWindow(w as XWindow)}
          ariaLabel="Curve window — early game or full match"
        />
        {metrics.length > 1 && (
          <>
            <span style={{ width: 1, height: 18, background: 'var(--border-soft)', flexShrink: 0 }} aria-hidden />
            <MetricToggle metrics={metrics} value={metric} onChange={setMetric} />
          </>
        )}
      </div>
      {anyLoading && points.length === 0 ? (
        <p className="muted" style={{ padding: '24px 2px' }}>Loading the {metricLower} curves…</p>
      ) : points.length === 0 ? (
        <EmptyState
          title={`${metricLabel} curve not available yet`}
          message={emptyMessage}
          icon="chart"
        />
      ) : (
        <>
          <EconomyCurve
            data={points}
            xDomain={xDomain}
            youLabel={effA ? labelA : undefined}
            cohortLabel={effB ? (labelB ?? undefined) : undefined}
            playerLabel={p1 && p1.show && hasP1Curve ? (labelP1 ?? undefined) : undefined}
            player2Label={p2 && p2.show && hasP2Curve ? (labelP2 ?? undefined) : undefined}
            playerFaint={p1Thin}
            player2Faint={p2Thin}
            bands={!isRate}
          />
          {(effA || effB) && (
            <p className="muted" style={{ fontSize: 12, margin: '10px 0 0', lineHeight: 1.45 }}>
              {effA && (
                <>
                  The <b style={{ color: econSeriesColor.you }}>{econWords.you}</b> area is the{' '}
                  {isRate ? (
                    <>{metricLower} a <b style={{ color: econSeriesColor.you }}>{leagueA.name}</b> player earns <b>each minute</b></>
                  ) : (
                    <>median {metricLower} a <b style={{ color: econSeriesColor.you }}>{leagueA.name}</b> player has by each minute of the game; the shaded band is that league&rsquo;s middle half (p25–p75)</>
                  )}
                </>
              )}
              {effA && effB && leagueB && labelB && (
                <>
                  ; the <b style={{ color: econSeriesColor.cohort }}>{econWords.cohort} dashed</b> line is{' '}
                  <b style={{ color: econSeriesColor.cohort }}>{leagueB.name}</b>
                  {isRate ? (
                    <>. A stronger league out-earns <b>per minute</b> all game, so the gap stays visible here where the running total flattens out.</>
                  ) : (
                    <>, and the gap between them is where the lane is being won or lost.</>
                  )}
                </>
              )}
              {!effA && effB && leagueB && (
                <>
                  The <b style={{ color: econSeriesColor.cohort }}>{econWords.cohort} dashed</b> line is the{' '}
                  {metricLower} a <b style={{ color: econSeriesColor.cohort }}>{leagueB.name}</b> player{' '}
                  {isRate ? <>earns <b>each minute</b></> : <>has by each minute of the game</>}.
                </>
              )}
              {effA && !effB && <>.</>}
              {heroScopedLeagues && hero ? (
                <>
                  {' '}Both league curves are scoped to <b>{hero.name}</b> — medians of players on that hero in that league, not the all-hero curve
                  {(cmpA == null && effA) || (cmpB == null && effB) ? (
                    <> (a league with no folded sample on this hero yet is simply not drawn)</>
                  ) : null}
                  .
                </>
              ) : hero != null ? (
                <>
                  {' '}The <b>{hero.name}</b> filter is NOT applied to the league curves yet — hero-scoped league
                  medians are computed through a picked player&rsquo;s request, so add a player to the set to
                  hero-scope them. Shown all-heroes.
                </>
              ) : null}
              {' '}These are league-typical curves across all sampled players — not one player&rsquo;s matches.
            </p>
          )}
          {leagueA.show && !effA && (
            <p className="muted" style={{ fontSize: 12, margin: '6px 0 0', lineHeight: 1.45, color: 'var(--loss)' }}>
              <b>League A</b>{' '}
              {noTierA
                ? <>has no per-player-rank cohort for Obscurus or &ldquo;All ranks&rdquo; — pick Initiate–Eternus above, or switch to Team average.</>
                : <>is too thin at this rank ({count(nA)} sampled, floor {RANK_MIN_SAMPLE}) — its line is not drawn. Try {leagueA.division != null ? '"All divisions" or ' : ''}Team average.</>}
            </p>
          )}
          {leagueB && leagueB.show && !effB && (
            <p className="muted" style={{ fontSize: 12, margin: '6px 0 0', lineHeight: 1.45, color: 'var(--loss)' }}>
              <b>League B</b>{' '}
              {noTierB
                ? <>has no per-player-rank cohort for Obscurus or &ldquo;All ranks&rdquo; — pick Initiate–Eternus above, or switch to Team average.</>
                : <>is too thin at this rank ({count(nB)} sampled, floor {RANK_MIN_SAMPLE}) — its line is not drawn. Try {leagueB.division != null ? '"All divisions" or ' : ''}Team average.</>}
            </p>
          )}
          {p1 && p1.show && (
            <p className="muted" style={{ fontSize: 12, margin: '6px 0 0', lineHeight: 1.45 }}>
              {p1NoGames && p1.hero ? (
                <>
                  <b>{p1.name}</b> has <b>no games on {p1.hero.name}</b> here — nothing to compare, so their line
                  is not drawn. Change their hero scope (or the Hero selector) to bring them back.
                </>
              ) : hasP1Curve ? (
                <>
                  The <b style={{ color: econSeriesColor.player }}>{econWords.player} dashed</b> line is{' '}
                  <b>{p1.name}</b>&rsquo;s own {metricLower}
                  {p1.hero ? <> on <b>{p1.hero.name}</b></> : null}{' '}
                  {isRate ? <><b>per minute</b></> : <><b>over the game</b></>}
                  {p1.overlay ? <>, averaged across {count(p1.overlay.matches)} games</> : null}
                  {/* the n THIS LINE rests on — the curve payload's per-bucket `matches` peak,
                      not the per-game aggregate count (B6 sample-size disclosure). */}
                  {' '}(their line: n = {count(p1PeakN)} games) —{' '}
                  {isRate ? (
                    <>earned <b>each minute</b>, so you can see the minutes they out- or under-farm the leagues on the chart.</>
                  ) : (
                    <>a real personal curve that rises with the match, not a flat average.</>
                  )}
                  {p1Thin ? (
                    <>
                      {' '}<b>Thin sample:</b> fewer than {THIN_SAMPLE_MIN_MATCHES} of their games reach these
                      minutes, so the line is drawn faint — read it as an anecdote, not a trend.
                    </>
                  ) : null}
                </>
              ) : p1Curve.isFetching ? (
                <>Loading <b>{labelP1}</b>&rsquo;s {metricLower} curve…</>
              ) : (
                <>
                  No per-minute {metricLower} data for <b>{labelP1}</b> yet — no match timeline is
                  loaded for this metric, so there&rsquo;s no line to draw.
                  {p1.overlay ? <> Their per-game averages are in the stat-line above.</> : null}
                </>
              )}
            </p>
          )}
          {p2 && p2.show && (
            <p className="muted" style={{ fontSize: 12, margin: '6px 0 0', lineHeight: 1.45 }}>
              {p2NoGames && p2.hero ? (
                <>
                  <b>{p2.name}</b> has <b>no games on {p2.hero.name}</b> here — nothing to compare, so their line
                  is not drawn. Change their hero scope (or the Hero selector) to bring them back.
                </>
              ) : hasP2Curve ? (
                <>
                  The <b style={{ color: econSeriesColor.player2 }}>{econWords.player2} dashed</b> line is{' '}
                  <b>{p2.name}</b>&rsquo;s own {metricLower}
                  {p2.hero ? <> on <b>{p2.hero.name}</b></> : null}{' '}
                  {isRate ? <><b>per minute</b></> : <><b>over the game</b></>}
                  {p2.overlay ? <>, averaged across {count(p2.overlay.matches)} games</> : null}
                  {/* same B6 disclosure for the second line — its own per-bucket `matches` peak. */}
                  {' '}(their line: n = {count(p2PeakN)} games) — the <b>second</b> player in the set, so you can
                  read both players against the leagues at once.
                  {p2Thin ? (
                    <>
                      {' '}<b>Thin sample:</b> fewer than {THIN_SAMPLE_MIN_MATCHES} of their games reach these
                      minutes, so the line is drawn faint — read it as an anecdote, not a trend.
                    </>
                  ) : null}
                </>
              ) : p2Curve.isFetching ? (
                <>Loading <b>{labelP2}</b>&rsquo;s {metricLower} curve…</>
              ) : (
                <>
                  No per-minute {metricLower} data for <b>{labelP2}</b> yet — no match timeline is loaded for
                  this metric, so there&rsquo;s no second line to draw.
                  {p2.overlay ? <> Their per-game averages are in the stat-line above.</> : null}
                </>
              )}
            </p>
          )}
        </>
      )}
    </div>
  );
}

//---- the 9-min early-econ verdict bars --------------------------------------

function VerdictPanel({
  band,
  playerOverlay = null,
  playerId = null,
}: {
  band: BracketValue;
  playerOverlay?: PlayerOverlay | null;
  //the overlaid player's account id — their own souls line supplies the MEASURED 9:00 value.
  playerId?: number | null;
}) {
  const verdict = useQuery({
    queryKey: queryKeys.laneEarlyEconVerdict({ band: bandParam(band) ?? 'all' }),
    queryFn: () => api.getLaneEarlyEconVerdict({ band: bandParam(band) }),
    retry: false,
  });

  const buckets = useMemo(
    () => [...(verdict.data?.buckets ?? [])].sort((a, b) => a.souls_bucket_9min - b.souls_bucket_9min),
    [verdict.data],
  );

  //The overlaid player's MEASURED 9:00 net worth: their own souls line's 9:00 bucket (the
  //3rd 180s grid instant), averaged over their games. Falls back to the avg-pace projection
  //(captioned as an estimate) only while their line is not served.
  const soulsLine = useQuery({
    queryKey: queryKeys.playerEconomyCurve(playerId ?? 0, { metric: 'souls' }),
    queryFn: () => api.getPlayerEconomyCurve(playerId as number, { metric: 'souls' }),
    retry: false,
    enabled: playerId != null && playerOverlay != null,
  });
  const measured9 = useMemo<number | null>(() => {
    const pt = guardedPlayerCurvePoints(soulsLine.data, 'souls').find((p) => p.t_seconds === 540);
    return pt ? Math.round(pt.value) : null;
  }, [soulsLine.data]);
  const proj9 = playerOverlay ? projected9MinSouls(playerOverlay) : null;
  const souls9 = measured9 ?? proj9;
  const isMeasured = measured9 != null;
  //Which bucket the player lands in. Buckets are 1000-souls wide (souls_floor =
  //souls_bucket_9min × 1000); clamp to the nearest end if the value falls outside.
  const markedBucket = useMemo<number | null>(() => {
    if (souls9 == null) return null;
    const hit = buckets.find((b) => souls9 >= b.souls_floor && souls9 < b.souls_floor + 1000);
    if (hit) return hit.souls_bucket_9min;
    const first = buckets[0];
    const last = buckets[buckets.length - 1];
    if (!first || !last) return null;
    return souls9 < first.souls_floor ? first.souls_bucket_9min : last.souls_bucket_9min;
  }, [souls9, buckets]);

  return (
    <div className="brass-frame" style={{ padding: '16px 20px' }}>
      <span className="corner tl" />
      <span className="corner br" />
      <div className="kicker" style={{ marginBottom: 4 }}>
        9-minute verdict
      </div>
      <h2 className="h-sec" style={{ fontSize: 16, marginBottom: 4 }}>
        Does your 9-minute economy predict the win?
      </h2>
      <p className="muted" style={{ fontSize: 12.5, margin: '0 0 14px', lineHeight: 1.45 }}>
        Win rate by net worth at the 9-minute mark, for League A — find your souls bar and read how often that
        early lead converts.
      </p>
      {verdict.isPending ? (
        <p className="muted" style={{ padding: '14px 2px' }}>Loading the early-econ verdict…</p>
      ) : verdict.isError || buckets.length === 0 ? (
        <EmptyState title="Early-econ verdict not available yet" message={laneAheadMessage(verdict.error)} icon="coins" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {buckets.map((b) => {
            const winPct = b.win_rate * 100;
            const above = winPct >= 50;
            //de-emphasize thin buckets so a 3-game outlier doesn't read as signal.
            const thin = b.games < 50;
            const marked = markedBucket === b.souls_bucket_9min;
            return (
              <div key={b.souls_bucket_9min}>
                <div
                  className="flex"
                  style={{
                    alignItems: 'center',
                    gap: 10,
                    opacity: thin ? 0.6 : 1,
                    //outline (not border) so the highlight never shifts the bar layout.
                    outline: marked ? '1.5px solid var(--amber-acc)' : undefined,
                    outlineOffset: marked ? 3 : undefined,
                    borderRadius: marked ? 4 : undefined,
                  }}
                >
                  <span className="mono" style={{ width: 78, flex: 'none', fontSize: 12, color: 'var(--text-2)' }}>
                    {count(b.souls_floor / 1000)}k–{count(b.souls_floor / 1000 + 1)}k
                  </span>
                  <div style={{ flex: 1, height: 16, background: 'var(--border-soft)', borderRadius: 4, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.max(2, Math.min(100, winPct))}%`,
                        height: '100%',
                        background: above ? 'var(--win)' : 'var(--loss)',
                        borderRadius: 4,
                      }}
                    />
                  </div>
                  <span className="mono tnum" style={{ width: 52, flex: 'none', textAlign: 'right', fontSize: 12, color: above ? 'var(--win)' : 'var(--loss)' }}>
                    {pct(winPct)}
                  </span>
                  <span className="mono faint" style={{ width: 64, flex: 'none', textAlign: 'right', fontSize: 11 }}>
                    n={count(b.games)}
                  </span>
                </div>
                {marked && (
                  <div className="mono" style={{ fontSize: 10.5, color: 'var(--amber-acc)', fontWeight: 700, margin: '5px 0 0 88px' }}>
                    ◆ {playerOverlay?.label} {isMeasured ? 'lands here (measured 9:00 average)' : '≈ here (est. from avg pace)'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {playerOverlay && souls9 != null && markedBucket != null && buckets.length > 0 && (
        <p className="muted" style={{ fontSize: 12, margin: '12px 0 0', lineHeight: 1.45 }}>
          {isMeasured ? (
            <>
              The <b style={{ color: 'var(--amber-acc)' }}>◆</b> bar is where <b>{playerOverlay.label}</b> lands:{' '}
              <b>{count(souls9)} souls at 9:00</b>, measured — the average of their own games&rsquo; 9:00 net worth.
            </>
          ) : (
            <>
              The <b style={{ color: 'var(--amber-acc)' }}>◆</b> bar is where <b>{playerOverlay.label}</b> lands — an{' '}
              <b>estimate</b> (~{count(souls9)} souls at 9:00) projected from their{' '}
              {playerOverlay.souls_per_min != null ? count(playerOverlay.souls_per_min) : '—'} souls/min average,{' '}
              <b>not</b> a measured value: their per-minute line is not available yet.
            </>
          )}
        </p>
      )}
    </div>
  );
}

//---- the player-overlay picker ----------------------------------------------

//The right empty-state copy for a no-data or errored overlay, by source + error kind.
function overlayEmptyMessage(source: OverlaySource, error: unknown): string {
  if (source.isMe) {
    if (isUnauthorized(error)) return 'Sign in to overlay your own account.';
    if (isNotFound(error)) return 'Your linked account has no Normal-mode games in the loaded window yet.';
    return 'No ranked economy data on your account yet.';
  }
  if (isNotFound(error)) return `${source.player.steam_name} is private or has no ranked economy data yet.`;
  if (isDisabled(error)) return 'The per-player overlay is not available yet.';
  if (isComputing(error)) return 'Computing now — check back shortly.';
  return `No economy data for ${source.player.steam_name} yet.`;
}

function OverlaySummary({
  data,
  accent = 'player',
  isMe = false,
}: {
  data: PlayerOverlay;
  //Which econ series this overlay maps to — 'player' (amber, first) or 'player2' (coral,
  //second), so the summary names the SAME color word its line renders in.
  accent?: 'player' | 'player2';
  //The "You"/my-account source has per-game averages but NO per-minute curve endpoint,
  //so its footer says how to get a real personal line instead of implying one exists.
  isMe?: boolean;
}) {
  const econWords = useEconSeriesWords(); //active skin's series words (player/player2)
  const rk = rankFromBadge(data.badge);
  const stats: { label: string; value: string }[] = [
    { label: 'Souls / min', value: count(data.souls_per_min) },
    { label: 'Avg net worth', value: count(data.avg_net_worth) },
    { label: 'Last hits / min', value: count(data.last_hits_per_min) },
    { label: 'Kills', value: fixed(data.avg_kills, 1) },
    { label: 'Deaths', value: fixed(data.avg_deaths, 1) },
    { label: 'Assists', value: fixed(data.avg_assists, 1) },
    { label: 'Denies', value: fixed(data.avg_denies, 1) },
    { label: 'Damage', value: count(data.avg_player_damage) },
  ];
  return (
    <div style={{ marginTop: 12 }}>
      <div className="flex" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        {rk && <RankBadge tier={rk.tier} size={22} glow={false} />}
        <Chip tone="neutral">{data.label}</Chip>
        <span className="mono faint" style={{ fontSize: 12 }}>
          {rk ? getRank(rk.tier).name : 'Unranked'} · n={count(data.matches)} games
        </span>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(94px, 1fr))', gap: 8 }}>
        {stats.map((s) => (
          <div key={s.label} className="panel" style={{ padding: '8px 10px' }}>
            <div className="label-xs" style={{ fontSize: 9.5, marginBottom: 3 }}>{s.label}</div>
            <div className="mono" style={{ fontSize: 14, color: 'var(--text)' }}>{s.value}</div>
          </div>
        ))}
      </div>
      <p className="muted faint" style={{ fontSize: 11.5, margin: '10px 0 0', lineHeight: 1.45 }}>
        {data.label}&rsquo;s per-game averages across {count(data.matches)} games — an aggregate, not per-minute.{' '}
        {isMe ? (
          <>
            The account overlay carries <b>averages only</b> (they feed the 9-minute verdict marker below) — search
            your player by name to draw your own per-minute curve on the chart.
          </>
        ) : (
          <>
            The curves below draw the leagues and players in your comparison set; the{' '}
            <b style={{ color: econSeriesColor[accent] }}>{econWords[accent]}</b> line marks {data.label} on
            whichever metric is selected.
          </>
        )}
      </p>
    </div>
  );
}

//The per-player hero scope: follow the global Hero selector, ignore it (all heroes), or
//pin this player to one specific hero.
type HeroScope = 'global' | 'all' | number;

function PlayerOverlayPicker({
  overlay,
  onPick,
  onUseMe,
  onClear,
  loggedIn,
  status,
  kicker = 'Player 1',
  heading = 'Add a player to the comparison set',
  accent = 'player',
  heroScope,
  onHeroScope,
  heroOptions,
  globalHero,
  noGamesHero,
}: {
  overlay: OverlaySource | null;
  onPick: (p: SearchResult) => void;
  onUseMe: () => void;
  onClear: () => void;
  loggedIn: boolean;
  status: OverlayStatus;
  //Header copy — defaults to the primary picker's; the SECOND picker overrides both.
  kicker?: string;
  heading?: string;
  //Which econ series this picker maps to (amber 'player' / coral 'player2'), threaded into
  //the summary + intro so their color words match the line this picker's player draws in.
  accent?: 'player' | 'player2';
  heroScope: HeroScope;
  onHeroScope: (s: HeroScope) => void;
  heroOptions: readonly HeroSummary[];
  globalHero: HeroPick | null;
  noGamesHero: string | null;
}) {
  const econWords = useEconSeriesWords(); //active skin's series words (player/player2)
  const [raw, setRaw] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const listId = useId();

  useEffect(() => {
    const t = setTimeout(() => setQ(raw.trim()), 250);
    return () => clearTimeout(t);
  }, [raw]);

  const searchEnabled = q.length >= 2;
  const search = useQuery({
    queryKey: queryKeys.search(q),
    queryFn: () => api.searchPlayers(q, 8),
    enabled: searchEnabled,
  });
  const results = search.data ?? [];

  function pick(r: SearchResult) {
    onPick(r);
    setRaw('');
    setQ('');
    setOpen(false);
  }

  return (
    <div className="brass-frame" style={{ padding: '16px 20px' }}>
      <span className="corner tl" />
      <span className="corner br" />
      <div className="between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="kicker" style={{ marginBottom: 4 }}>{kicker}</div>
          <h2 className="h-sec" style={{ fontSize: 16 }}>{heading}</h2>
        </div>
        {overlay && (
          <button type="button" className="minitog" onClick={onClear}>
            Clear player
          </button>
        )}
      </div>

      <div className="flex" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div className="searchbig" style={{ minWidth: 0, maxWidth: 360, flex: '1 1 260px' }}>
          <Icon name="search" size={16} style={{ left: 12 }} />
          <input
            className="field"
            style={{ height: 38, paddingLeft: 36, fontSize: 13 }}
            placeholder="Search a player or Steam ID…"
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false);
            }}
            role="combobox"
            aria-expanded={open && searchEnabled}
            aria-controls={listId}
            aria-label="Search a player to add to the Lane Lab comparison set"
            autoComplete="off"
          />
          {open && searchEnabled && (
            <div className="search-pop panel" id={listId} role="listbox">
              {search.isFetching && results.length === 0 ? (
                <div className="search-note muted">Searching…</div>
              ) : search.isError ? (
                <div className="search-note muted">
                  {isUnauthorized(search.error) ? 'Sign in to search.' : 'Search is offline right now.'}
                </div>
              ) : results.length === 0 ? (
                <div className="search-note muted">No players found for &ldquo;{q}&rdquo;.</div>
              ) : (
                results.map((r) => {
                  const rk = rankFromBadge(r.badge);
                  return (
                    <button
                      key={r.account_id}
                      type="button"
                      className="search-row"
                      //keep input focus until the click lands so onBlur doesn't close the popup first.
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(r)}
                      role="option"
                      aria-selected="false"
                      style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      {rk && <RankBadge tier={rk.tier} size={24} glow={false} />}
                      <span className="display" style={{ flex: 1, fontWeight: 600, color: 'var(--text)' }}>
                        {r.steam_name}
                      </span>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {count(r.matches)} games
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
        {loggedIn && !overlay?.isMe && (
          <button type="button" className="minitog" onClick={onUseMe}>
            Use my account
          </button>
        )}
      </div>

      {/* Per-player hero scope (the signed-in account included). Defaults to following the
          global Hero selector; can ignore it or pin a specific hero. The no-games guard notice
          renders right here, where the scope is chosen. */}
      {overlay && (
        <div className="flex" style={{ marginTop: 10, gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="flex" style={{ alignItems: 'center', gap: 8 }}>
            <span className="label-xs">Hero scope</span>
            <select
              className="field"
              style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }}
              value={heroScope === 'global' || heroScope === 'all' ? heroScope : String(heroScope)}
              onChange={(e) =>
                onHeroScope(
                  e.target.value === 'global' ? 'global' : e.target.value === 'all' ? 'all' : Number(e.target.value),
                )
              }
              aria-label={`Hero scope for ${overlay.player.steam_name}'s line`}
            >
              <option value="global">
                Follow the Hero selector{globalHero ? ` — ${globalHero.name}` : ' — all heroes'}
              </option>
              <option value="all">All heroes (ignore the Hero selector)</option>
              {heroOptions.map((h) => (
                <option key={h.hero_id} value={h.hero_id}>
                  {h.hero_name}
                </option>
              ))}
            </select>
          </label>
          {noGamesHero && (
            <span className="mono" style={{ fontSize: 11.5, color: 'var(--loss)' }}>
              No games on {noGamesHero} — this player&rsquo;s line is excluded until the hero scope changes.
            </span>
          )}
        </div>
      )}

      {!overlay ? (
        <p className="muted faint" style={{ fontSize: 12, margin: '12px 0 0', lineHeight: 1.45, maxWidth: 480 }}>
          {accent === 'player' ? (
            <>
              Add any player to the comparison set — their per-game <b>averages</b> in the stat-line, plus their own{' '}
              <b>economy curve over the game</b> drawn in{' '}
              <b style={{ color: econSeriesColor[accent] }}>{econWords[accent]}</b> whenever their match timeline
              is loaded. Scope them to one hero to compare hero-vs-hero.
            </>
          ) : (
            <>
              Pick a <b>second</b> player — their own <b>economy curve over the game</b> draws in{' '}
              <b style={{ color: econSeriesColor[accent] }}>{econWords[accent]}</b> alongside the first player
              and the selected leagues.
            </>
          )}
        </p>
      ) : status.pending ? (
        <p className="muted" style={{ fontSize: 12.5, margin: '12px 0 0' }}>
          Loading {overlay.isMe ? 'your account' : overlay.player.steam_name}&rsquo;s economy…
        </p>
      ) : status.isError || !status.hasData ? (
        <div style={{ marginTop: 12 }}>
          <EmptyState title="No economy data for this player yet" message={overlayEmptyMessage(overlay, status.error)} icon="coins" />
        </div>
      ) : status.data ? (
        <OverlaySummary data={status.data} accent={accent} isMe={overlay.isMe ?? false} />
      ) : null}
    </div>
  );
}

//---- the Lane Lab surface ---------------------------------------------------

function LaneLabInner() {
  //League A — the primary league (BracketFilter). Defaults to Archon.
  const [band, setBand] = useState<BracketValue>(7);
  //League B — an INDEPENDENT league pick. 'auto' = one league above League A (the old
  //default experience, now just a default instead of hardcoded); a number pins any league.
  const [bandB, setBandB] = useState<number | 'auto'>('auto');
  //The global hero scope (null = all heroes) — scopes the players' lines by default and,
  //through a picked player's request, the league curves themselves.
  const [heroId, setHeroId] = useState<number | null>(null);
  const [overlay, setOverlay] = useState<OverlaySource | null>(null);
  //The SECOND compared player. Search-only — no "use my account" here (that's the first
  //picker's job; you compare yourself once), so this only ever holds { kind: 'player' }.
  const [overlayB, setOverlayB] = useState<OverlaySource | null>(null);
  //Per-player hero scopes — default to following the global Hero selector.
  const [heroScope1, setHeroScope1] = useState<HeroScope>('global');
  const [heroScope2, setHeroScope2] = useState<HeroScope>('global');
  //Checked/unchecked = in/out of the chart. Config survives an uncheck.
  const [show, setShow] = useState({ a: true, b: true, p1: true, p2: true });
  //---- the cohort switch (DESIGN §9) ------------------------------------------
  const [cohort, setCohort] = useState<RankCohort>('player_rank');
  const [cohortTouched, setCohortTouched] = useState(false);
  //Player-rank divisions (DESIGN §9: "All, I–VI" per league selector); undefined = the whole
  //league. Meaningless under team_average — cohortParamsFor ignores them there.
  const [divisionA, setDivisionA] = useState<number | undefined>(undefined);
  const [divisionB, setDivisionB] = useState<number | undefined>(undefined);
  const { viewer, loggedIn } = useViewer();
  //"Use my account" needs a linked deadlock account — the id the player-curve endpoint is keyed on.
  const myAccountId = viewer?.deadlock_account_id ?? null;

  //The shared hero catalog (same /heroes source the heroes pages read) — drives the global
  //Hero selector and both per-player scope selectors. Sorted by name for findability.
  const heroes = useQuery({ queryKey: queryKeys.heroes(), queryFn: () => api.getHeroes() });
  const heroCatalog = useMemo(
    () => [...(heroes.data ?? [])].sort((x, y) => x.hero_name.localeCompare(y.hero_name)),
    [heroes.data],
  );
  const heroPick = (id: number | null): HeroPick | null =>
    id == null ? null : { id, name: heroCatalog.find((h) => h.hero_id === id)?.hero_name ?? `Hero ${id}` };
  const globalHero = heroPick(heroId);

  const leagueAName =
    cohort === 'player_rank'
      ? typeof band === 'number' && band >= 1
        ? subLabel(band, divisionA)
        : 'All ranks'
      : band === 'all'
        ? 'All ranks'
        : getRank(band).name;
  //League B resolution: 'auto' follows League A one league up; over 'All' or the top
  //league there is nothing above, so auto resolves to none (pick explicitly instead).
  const effBandB: number | null =
    bandB === 'auto' ? (typeof band === 'number' && band < TOP_BAND ? band + 1 : null) : bandB;
  const leagueBName =
    effBandB == null
      ? null
      : cohort === 'player_rank'
        ? effBandB >= 1
          ? subLabel(effBandB, divisionB)
          : 'All ranks'
        : getRank(effBandB).name;

  //---- the cohort switch's smart default (DESIGN §9) --------------------------
  const rankTierA = typeof band === 'number' && band >= 1 ? band : undefined;
  const rankProbe = useQuery({
    queryKey: queryKeys.laneEconomyCurve({ tier: rankTierA, division: undefined, metric: 'souls' }),
    queryFn: () => api.getLaneEconomyCurve({ tier: rankTierA, metric: 'souls' }),
    retry: 2,
    enabled: !cohortTouched && rankTierA != null,
  });
  const probeState: CohortProbeState = cohortTouched
    ? 'pending'
    : rankTierA == null
      ? 'empty'
      : rankProbe.isSuccess
        //A pre-fold 202 body ({status:'computing'}) is not a curve — non-array points reads as
        //'empty', never a crash (the 2026-09-02 live TypeError).
        ? Array.isArray(rankProbe.data.points) && rankProbe.data.points.length > 0
          ? 'rows'
          : 'empty'
        : rankProbe.isError
          ? 'error'
          : 'pending';
  useEffect(() => {
    const next = defaultCohortFromProbe(probeState);
    if (next != null) setCohort(next);
  }, [probeState]);

  //Each player's EFFECTIVE hero: their own scope, defaulting to the global selection.
  const resolveScope = (scope: HeroScope): HeroPick | null =>
    scope === 'global' ? globalHero : scope === 'all' ? null : heroPick(scope);
  const hero1 = resolveScope(heroScope1);
  const hero2 = resolveScope(heroScope2);

  //The economy-curve Gold's sample window from /meta/data-horizon (Component 11) — shares
  //the page-wide singleton query cache with the header DataAgeChip, so this adds no second
  //request. Absent/erroring endpoint → null → the league captions simply omit the window.
  const horizon = useQuery({
    queryKey: queryKeys.dataHorizon(),
    queryFn: api.getDataHorizon,
    retry: false,
  });
  const sampleWindow = datasetWindowLabel(horizon.data, ECONOMY_CURVE_DATASET);

  //Picked player (or the signed-in account, isMe) → the public per-player aggregate (MAIN API).
  const pickedId = overlay?.player.account_id ?? null;
  const playerEcon = useQuery({
    queryKey: queryKeys.playerEconomy(pickedId ?? 0),
    queryFn: () => api.getPlayerEconomy(pickedId as number),
    enabled: pickedId != null,
    retry: false,
  });

  const playerOverlay = useMemo<PlayerOverlay | null>(
    () => (overlay && playerEcon.data ? overlayFromPlayer(overlay.player.steam_name, playerEcon.data) : null),
    [overlay, playerEcon.data],
  );

  const activeQuery = playerEcon;
  const status: OverlayStatus = {
    pending: overlay != null && activeQuery.isPending,
    isError: overlay != null && activeQuery.isError,
    error: activeQuery.error,
    data: playerOverlay,
    hasData: overlayHasData(playerOverlay),
  };
  //Only feed the panels an overlay that actually has data to draw.
  const liveOverlay = status.hasData ? playerOverlay : null;

  //---- second player (compare) — same public per-player aggregate, keyed on its own id ----
  const pickedIdB = overlayB?.player.account_id ?? null;
  const playerEconB = useQuery({
    queryKey: queryKeys.playerEconomy(pickedIdB ?? 0),
    queryFn: () => api.getPlayerEconomy(pickedIdB as number),
    enabled: pickedIdB != null,
    retry: false,
  });
  const playerOverlayB = useMemo<PlayerOverlay | null>(
    () => (overlayB && playerEconB.data ? overlayFromPlayer(overlayB.player.steam_name, playerEconB.data) : null),
    [overlayB, playerEconB.data],
  );
  const statusB: OverlayStatus = {
    pending: overlayB != null && playerEconB.isPending,
    isError: overlayB != null && playerEconB.isError,
    error: playerEconB.error,
    data: playerOverlayB,
    hasData: overlayHasData(playerOverlayB),
  };
  const liveOverlayB = statusB.hasData ? playerOverlayB : null;

  //Hero-scoped league curves need a player-anchored request (the hero comparison
  //rides /players/:id/economy-curve) — the first picked player anchors it.
  const anchorId = pickedId ?? pickedIdB;
  const heroScopedLeagues = globalHero != null && anchorId != null;

  //---- the no-games guard for the chips (player_hero_games) -------------------
  const guard1 = useQuery({
    queryKey: queryKeys.playerEconomyCurve(pickedId ?? 0, { metric: 'souls', vs_band: effBandB ?? undefined, hero: hero1?.id }),
    queryFn: () => api.getPlayerEconomyCurve(pickedId as number, { metric: 'souls', vs_band: effBandB ?? undefined, hero: hero1?.id }),
    retry: false,
    enabled: pickedId != null && hero1 != null,
  });
  const noGames1 = hero1 != null && guard1.data?.player_hero_games === 0;
  const guard2 = useQuery({
    queryKey: queryKeys.playerEconomyCurve(pickedIdB ?? 0, { metric: 'souls', vs_band: effBandB ?? undefined, hero: hero2?.id }),
    queryFn: () => api.getPlayerEconomyCurve(pickedIdB as number, { metric: 'souls', vs_band: effBandB ?? undefined, hero: hero2?.id }),
    retry: false,
    enabled: pickedIdB != null && hero2 != null,
  });
  const noGames2 = hero2 != null && guard2.data?.player_hero_games === 0;

  //---- assemble the ONE selection object both panels + the chips read ---------
  const p1: PlayerEntity | null =
    overlay
      ? {
          id: overlay.player.account_id,
          name: overlay.player.steam_name,
          hero: hero1,
          overlay: liveOverlay,
          show: show.p1,
          noGames: noGames1,
        }
      : null;
  const p2: PlayerEntity | null =
    overlayB
      ? {
          id: overlayB.player.account_id,
          name: overlayB.player.steam_name,
          hero: hero2,
          overlay: liveOverlayB,
          show: show.p2,
          noGames: noGames2,
        }
      : null;
  const selection: ComparisonSelection = {
    cohort,
    leagueA: { band: bandParam(band), division: divisionA, name: leagueAName, show: show.a },
    leagueB:
      effBandB != null && leagueBName != null
        ? { band: effBandB, division: divisionB, name: leagueBName, show: show.b }
        : null,
    hero: globalHero,
    heroScopedLeagues,
    anchorId,
    p1,
    p2,
  };

  return (
    //minmax(0,1fr): a 0-floored column so the Recharts chart panels can shrink below the
    //chart's intrinsic width instead of forcing a horizontal page scroll on a phone.
    <div className="grid" style={{ gap: 18, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      {/* The cohort switch (DESIGN §9) — ONE choice for the whole page, so a chart can never
          mix a player-rank curve with a team-average one. Defaults smartly (rankProbe above);
          any manual click here latches cohortTouched and the reader's pick stands from then on. */}
      <div className="brass-frame" style={{ padding: '14px 18px' }}>
        <span className="corner tl" />
        <span className="corner br" />
        <div className="flex" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div className="label-xs">Cohort</div>
          <MetricToggle
            metrics={COHORT_OPTIONS}
            value={cohort}
            onChange={(c) => {
              setCohortTouched(true);
              setCohort(c as RankCohort);
            }}
            ariaLabel="Cohort — compare against per-player rank or the team-average badge"
          />
          <span className="mono faint" style={{ fontSize: 12 }}>{cohortCaption(cohort)}</span>
        </div>
        <p className="muted faint" style={{ fontSize: 11.5, margin: '6px 0 0', maxWidth: 620, lineHeight: 1.4 }}>
          {cohort === 'player_rank'
            ? 'Player rank compares players at their OWN Valve display rank — no team-average blur. Ranked matches only, since Aug 7, 2026; recent history is still backfilling, so a league may read empty until it does.'
            : 'Team average is the lobby-average league — it compares by the match’s average badge across both teams: every match ever loaded, but an Emissary player in an Oracle-average match reads as Oracle here.'}
        </p>
      </div>

      {/* League A + League B + Hero selectors. One selection drives every panel below. */}
      <div className="between" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        <div>
          <div className="flex" style={{ alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div className="label-xs">League A</div>
            {/* Lane analytics are Normal-ONLY (022) — laning/9-min/duration concepts
                have no Brawl meaning, so the global Normal/Brawl toggle is hard-gated
                off here. Say so explicitly rather than implying Brawl curves exist. */}
            <Chip tone="neutral">Normal only</Chip>
          </div>
          <BracketFilter value={band} onChange={setBand} tiers={cohort === 'player_rank' ? RANK_TIERS : FULL_TIERS} />
          {cohort === 'player_rank' && (
            <label className="flex" style={{ alignItems: 'center', gap: 8, marginTop: 8 }}>
              <span className="label-xs">Division</span>
              <select
                className="field"
                style={{ width: 'auto', padding: '6px 10px', fontSize: 12.5 }}
                value={divisionA ?? ''}
                onChange={(e) => setDivisionA(e.target.value === '' ? undefined : Number(e.target.value))}
                aria-label="League A division — narrows the player-rank cohort to one exact display rank"
              >
                {DIVISION_OPTIONS.map((d) => (
                  <option key={d.label} value={d.value ?? ''}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="muted faint" style={{ fontSize: 11.5, margin: '6px 0 0', maxWidth: 380, lineHeight: 1.4 }}>
            {cohort === 'player_rank'
              ? 'Obscurus and "All ranks" have no per-player-rank cohort — pick Initiate–Eternus. Low/thin ranks may read empty below the 500-sample floor.'
              : 'Lane curves are Normal-mode only — Brawl has no laning data. Low ranks are sampled thinly, so their curves may be sparse or empty until more lane data lands.'}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', minWidth: 0, maxWidth: '100%' }}>
          <label className="flex" style={{ alignItems: 'center', gap: 8, minWidth: 0, maxWidth: '100%' }}>
            <span className="label-xs">League B</span>
            <select
              className="field"
              style={{ width: 'auto', minWidth: 0, maxWidth: '100%', padding: '7px 10px', fontSize: 12.5 }}
              value={bandB === 'auto' ? 'auto' : String(bandB)}
              onChange={(e) => setBandB(e.target.value === 'auto' ? 'auto' : Number(e.target.value))}
              aria-label="Choose League B — the second league to compare"
            >
              <option value="auto">
                Auto — one league above A{leagueBName && bandB === 'auto' ? ` (${leagueBName})` : band === 'all' || band === TOP_BAND ? ' (none)' : ''}
              </option>
              {RANKS.map((r) => (
                <option key={r.tier} value={r.tier}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          {cohort === 'player_rank' && (
            <label className="flex" style={{ alignItems: 'center', gap: 8, minWidth: 0, maxWidth: '100%' }}>
              <span className="label-xs">B Division</span>
              <select
                className="field"
                style={{ width: 'auto', minWidth: 0, maxWidth: '100%', padding: '6px 10px', fontSize: 12.5 }}
                value={divisionB ?? ''}
                onChange={(e) => setDivisionB(e.target.value === '' ? undefined : Number(e.target.value))}
                aria-label="League B division — narrows the player-rank cohort to one exact display rank"
              >
                {DIVISION_OPTIONS.map((d) => (
                  <option key={d.label} value={d.value ?? ''}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex" style={{ alignItems: 'center', gap: 8, minWidth: 0, maxWidth: '100%' }}>
            <span className="label-xs">Hero</span>
            <select
              className="field"
              style={{ width: 'auto', minWidth: 0, maxWidth: '100%', padding: '7px 10px', fontSize: 12.5 }}
              value={heroId ?? ''}
              onChange={(e) => setHeroId(e.target.value === '' ? null : Number(e.target.value))}
              aria-label="Scope the comparison to one hero"
            >
              <option value="">All heroes</option>
              {heroCatalog.map((h) => (
                <option key={h.hero_id} value={h.hero_id}>
                  {h.hero_name}
                </option>
              ))}
            </select>
          </label>
          <p className="muted" style={{ fontSize: 12.5, margin: 0, maxWidth: 340, textAlign: 'right' }}>
            {leagueBName ? (
              <>
                Comparing <b style={{ color: econSeriesColor.you }}>{leagueAName}</b> vs{' '}
                <b style={{ color: econSeriesColor.cohort }}>{leagueBName}</b>
                {globalHero ? <> on <b>{globalHero.name}</b></> : null}.
              </>
            ) : (
              <>
                Showing <b style={{ color: econSeriesColor.you }}>{leagueAName}</b> — pick League B to compare two
                leagues.
              </>
            )}
          </p>
        </div>
      </div>

      {/* Player 1 picker — drives the amber line on the curves + the verdict highlight. */}
      <PlayerOverlayPicker
        overlay={overlay}
        onPick={(player) => setOverlay({ kind: 'player', player })}
        onUseMe={() => {
          if (myAccountId == null) return;
          setOverlay({
            kind: 'player',
            isMe: true,
            player: { account_id: myAccountId, steam_name: 'You', badge: null, matches: 0, win_rate: null },
          });
        }}
        onClear={() => setOverlay(null)}
        loggedIn={loggedIn && myAccountId != null}
        status={status}
        heroScope={heroScope1}
        onHeroScope={setHeroScope1}
        heroOptions={heroCatalog}
        globalHero={globalHero}
        noGamesHero={noGames1 && hero1 ? hero1.name : null}
      />

      {/* Player 2 picker — search-only (no "use my account"), coral accent, so its line +
          summary read as the distinct second player. */}
      <PlayerOverlayPicker
        overlay={overlayB}
        onPick={(player) => setOverlayB({ kind: 'player', player })}
        onUseMe={() => {}}
        onClear={() => setOverlayB(null)}
        loggedIn={false}
        status={statusB}
        kicker="Player 2"
        heading="Add a second player to the comparison set"
        accent="player2"
        heroScope={heroScope2}
        onHeroScope={setHeroScope2}
        heroOptions={heroCatalog}
        globalHero={globalHero}
        noGamesHero={noGames2 && hero2 ? hero2.name : null}
      />

      {/* The "where's who" chip row — every entity in the set, in its series color, with
          its exact legend label. Uncheck = out of both charts, setup kept. */}
      <ComparisonSetChips selection={selection} onToggle={(key) => setShow((s) => ({ ...s, [key]: !s[key] }))} />

      {/* The signature economy curve — souls by default, pivotable to other metrics. */}
      <CurvePanel
        selection={selection}
        fetcher={api.getLaneEconomyCurve}
        queryKeyFor={queryKeys.laneEconomyCurve}
        metrics={econMetricsFor(cohort)}
        defaultMetric="souls"
        kicker="Souls per minute — the comparison set, league vs league vs players"
        sampleWindow={sampleWindow}
      />

      {/* The farm curve — last-hits by default, also serves souls. Same composed set. */}
      <CurvePanel
        selection={selection}
        fetcher={api.getLaneFarmCurve}
        queryKeyFor={queryKeys.laneFarmCurve}
        metrics={FARM_METRICS}
        defaultMetric="last_hits"
        kicker="Last-hits per minute — the comparison set, league vs league vs players"
        sampleWindow={sampleWindow}
      />

      <VerdictPanel band={band} playerOverlay={liveOverlay} playerId={pickedId} />
    </div>
  );
}

export default function LaneLabIsland() {
  return (
    <QueryProvider>
      <LaneLabInner />
    </QueryProvider>
  );
}
