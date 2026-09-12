//RankLock API contract — TypeScript types for the Rust/Axum JSON API.

//---- shared scalars ---------------------------------------------------------

/** A Deadlock rank badge (tier*10 + subrank); null for unranked rows. */
export type Badge = number | null;

/** Hero bracket filter accepted by `?bracket=` on hero endpoints. */
export type HeroBracket = 'low' | 'mid' | 'high' | 'top';

export type GameMode = 'Normal' | 'StreetBrawl';

export type MatchMode = 'Unranked' | 'Ranked';

//---- leaderboard / search ---------------------------------------------------

//GET /leaderboard?patch_id=&limit=&cursor=   (struct LeaderboardEntry)
export interface LeaderboardEntry {
  account_id: number;
  steam_name: string;
  badge: Badge;
  matches: number;
  wins: number;
  win_rate: number | null;
  avg_kills: number | null;
  avg_deaths: number | null;
  avg_assists: number | null;
  avg_net_worth: number | null;
}

//GET /players/search?q=&limit=   (struct SearchResult)
export interface SearchResult {
  account_id: number;
  steam_name: string;
  badge: Badge;
  matches: number;
  win_rate: number | null;
}

//---- heroes -----------------------------------------------------------------

//GET /heroes?bracket=&patch_id=   and   GET /heroes/:id/stats?bracket=
//(struct HeroSummary). `delta_win_rate_7d` is omitted unless the MV column exists.
export interface HeroSummary {
  hero_id: number;
  hero_name: string;
  icon_url: string | null;
  picks: number;
  win_rate: number | null;
  avg_kills: number | null;
  avg_deaths: number | null;
  avg_assists: number | null;
  avg_net_worth: number | null;
  avg_duration_s: number | null;
  //7-day rolling win-rate delta (win-rate momentum #17); served only when present.
  delta_win_rate_7d?: number | null;
}

//GET /heroes/:id/matchups?bracket=   (struct analytics::MatchupEntry)
export interface MatchupEntry {
  hero_b_id: number;
  matches: number;
  hero_a_wins: number;
  win_rate: number;
}

//GET /heroes/:id/counters — the upstream `hero-counter-stats` blob filtered to this hero
//(handlers/items.rs::get_hero_counters): one totals row per enemy, this hero's aggregates
//alongside the enemy's. Model the fields the hero prose reads and keep the row extensible.
export interface HeroCounterRow {
  enemy_hero_id: number;
  matches_played: number;
  [extra: string]: number;
}
export type HeroCountersResponse = HeroCounterRow[];

export interface HeroSynergyRow {
  hero_id1: number;
  hero_id2: number;
  wins: number;
  matches_played: number;
  //upstream carries additional aggregates (kills/deaths/…); not rendered.
  [extra: string]: number;
}
export type HeroSynergiesResponse = HeroSynergyRow[];

//---- hero builds (GET /heroes/:id/builds → struct TrimmedBuild[]) ------------

export interface BuildItem {
  item_id: number | null;
  annotation?: string;
}

export interface BuildCategory {
  name: string;
  description: string;
  items: BuildItem[];
}

export interface TrimmedBuild {
  //hero_id/hero_build_id ride the wire from C1 (76e92bb): they key the meta card and are the only
  //hero signal on the per-author profile list (which spans heroes). #[serde(default)] on the backend
  //means a pre-C1 cached blob decodes them as 0.
  hero_id: number;
  hero_build_id: number;
  name: string;
  author_account_id: number;
  version: number;
  num_favorites: number | null;
  num_weekly_favorites: number | null;
  last_updated_timestamp: number | null;
  ability_order?: unknown;
  categories: BuildCategory[];
}

