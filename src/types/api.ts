//============================================================================
//RankLock API contract — TypeScript types for the Rust/Axum JSON API.
//
//   TODO: replace with ts-rs output
//
//These types are HAND-WRITTEN against the documented route list + the backend
//response structs (deadlock-backend/src/main.rs + src/handlers/*.rs) as of
//2026-06-19. The backend DTOs do NOT yet derive `ts_rs::TS`, so there is no
//generated source of truth. When the Rust side adds `#[derive(TS)]` +
//`#[ts(export)]` to its response structs, regenerate this file in CI
//(architecture §7.3 / requirements §A.2) and delete the hand-written bodies
//below. Until then, keep these in sync with the structs by hand.
//
//Conventions: Rust `Option<T>` → `T | null` (or `field?:` where the field is
//`skip_serializing_if = "Option::is_none"`); `DateTime<Utc>`/`NaiveDate` →
//ISO-8601 `string`; `i64/i32/f64` → `number`; `serde_json::Value` → `unknown`.
//============================================================================

//---- shared scalars ---------------------------------------------------------

/** A Deadlock rank badge (tier*10 + subrank); null for unranked rows. */
export type Badge = number | null;

/** Hero bracket filter accepted by `?bracket=` on hero endpoints. */
export type HeroBracket = 'low' | 'mid' | 'high' | 'top';

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

//GET /heroes/:id/counters passes through an upstream/analytics shape that is not
//yet frozen — keep loose (the Matchups tab is powered by /heroes/:id/matchups).
export type HeroCountersResponse = unknown;

//GET /heroes/:id/synergies — the backend filters the upstream `hero-synergy-stats`
//rows down to pairs that include this hero (hero_id1 OR hero_id2) and passes them
//through verbatim (main.rs::get_hero_synergies). Model the fields the matrix needs
//and keep the row extensible (the upstream blob carries more we don't render).
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
  name: string;
  author_account_id: number;
  version: number;
  num_favorites: number | null;
  num_weekly_favorites: number | null;
  last_updated_timestamp: number | null;
  ability_order?: unknown;
  categories: BuildCategory[];
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

//GET /players/:id/matches?limit=&cursor=&hero_id=   (struct PlayerMatchRow)
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
}

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
  you: CompareYou;
  cohort: CompareCohort;
  deltas: CompareDeltas;
  efficiency: CompareEfficiency;
}

//GET /players/:id/compare-player?vs=&hero_id=  — you vs a SPECIFIC other player on
//a shared hero. Mirrors CompareResponse, but the comparison term is another PLAYER
//("them") rather than a rank cohort; `them` reuses the per-player CompareYou shape
//(identical metric set, plus the other player's tier/name for labeling). A 404 means
//the two never overlapped on the chosen hero — the picker empty-states that case.
export interface ComparePlayerResponse {
  account_id: number;
  vs_account_id: number;
  hero_id: number;
  hero_name: string;
  you: CompareYou;
  them: CompareYou;
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

//GET /stats/rank-distribution   (analytics::RankBucket[]). NOTE: data-broken
//today (job reads players.badge which is all-NULL) → may return []. Empty-state it.
export interface RankBucket {
  badge: number;
  player_count: number;
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
//Modeled on deadlock-backend/src/handlers/lane_lab.rs. Cohort curves are
//reconstructed at READ time from the additive counting histograms, so 501
//(feature off) / 202 (producers haven't run) are the expected pre-data states —
//handle via isDisabled/isComputing, never as a hard error.

//GET /lane-lab/economy-curve?band=&metric=  and  /lane-lab/farm-curve (CurveResponse).
//One point per 180s grid index. p25/p50/p75 are VALUE-BUCKET indices, not raw
//units — the per-metric encoding (souls = net_worth/1000; last_hits/kills/… = raw
//count) means real souls = p50 * 1000. p* are null when a minute has no samples.
//`band` = rank tier (badge/10, 0..11); null when all bands were aggregated.
export interface LaneCurvePoint {
  minute_bucket: number;
  //wall-clock seconds at this point (= minute_bucket * 180).
  t_seconds: number;
  sample_players: number;
  p25: number | null;
  p50: number | null;
  p75: number | null;
}
export interface LaneCurveResponse {
  band: number | null;
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