//GET /heroes/:id/abilities (C1) — the hero's abilities (id/name/icon/slot + computed order), a
//warmed slim of the assets hero payload joined to the ability catalog. Slots with no catalog
//ability are dropped server-side.
export interface HeroAbility {
  ability_id: number;
  class_name: string;
  slot: string;
  order: number;
  name: string;
  icon_url?: string | null;
  ability_type?: string | null;
  //Upstream ability text carried through by the backend. Every key is sparse and every
  //value is HTML (inline <svg>/<img>/<span>), never plain text — strip before rendering.
  description?: {
    desc?: string | null;
    t1_desc?: string | null;
    t2_desc?: string | null;
    t3_desc?: string | null;
  };
}

//---- items (GET /items/stats) -----------------------------------------------
//The serving shape is slim and not yet frozen in a named struct; model the
//fields the UI needs and keep it extensible. Replace with ts-rs when available.
export interface ItemStat {
  item_id: number;
  item_name?: string | null;
  icon_url?: string | null;
  win_rate?: number | null;
  matches?: number | null;
  picks?: number | null;
  wins?: number | null;
  losses?: number | null;
  players?: number | null;
  //Purchase timing from the upstream row: seconds into the match, and % of match length.
  avg_buy_time_s?: number | null;
  avg_buy_time_relative?: number | null;
  avg_sell_time_s?: number | null;
  avg_sell_time_relative?: number | null;
  //Items §3 "Most bought on" (C12). ABSENT for an item the item_hero_stats fold has no
  //row for — the column is additive, never a null the table has to special-case.
  top_hero?: ItemTopHero;
}

export interface ItemTopHero {
  hero_id: number;
  share_of_games: number;
}

//---- matches ----------------------------------------------------------------

//GET /matches/recent   (struct MatchRow)
export interface MatchRow {
  match_id: number;
  start_time: string;
  duration_s: number;
  match_mode: string | null;
  game_mode: string | null;
  average_badge_team0: Badge;
  average_badge_team1: Badge;
  winning_team: number | null;
}

//GET /matches/:id → players[]   (struct MatchPlayerDetail)
export interface MatchPlayerDetail {
  account_id: number;
  steam_name: string;
  hero_id: number;
  hero_name: string;
  icon_url: string | null;
  team: number;
  winner: boolean;
  kills: number;
  deaths: number;
  assists: number;
  net_worth: number;
  last_hits: number;
  denies: number;
  damage_dealt: number;
  damage_taken: number;
  badge: Badge;
}

//GET /matches/:id   (struct MatchDetail)
export interface MatchDetail {
  match_id: number;
  start_time: string;
  duration_s: number;
  match_mode: string | null;
  game_mode: string | null;
  average_badge_team0: Badge;
  average_badge_team1: Badge;
  winning_team: number | null;
  players: MatchPlayerDetail[];
}

//---- match inspect (GET /matches/:id/inspect) -------------------------------

//One purchased item in a player's build. Array order = BUY order.
export interface MatchInspectItem {
  item_id: number;
  //null when the code decodes but the catalog carries no name/icon yet (still renders).
  item_name: string | null;
  icon_url: string | null;
  bought_s: number | null;
  //null when never sold (upstream sold_time_s==0 self-sparsifies to a null element).
  sold_s: number | null;
}

//One stored timeline sample (ascending t_seconds). `souls` = net worth at t.
export interface MatchInspectTimelinePoint {
  t_seconds: number;
  souls: number;
  last_hits: number;
  kills: number;
  deaths: number;
  assists: number;
  player_damage: number;
}

//One ability in level-up order. Served only once the ability tier ships (C1
//deferred it) — optional, so the UI renders it when present and skips it until then.
export interface MatchInspectAbility {
  ability_id: number;
  ability_name: string | null;
  icon_url: string | null;
  leveled_s: number | null;
}

export interface MatchInspectPlayer {
  account_id: number;
  steam_name: string;
  hero_id: number;
  hero_name: string;
  hero_icon_url: string | null;
  team: number;
  items: MatchInspectItem[];
  souls_timeline: MatchInspectTimelinePoint[];
  //present only once the deferred ability tier ships; absent today.
  abilities?: MatchInspectAbility[];
}

export interface MatchInspect {
  match_id: number;
  //null until migration 051 lands (never a 500); the empty-state reads "the last N days".
  window_days: number | null;
  in_window: boolean;
  players: MatchInspectPlayer[];
}

//---- players ----------------------------------------------------------------

//Recent-form add-on, flattened sibling on the player profile (analytics::RecentForm).
export interface RecentForm {
  wins: number;
  losses: number;
  total: number;
  label: string;
}

//GET /players/:id   (struct PlayerProfileResponse = PlayerProfile + recent_form)
export interface PlayerProfileResponse {
  account_id: number;
  steam_name: string;
  badge: Badge;
  matches: number | null;
  wins: number | null;
  win_rate: number | null;
  avg_kills: number | null;
  avg_deaths: number | null;
  avg_assists: number | null;
  avg_net_worth: number | null;
  recent_form: RecentForm;
}

//GET /players/:id/matches?limit=&cursor=&hero_id=&game_mode=&match_mode=   (struct PlayerMatchRow)
export interface PlayerMatchRow {
  match_id: number;
  start_time: string;
  hero_id: number;
  hero_name: string;
  winner: boolean;
  kills: number;
  deaths: number;
  assists: number;
  net_worth: number;
  duration_s: number | null;
  game_mode: string | null;
  match_mode: string | null;
}

//GET /players/:id/mmr   (struct MMRHistoryRow)
export interface MMRHistoryRow {
  record_date: string;
  badge: Badge;
  match_count: number;
}

//GET /players/:id/heroes  — per-hero ledger (analytics::HeroLedgerRow)
export interface HeroLedgerRow {
  hero_id: number;
  hero_name: string;
  icon_url: string | null;
  matches: number;
  wins: number;
  win_rate: number | null;
  avg_kills: number | null;
  avg_deaths: number | null;
  avg_assists: number | null;
  avg_net_worth: number | null;
  kda: number | null;
  last_played: string;
}

//GET /players/:id/heroes-played   (improve::HeroPlayed)
export interface HeroPlayed {
  hero_id: number;
  hero_name: string;
  matches_played: number;
  last_played: string;
}

//GET /players/:id/badge-history   (analytics::BadgeHistoryRow)
export interface BadgeHistoryRow {
  start_time: string;
  badge: number;
}

//GET /players/:id/performance   (analytics::PerformanceResponse / PercentileRow)
export interface PercentileRow {
  bracket: number;
  bracket_label: string;
  kda_pct: number | null;
  kd_pct: number | null;
  net_worth_pct: number | null;
  win_rate_pct: number | null;
  sample_matches: number;
}

export interface PerformanceResponse {
  account_id: number;
  fresh_as_of: string | null;
  brackets: PercentileRow[];
}

//---- rank-up readiness: GET /players/:id/readiness (readiness.rs) ------------

//One player-vs-target metric row; the array arrives ranked worst-gap-first.
export interface ReadinessMetric {
  metric: string;
  user_avg: number;
  target_p50: number;
  delta_pct: number;
  met: boolean;
}

//The zero-matches variant returns only the base fields plus
//status:"no_matches_in_window", so the bracket/sample fields are optional.
export interface ReadinessResponse {
  account_id: number;
  window: string;
  matches_in_window: number;
  current_badge?: number | null;
  current_bracket?: number;
  current_bracket_label?: string;
  target_bracket?: number;
  target_bracket_label?: string;
  clamped?: boolean;
  cohort_sample_matches?: number;
  metrics_met: number;
  metrics_total: number;
  ready: boolean;
  metrics: ReadinessMetric[];
  fresh_as_of?: string | null;
  status?: string;
}

//---- compare ("LeagueCompare") — GET /players/:id/compare -------------------

export interface CompareYou {
  matches: number;
  badge: number;
  tier: number;
  tier_name: string;
  avg_net_worth: number | null;
  souls_per_min: number | null;
  avg_last_hits: number | null;
  last_hits_per_min: number | null;
  avg_denies: number | null;
  avg_kills: number | null;
  avg_deaths: number | null;
  avg_assists: number | null;
  avg_damage: number | null;
  damage_per_min: number | null;
  //Date span of the games in scope (ISO-8601); null on a 0-game side.
  span_from: string | null;
  span_to: string | null;
}

//Echo of the window the server applied. kind "all" (n null) = all loaded games;
//"games"/"days" carry the chosen n.
export interface CompareWindow {
  kind: 'all' | 'games' | 'days';
  n: number | null;
}

//On hero_id=0 (all heroes) there is no cohort row: every metric is null,
//sample_size 0, deltas/efficiency ratios null, standing "per_hero_only".
export interface CompareCohort {
  tier: number;
  tier_name: string;
  badge_lo: number;
  badge_hi: number;
  sample_size: number;
  avg_net_worth: number | null;
  souls_per_min: number | null;
  avg_last_hits: number | null;
  last_hits_per_min: number | null;
  avg_denies: number | null;
  avg_kills: number | null;
  avg_deaths: number | null;
  avg_assists: number | null;
  avg_damage: number | null;
  damage_per_min: number | null;
}

export interface CompareDeltas {
  net_worth: number | null;
  souls_per_min: number | null;
  last_hits: number | null;
  denies: number | null;
}

export interface CompareEfficiency {
  souls_per_min_ratio: number | null;
  net_worth_ratio: number | null;
  last_hits_per_min_ratio: number | null;
  kda_ratio: number | null;
  standing: string;
  note: string;
}

export interface CompareResponse {
  account_id: number;
  hero_id: number;
  hero_name: string;
  league_offset: string;
  clamped: boolean;
  window: CompareWindow;
  you: CompareYou;
  cohort: CompareCohort;
  deltas: CompareDeltas;
  efficiency: CompareEfficiency;
}

export interface ComparePlayerResponse {
  account_id: number;
  vs_account_id: number;
  hero_id: number;
  hero_name: string;
  shared_hero: boolean;
  window: CompareWindow;
  you: CompareYou;
  them: CompareYou;
  deltas: CompareDeltas;
  efficiency: CompareEfficiency;
}

//---- improve ("Improve" coaching) — GET /players/:id/improve ----------------

export interface MetricComparison {
  user_avg: number;
  cohort_p25: number | null;
  cohort_p50: number | null;
  cohort_p75: number | null;
  delta_vs_p50_pct: number | null;
  user_matches: number[];
}

export interface ImproveMetrics {
  net_worth: MetricComparison;
  denies: MetricComparison;
  last_hits: MetricComparison;
  kills: MetricComparison;
  deaths: MetricComparison;
  assists: MetricComparison;
  damage_dealt: MetricComparison;
}

export interface ImproveCallout {
  metric: string;
  user_avg: number;
  cohort_p50: number;
  delta_pct: number;
}

export interface ImproveResponse {
  account_id: number;
  hero_id: number;
  hero_name: string;
  bracket: number;
  bracket_label: string;
  window: string;
  matches_in_window: number;
  avg_game_duration_s: number;
  duration_bucket: number;
  duration_bucket_label: string;
  cohort_sample_matches: number;
  metrics: ImproveMetrics;
  improve_callouts: ImproveCallout[];
  fresh_as_of: string | null;
}

//---- stats ------------------------------------------------------------------

//GET /stats/rank-distribution → RankPopulationRow[] (analytics.rank_population,
//migration 057). Ranked player-games per Valve rank at the busiest 180s bucket;
//share_pct sums to 100 within each (game_mode, match_mode) pair.
export interface RankPopulationRow {
  rank: number;
  tier: number;
  division: number;
  player_count: number;
  share_pct: number;
  computed_at: string;
  game_mode: string;
  match_mode: string;
  reference_minute: number;
}

//---- patches (GET /patches*, fully built backend; wired in C9) ---------------
//Modeled on the backend structs in deadlock-backend/src/handlers/patches.rs.

//GET /patches → Patch[]   and   GET /patches/current → Patch   (struct Patch)
export interface Patch {
  patch_id: string;
  version_label: string;
  released_at: string;
  ended_at: string | null;
  notes_url: string | null;
  notes_summary: string | null;
  is_current: boolean;
}

//One hero's per-bracket stat line within a patch (struct PatchHeroStat). The
//`delta_*` fields are null on the first seeded patch (no previous to diff).
export interface PatchHeroStat {
  hero_id: number;
  hero_name: string;
  icon_url: string | null;
  bracket: number;
  pick_rate: number;
  win_rate: number | null;
  matches: number;
  delta_pick_rate: number | null;
  delta_win_rate: number | null;
}

//GET /patches/:id?bracket=   (struct PatchDetail)
export interface PatchDetail {
  patch: Patch;
  prev_patch_id: string | null;
  hero_stats: PatchHeroStat[];
}

//GET /patches/:id/movers?bracket=&limit=   (struct Movers) — top gainers/losers
//by delta_pick_rate; both arrays empty when delta_pick_rate IS NULL.
export interface PatchMovers {
  gainers: PatchHeroStat[];
  losers: PatchHeroStat[];
}

//---- Build Lab (GET /heroes/base-stats, /items/modifiers) --------------------
//Modeled on deadlock-backend/src/handlers/builds.rs.

//GET /heroes/base-stats?patch_id=  and  /heroes/:id/base-stats (struct HeroBaseStats).
//`stats` is the raw upstream starting_stats object — keyed display labels are a UI
//concern. `source` is "snapshot" (versioned table) or "live" (assets-API fallback).
export interface HeroBaseStats {
  hero_id: number;
  hero_name: string;
  patch_id: string;
  fetched_at: string | null;
  source: string;
  stats: Record<string, unknown>;
}

//GET /items/modifiers?slot=&tier=  — the buildable-item modifier blob (builds.rs
//build_item_modifiers). `modifiers` is the raw upstream property rows; rendered as
//a count + on demand. Keep extensible.
export interface ItemModifier {
  item_id: number | null;
  item_name: string | null;
  item_slot_type: string | null;
  item_tier: number | null;
  shop_image_webp: string | null;
  cost: number | null;
  modifiers: unknown[];
}

//---- Lane Lab (rich-analytics tier, RICH_ANALYTICS_ENABLED gate) -------------

export interface LaneCurvePoint {
  minute_bucket: number;
  //wall-clock seconds at this point (= minute_bucket * 180).
  t_seconds: number;
  sample_players: number;
  p25: number | null;
  p50: number | null;
  p75: number | null;
}
export type RankCohort = 'player_rank' | 'team_average';
export interface LaneCurveResponse {
  band: number | null;
  cohort: RankCohort;
  rank: number | null;
  tier: number | null;
  division: number | null;
  metric: string;
  points: LaneCurvePoint[];
}

//GET /lane-lab/early-econ-verdict?band=  (VerdictResponse). Per-9-min-souls-bucket
//win rate (wins/games, 0..1) — "does your 9-minute economy predict the win?".
//souls_floor = souls_bucket_9min * 1000 (the bucket's lower souls edge).
export interface EarlyEconVerdictBucket {
  souls_bucket_9min: number;
  souls_floor: number;
  games: number;
  wins: number;
  win_rate: number;
}
export interface EarlyEconVerdictResponse {
  band: number | null;
  buckets: EarlyEconVerdictBucket[];
}

export interface PlayerEconomy {
  account_id: number;
  matches: number;
  badge: number;
  //tier = badge / 10 (0..11).
  tier: number;
  avg_net_worth: number | null;
  souls_per_min: number | null;
  last_hits_per_min: number | null;
  //Per-game AVERAGE totals for every other metric the Lane Lab overlay surfaces
  //(extended in the backend's PLAYER_ECONOMY_SQL). avg_player_damage reads the
  //match_players `damage_dealt` column. All null when the player has no matches.
  avg_kills: number | null;
  avg_deaths: number | null;
  avg_assists: number | null;
  avg_denies: number | null;
  avg_player_damage: number | null;
}

export interface PlayerCurvePoint {
  minute_bucket: number;
  //wall-clock seconds at this point (= minute_bucket * 180).
  t_seconds: number;
  //real units for the active metric (souls = net_worth, last_hits = raw count).
  value: number;
  //how many of the player's matches contributed to this bucket's average.
  matches: number;
}
export interface PlayerCurveComparisonPoint {
  minute_bucket: number;
  t_seconds: number;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  sample_players: number;
}
export interface PlayerCurveComparison {
  //the selected league (rank tier 0..11, badge/10); null = all-bands cohort, or any rank cohort.
  band: number | null;
  //the selected hero, or null for the all-hero cohort.
  hero_id: number | null;
  //"cohort-gold" (band histogram Gold) | "cohort-gold-hero" (band x hero histogram Gold, migration
  //043) | "cohort-rank-hero" (rank x hero histogram Gold, migration 052, DESIGN §8).
  source: string;
  cohort: RankCohort;
  //DESIGN §8: the display rank/tier/division this comparison resolved to; null unless `cohort` is
  //'player_rank' (division is also null at league level — a bare tier with no division picked).
  rank: number | null;
  tier: number | null;
  division: number | null;
  points: PlayerCurveComparisonPoint[];
}
export interface PlayerEconomyCurveResponse {
  account_id: number;
  metric: string;
  points: PlayerCurvePoint[];
  you: PlayerCurvePoint[];
  comparison: PlayerCurveComparison | null;
  //Serialized ONLY when `hero=` was sent: how many Unranked/Normal matches the player has on
  //that hero (the no-games guard input). 0 ⇒ the player never played the hero here — `you` is
  //served EMPTY (never a silent all-heroes fallback) and the UI must not draw their series.
  player_hero_games?: number;
}

export interface SoulsCohortPoint {
  minute_bucket: number;
  //wall-clock seconds at this point (= minute_bucket * 180).
  t_seconds: number;
  //the tier's average souls FROM THIS SOURCE at this bucket (real souls).
  souls_avg: number;
  player_count: number;
}
export interface SoulsPlayerPoint {
  minute_bucket: number;
  t_seconds: number;
  souls_avg: number;
  //how many of the player's matches reached this bucket.
  matches: number;
}
export interface SoulsCohortGroupSeries {
  souls_group: string;
  points: SoulsCohortPoint[];
}
export interface SoulsPlayerGroupSeries {
  souls_group: string;
  points: SoulsPlayerPoint[];
}
export interface SoulsCohortResponse {
  band: number | null;
  match_mode: MatchMode;
  groups: SoulsCohortGroupSeries[];
}
export interface PlayerSoulsResponse {
  account_id: number;
  hero_id: number | null;
  match_mode: MatchMode;
  groups: SoulsPlayerGroupSeries[];
  //Present ONLY when ?hero= was sent: the player's match count on that hero (0 ⇒ empty series).
  player_hero_games?: number;
}

export interface HeroItemWinRate {
  item_id: number;
  item_name?: string | null;
  icon_url?: string | null;
  win_rate?: number | null;
  games?: number | null;
  wins?: number | null;
  wilson_lower?: number | null;
}

//---- auth / session ---------------------------------------------------------

//GET /me   (auth_email::UserContext). 401 when not logged in.
export interface CurrentUser {
  id: number;
  display_name: string;
  email: string | null;
  deadlock_account_id: number | null;
}

//---- health -----------------------------------------------------------------

//GET /health — liveness probe (the only route guaranteed to serve pre-data).
export interface HealthResponse {
  status: string;
}

//---- freshness metadata ------------------------------------------------------

export interface DataHorizonDatasetWindow {
  dataset: string;
  window_lo: string | null;
  window_hi: string | null;
  computed_at: string | null;
}
export interface DataHorizonResponse {
  max_match_start_time: string | null;
  datasets: DataHorizonDatasetWindow[];
}

//---- hero build stats (GET /heroes/:id/build-stats) --------------------------

//E1: item sets and per-position buy order over our own matches. `tier` is served only as 0
//(all ranks) today; 501 while the analytics tier is gated off, 202 until the first fold, and
//200 with empty arrays once folded but below the 200-game floor.
export interface BuildStatsItem {
  item_id: number;
  item_name?: string | null;
  icon_url?: string | null;
}

export interface BuildStatsItemSet {
  items: BuildStatsItem[];
  games: number;
  wins: number;
  win_rate: number;
  wilson_lower: number;
}

export interface BuildStatsBuyOrderRow extends BuildStatsItem {
  pos: number;
  games: number;
  wins: number;
  win_rate: number;
  wilson_lower: number;
}

export interface HeroBuildStats {
  hero_id: number;
  tier: number;
  match_mode: MatchMode;
  game_mode: GameMode;
  item_sets: BuildStatsItemSet[];
  buy_order: BuildStatsBuyOrderRow[];
}

//E2 (?scored=1): the same list in the same upstream order, annotated. `label` renders VERBATIM —
//the UI never composes a score string, and renders no score element at all when `score` is null.
export interface BuildScore {
  kind: 'item_set' | 'item_average';
  win_rate: number;
  games: number;
  coverage?: { covered: number; total: number } | null;
  label: string;
}

export interface ScoredBuild extends TrimmedBuild {
  author_name: string | null;
  score: BuildScore | null;
}

//---- rank-bracketed + community builds (C2-C4) ------------------------------

//Upstream hero-build-stats numbers for one published build: rolling 30 days at a
//lobby-average badge floor. Every field is null when upstream carries no row at
//the floor — the build keeps its place in the list either way.
export interface CommunityStats {
  win_rate_30d: number | null;
  matches: number | null;
  wins: number | null;
  players: number | null;
}

//GET /heroes/:id/builds?scored=1 element — the scored build with its 30-day numbers
//flattened on (hero_builds.rs `CommunityBuild`).
export interface CommunityBuild extends ScoredBuild, CommunityStats {}

//GET /builds/:build_id — one build by id, hero_id riding the body, same flattening.
export interface BuildById extends TrimmedBuild, CommunityStats {}

//The four served rank brackets; the badge bounds resolve server-side, so no badge
//arithmetic crosses the wire.
export type RankedBracketKey = 'initiate-sentinel' | 'mystic-emissary' | 'oracle-phantom' | 'ascendant-eternus';

export interface RankedBracketInfo {
  key: string;
  min_badge: number;
  max_badge: number;
}

export interface RankedBuild extends TrimmedBuild {
  matches: number;
  wins: number;
  win_rate: number;
  wilson_lower: number;
}

//GET /heroes/:id/builds/ranked?bracket= — top builds inside one bracket, Wilson-lower sorted.
export interface RankedBuildsResponse {
  bracket: RankedBracketInfo;
  min_matches: number;
  window: string;
  source: string;
  builds: RankedBuild[];
}

//---- ability orders (GET /heroes/:id/ability-orders) -------------------------

//`abilities` is the raw ability-id sequence in level order; length is NOT fixed
//(12..16 all ride live) and ids exceed 2^31, so they arrive as plain numbers.
export interface AbilityOrder {
  abilities: number[];
  wins: number;
  losses: number;
  matches: number;
  players: number;
  win_rate: number;
}

export interface AbilityOrdersResponse {
  min_matches: number;
  window: string;
  source: string;
  orders: AbilityOrder[];
}

//---- item timing / detail / pairs / per-rank WR / heroes (C6-C9, C12) --------

//GET /items/:id/timing — one row per game minute, plus the purchase-minute quartiles.
export interface ItemTimingBucket {
  bucket: number;
  matches: number;
  wins: number;
  win_rate: number;
  avg_buy_time_s: number;
}

export interface ItemTimingResponse {
  item_id: number;
  buckets: ItemTimingBucket[];
  p25: number | null;
  p50: number | null;
  p75: number | null;
  total_matches: number;
  window: string;
  source: string;
}

//One resolved component-tree edge (a component of, or a parent built from, this item).
export interface ItemEdge {
  item_id: number;
  class_name: string;
  item_name: string;
  icon_url: string | null;
}

//Valve's item text, split by role. Each key is OMITTED when upstream has no text for it.
export interface ItemDetailText {
  desc?: string;
  passive?: string;
  active?: string;
}

//GET /items/:id/detail. `cooldown` is absent (never null) on a passive item.
export interface ItemDetailResponse {
  item_id: number;
  class_name: string;
  item_name: string;
  item_slot_type: string | null;
  item_tier: number | null;
  cost: number | null;
  shop_image_webp: string | null;
  is_shop_item: boolean;
  modifiers: unknown[];
  activation: string | null;
  is_active_item: boolean;
  cooldown?: number;
  text: ItemDetailText;
  text_key: string;
  components: ItemEdge[];
  builds_into: ItemEdge[];
  source: string;
}

//GET /items/:id/pairs. win_rate_delta is null whenever the item's own base rate is
//unknown — render no Δ rather than one measured against a guess.
export interface ItemPair {
  item_id: number;
  matches: number;
  wins: number;
  win_rate: number;
  win_rate_delta: number | null;
}

export interface ItemPairsResponse {
  item_id: number;
  pairs: ItemPair[];
  base_win_rate: number | null;
  min_matches: number;
  window: string;
  source: string;
}

//GET /items/:id/win-rate-by-rank — the 11 RANKED tiers (Obscurus is excluded as
//unranked). `thin` marks a tier under `thin_below` matches; win_rate is null at zero.
export interface ItemRankWinRate {
  tier: number;
  name: string;
  min_badge: number;
  max_badge: number;
  matches: number;
  wins: number;
  win_rate: number | null;
  thin: boolean;
}

export interface ItemRankWinRatesResponse {
  item_id: number;
  tiers: ItemRankWinRate[];
  thin_below: number;
  window: string;
  source: string;
}

//GET /items/:id/heroes — who buys this item, from our own matches.
export interface ItemHeroShare {
  hero_id: number;
  share_of_games: number | null;
  win_rate: number | null;
  games: number;
}

export interface ItemHeroesResponse {
  item_id: number;
  heroes: ItemHeroShare[];
  item_games: number;
  computed_at?: string;
  window: string;
  source: string;
}

//---- hero assets slim (GET /heroes/:id/assets) -------------------------------

export interface HeroDescription {
  lore?: string;
  playstyle?: string;
  role?: string;
}

//`stat` is upstream's specific_stat_scale_type (ETechPower, ETechCooldown, …).
export interface HeroAbilityScaling {
  stat?: string;
  scale?: number;
  function?: string;
}

export interface HeroAbilityProperty {
  name: string;
  value: unknown;
  label?: string;
  unit?: string;
  kind?: string;
  scaling?: HeroAbilityScaling;
}

//`bonus` arrives as a number OR a numeric string upstream — parse at the call site.
export interface HeroAbilityUpgrade {
  name: string;
  bonus?: unknown;
}

export interface HeroAbilityTier {
  tier: number;
  upgrades: HeroAbilityUpgrade[];
  description?: string;
}

export interface HeroAbilityNumerics {
  ability_id: number;
  class_name: string;
  slot: string;
  order: number;
  name?: string;
  ability_type?: string;
  icon_url?: string;
  description?: string;
  properties: HeroAbilityProperty[];
  tiers: HeroAbilityTier[];
}

//Every optional key is ABSENT when upstream omits it — an absent scaling row must read
//as absent, never as an invented null. `abilities_source` stamps where the per-tier
//numerics came from.
export interface HeroAssetsResponse {
  hero_id: number;
  hero_name?: string;
  window: string;
  source: string;
  abilities_source: string;
  description?: HeroDescription;
  tags?: unknown;
  complexity?: unknown;
  images?: unknown;
  starting_stats?: unknown;
  scaling_stats?: unknown;
  standard_level_up_upgrades?: unknown;
  level_info?: unknown;
  item_slot_info?: unknown;
  cost_bonuses?: unknown;
  purchase_bonuses?: unknown;
  abilities: HeroAbilityNumerics[];
}
