//Typed HTTP/JSON client for the RankLock Rust/Axum API (api.ranklock.app).
import type {
  AbilityOrdersResponse,
  BadgeHistoryRow,
  BuildById,
  CommunityBuild,
  CompareResponse,
  ComparePlayerResponse,
  CurrentUser,
  DataHorizonResponse,
  EarlyEconVerdictResponse,
  GameMode,
  HealthResponse,
  HeroAbility,
  HeroAssetsResponse,
  HeroBracket,
  HeroBuildStats,
  HeroCountersResponse,
  HeroItemWinRate,
  HeroBaseStats,
  HeroLedgerRow,
  HeroPlayed,
  HeroSummary,
  HeroSynergiesResponse,
  ImproveResponse,
  ItemDetailResponse,
  ItemHeroesResponse,
  ItemModifier,
  ItemPairsResponse,
  ItemRankWinRatesResponse,
  ItemStat,
  ItemTimingResponse,
  LaneCurveResponse,
  LeaderboardEntry,
  MatchDetail,
  MatchInspect,
  MatchMode,
  MatchRow,
  MatchupEntry,
  MMRHistoryRow,
  Patch,
  PatchDetail,
  PatchMovers,
  PerformanceResponse,
  PlayerEconomy,
  PlayerEconomyCurveResponse,
  PlayerMatchRow,
  PlayerProfileResponse,
  PlayerSoulsResponse,
  RankedBuildsResponse,
  RankPopulationRow,
  ReadinessResponse,
  SearchResult,
  SoulsCohortResponse,
  TrimmedBuild,
} from '../types/api';
//Fills item_name/icon_url the stats endpoints leave null (see itemCatalog.ts).
import { enrichItems, isPublicItem } from './itemCatalog';
import type { BuildSort } from './buildMeta';

export const API_BASE: string =
  import.meta.env.PUBLIC_API_BASE_URL?.replace(/\/+$/, '') ?? 'https://api.ranklock.app';

export const LANE_LAB_BASE: string =
  import.meta.env.PUBLIC_LANE_LAB_BASE_URL?.replace(/\/+$/, '') ?? API_BASE;

//A non-2xx (or transport) failure, carrying the HTTP status so callers can
//branch on 202/501/401 without re-parsing the response.
export class ApiError extends Error {
  readonly status: number;
  readonly url: string;
  readonly body?: string;

  constructor(status: number, url: string, message: string, body?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

/** 202 Accepted — analytics enabled but the result has never finished computing. */
export const isComputing = (err: unknown): err is ApiError =>
  err instanceof ApiError && err.status === 202;

/** 501 Not Implemented — the analytics tier is gated off (RICH_ANALYTICS_ENABLED=false). */
export const isDisabled = (err: unknown): err is ApiError =>
  err instanceof ApiError && err.status === 501;

/** 401 Unauthorized — no/expired session (used by /me and authed actions). */
export const isUnauthorized = (err: unknown): err is ApiError =>
  err instanceof ApiError && err.status === 401;

/** 404 Not Found — e.g. an unknown player/match id. */
export const isNotFound = (err: unknown): err is ApiError =>
  err instanceof ApiError && err.status === 404;

type Query = Record<string, string | number | boolean | null | undefined>;

function buildUrl(base: string, path: string, query?: Query): string {
  const url = new URL(`${base}${path.startsWith('/') ? path : `/${path}`}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function fetchFrom<T>(
  base: string,
  path: string,
  opts: { query?: Query; init?: RequestInit; credentials?: RequestCredentials } = {},
): Promise<T> {
  const url = buildUrl(base, path, opts.query);
  let res: Response;
  try {
    res = await fetch(url, {
      credentials: opts.credentials ?? 'same-origin',
      headers: { Accept: 'application/json', ...(opts.init?.headers ?? {}) },
      ...opts.init,
    });
  } catch (cause) {
    //network / CORS / DNS failure — surface as a 0-status ApiError, not a throw
    //the UI can't classify.
    throw new ApiError(0, url, `Network request failed: ${String(cause)}`);
  }

  //202 is a 2xx, so `res.ok` is TRUE for it — without this the computing envelope
  //would be cast to the row type and every `isComputing(error)` branch stays dead.
  if (!res.ok || res.status === 202) {
    //Read a short body for diagnostics but never assume it's JSON.
    const body = await res.text().catch(() => undefined);
    throw new ApiError(res.status, url, `${res.status} ${res.statusText} for ${path}`, body);
  }

  if (res.status === 204 || res.status === 205) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

/** Fetch against the main API base (api.ranklock.app / PUBLIC_API_BASE_URL). */
export function apiFetch<T>(
  path: string,
  opts: { query?: Query; init?: RequestInit; credentials?: RequestCredentials } = {},
): Promise<T> {
  return fetchFrom<T>(API_BASE, path, opts);
}

async function fetchFromWithTotal<T>(
  base: string,
  path: string,
  opts: { query?: Query; init?: RequestInit; credentials?: RequestCredentials } = {},
): Promise<{ rows: T; total: number | null }> {
  const url = buildUrl(base, path, opts.query);
  let res: Response;
  try {
    res = await fetch(url, {
      credentials: opts.credentials ?? 'same-origin',
      headers: { Accept: 'application/json', ...(opts.init?.headers ?? {}) },
      ...opts.init,
    });
  } catch (cause) {
    throw new ApiError(0, url, `Network request failed: ${String(cause)}`);
  }
  if (!res.ok || res.status === 202) {
    const body = await res.text().catch(() => undefined);
    throw new ApiError(res.status, url, `${res.status} ${res.statusText} for ${path}`, body);
  }
  const raw = res.headers.get('x-total-count');
  const total = raw !== null ? (parseInt(raw, 10) || null) : null;
  if (res.status === 204 || res.status === 205) {
    return { rows: undefined as T, total };
  }
  return { rows: (await res.json()) as T, total };
}

/** Like `apiFetch` but also reads the `X-Total-Count` header, returning `{ rows, total }`.
 *  `total` is null when the header is absent. */
export function apiFetchWithTotal<T>(
  path: string,
  opts: { query?: Query; init?: RequestInit; credentials?: RequestCredentials } = {},
): Promise<{ rows: T; total: number | null }> {
  return fetchFromWithTotal<T>(API_BASE, path, opts);
}

export function laneLabFetch<T>(
  path: string,
  opts: { query?: Query; init?: RequestInit; credentials?: RequestCredentials } = {},
): Promise<T> {
  return fetchFrom<T>(LANE_LAB_BASE, path, opts);
}

//---- query-key factory (TanStack Query) -------------------------------------
//Stable, hierarchical keys so islands can invalidate by prefix.
//
export const queryKeys = {
  health: () => ['health'] as const,
  leaderboard: (params?: Query) => ['leaderboard', params ?? {}] as const,
  heroes: (params?: Query) => ['heroes', params ?? {}] as const,
  heroStats: (id: number, bracket?: HeroBracket, game_mode?: GameMode) =>
    ['hero', id, 'stats', bracket ?? null, game_mode ?? null] as const,
  //`scored` answers differ in SHAPE from plain ones — they must never share a cache entry.
  heroBuilds: (id: number, sort?: string, scored?: boolean) =>
    ['hero', id, 'builds', sort ?? 'weekly', scored ?? false] as const,
  heroBuildStats: (id: number, tier?: number, match_mode?: MatchMode) =>
    ['hero', id, 'build-stats', tier ?? 0, match_mode ?? 'Ranked'] as const,
  heroAbilities: (id: number) => ['hero', id, 'abilities'] as const,
  //Rank-bracketed builds + the by-id import source (C2/C4).
  heroRankedBuilds: (id: number, bracket: string, min_matches?: number) =>
    ['hero', id, 'builds', 'ranked', bracket, min_matches ?? null] as const,
  build: (id: number) => ['build', id] as const,
  heroAbilityOrders: (id: number) => ['hero', id, 'ability-orders'] as const,
  heroAssets: (id: number) => ['hero', id, 'assets'] as const,
  itemTiming: (id: number) => ['item', id, 'timing'] as const,
  itemDetail: (id: number) => ['item', id, 'detail'] as const,
  itemPairs: (id: number) => ['item', id, 'pairs'] as const,
  itemRankWinRates: (id: number) => ['item', id, 'win-rate-by-rank'] as const,
  itemHeroes: (id: number) => ['item', id, 'heroes'] as const,
  heroMatchups: (id: number, bracket?: number, game_mode?: GameMode) =>
    ['hero', id, 'matchups', bracket ?? null, game_mode ?? null] as const,
  heroCounters: (id: number) => ['hero', id, 'counters'] as const,
  heroSynergies: (id: number) => ['hero', id, 'synergies'] as const,
  heroItemWinRates: (id: number, params?: Query) => ['hero', id, 'item-win-rates', params ?? {}] as const,
  items: (bracket?: number, game_mode?: GameMode, hero_id?: number) =>
    ['items', bracket ?? 0, game_mode ?? null, hero_id ?? 0] as const,
  recentMatches: (params?: Query) => ['matches', 'recent', params ?? {}] as const,
  match: (id: number) => ['match', id] as const,
  //rolling-window per-match detail (items in buy order + per-minute souls timeline).
  matchInspect: (id: number) => ['match', id, 'inspect'] as const,
  search: (q: string) => ['search', q] as const,
  player: (id: number, game_mode?: GameMode) => ['player', id, game_mode ?? null] as const,
  playerMatches: (id: number, params?: Query) => ['player', id, 'matches', params ?? {}] as const,
  playerMmr: (id: number) => ['player', id, 'mmr'] as const,
  playerHeroes: (id: number, game_mode?: GameMode) => ['player', id, 'heroes', game_mode ?? null] as const,
  playerHeroesPlayed: (id: number, game_mode?: GameMode, match_mode?: MatchMode) =>
    ['player', id, 'heroes-played', game_mode ?? null, match_mode ?? null] as const,
  playerBadgeHistory: (id: number) => ['player', id, 'badge-history'] as const,
  playerBuilds: (id: number) => ['player', id, 'builds'] as const,
  playerPerformance: (id: number, game_mode?: GameMode) =>
    ['player', id, 'performance', game_mode ?? null] as const,
  playerCompare: (id: number, params?: Query) => ['player', id, 'compare', params ?? {}] as const,
  playerReadiness: (id: number, params?: Query) => ['player', id, 'readiness', params ?? {}] as const,
  playerComparePlayer: (id: number, params?: Query) =>
    ['player', id, 'compare-player', params ?? {}] as const,
  playerImprove: (id: number, params?: Query) => ['player', id, 'improve', params ?? {}] as const,
  //per-player economy aggregate (backs the Lane Lab player overlay).
  playerEconomy: (id: number, game_mode?: GameMode) => ['player', id, 'economy', game_mode ?? null] as const,
  //THE signature per-minute soul curve (your fixed line + the selected league/hero
  //comparison). vs_band/hero fold into params so each league/hero pick caches separately.
  playerEconomyCurve: (id: number, params?: Query) => ['player', id, 'economy-curve', params ?? {}] as const,
  //rank_distribution stays mode-AGNOSTIC (per-player badge histogram — product
  //decision, migration 022); the param exists only for forward-compat symmetry.
  rankDistribution: (game_mode?: GameMode) => ['stats', 'rank-distribution', game_mode ?? null] as const,
  patches: () => ['patches'] as const,
  patchCurrent: () => ['patches', 'current'] as const,
  patch: (id: string, params?: Query) => ['patches', id, params ?? {}] as const,
  patchMovers: (id: string, params?: Query) => ['patches', id, 'movers', params ?? {}] as const,
  heroBaseStats: (params?: Query) => ['build-lab', 'hero-base-stats', params ?? {}] as const,
  heroBaseStatsOne: (id: number, params?: Query) =>
    ['build-lab', 'hero-base-stats', id, params ?? {}] as const,
  itemModifiers: (params?: Query) => ['build-lab', 'item-modifiers', params ?? {}] as const,
  //Lane Lab surface (rich-analytics tier) — cohort economy + farm curves + early-econ verdict.
  laneEconomyCurve: (params?: Query) => ['lane-lab', 'economy-curve', params ?? {}] as const,
  laneFarmCurve: (params?: Query) => ['lane-lab', 'farm-curve', params ?? {}] as const,
  laneEarlyEconVerdict: (params?: Query) => ['lane-lab', 'early-econ-verdict', params ?? {}] as const,
  //Souls-by-source (migration 048): the tier cohort curve + the player's own line. band/hero and
  //match_mode fold into params so each rank/hero/track caches separately.
  laneSoulsSources: (params?: Query) => ['lane-lab', 'souls-sources', params ?? {}] as const,
  playerSoulsSources: (id: number, params?: Query) => ['player', id, 'souls-sources', params ?? {}] as const,
  //data-age freshness metadata (the "Stats through {date}" chip + sample windows).
  dataHorizon: () => ['meta', 'data-horizon'] as const,
  me: () => ['me'] as const,
};

//---- typed endpoint methods -------------------------------------------------
//One method per route the frontend consumes. Each returns the hand-written type
//from types/api.ts (regenerate via ts-rs when the backend derives TS).
export const api = {
  getHealth: () => apiFetch<HealthResponse>('/health'),

  getLeaderboard: (params?: {
    patch_id?: number;
    limit?: number;
    offset?: number;
    //full-depth keyset: ?after_rank=N serves ranks N+1.. in index time past the offset ceiling (unbanded only).
    after_rank?: number;
    min_badge?: number;
    max_badge?: number;
    game_mode?: GameMode;
    match_mode?: MatchMode;
  }) => apiFetchWithTotal<LeaderboardEntry[]>('/leaderboard', { query: params }),
  //`band` is a single rank tier 0..11 (badge/10, migration 025 hero_band_mv) — the SAME 12-band
  //ladder Lane Lab filters on. Prefer it over the coarse 4-way `bracket`; omit both for all-ranks.
  getHeroes: (params?: { bracket?: HeroBracket; band?: number; patch_id?: number; game_mode?: GameMode }) =>
    apiFetch<HeroSummary[]>('/heroes', { query: params }),
  getHeroStats: (id: number, bracket?: HeroBracket, game_mode?: GameMode) =>
    apiFetch<HeroSummary>(`/heroes/${id}/stats`, { query: { bracket, game_mode } }),
  //?scored=1 additionally carries each build's upstream 30-day numbers (win_rate_30d /
  //matches / wins / players), all null when upstream has no row at the badge floor.
  getHeroBuilds: <S extends boolean = false>(id: number, sort?: BuildSort, scored?: S) =>
    apiFetch<S extends true ? CommunityBuild[] : TrimmedBuild[]>(`/heroes/${id}/builds`, {
      query: { sort, scored: scored ? 1 : undefined },
    }),
  //Top builds inside one rank bracket, Wilson-lower sorted. `bracket` is one of the four
  //served keys; an unknown key 400s listing them. min_matches clamps to 1..500 server-side.
  getRankedBuilds: (id: number, bracket: string, min_matches?: number) =>
    apiFetch<RankedBuildsResponse>(`/heroes/${id}/builds/ranked`, { query: { bracket, min_matches } }),
  //One published build by id — the Build Lab Analyze import source. 404 for an id upstream
  //has no build for; hero_id rides the body since the route carries no hero.
  getBuildById: (build_id: number) => apiFetch<BuildById>(`/builds/${build_id}`),
  //Level-order aggregates, floored at 500 matches upstream-side (no caller can lower it).
  getAbilityOrders: (id: number) => apiFetch<AbilityOrdersResponse>(`/heroes/${id}/ability-orders`),
  //The hero's client-side numerics: identity, scaling, investment track, per-ability tiers.
  //Optional keys are ABSENT when upstream omits them — never read a gap as a zero.
  getHeroAssets: (id: number) => apiFetch<HeroAssetsResponse>(`/heroes/${id}/assets`),
  //Item sets + buy order from our own matches. Only `tier=0` is served (the backend 400s the rest),
  //and 202/501 arrive as an ApiError the caller classifies with `isComputing` / `isDisabled`.
  getHeroBuildStats: (id: number, tier: number = 0, match_mode: MatchMode = 'Ranked') =>
    apiFetch<HeroBuildStats>(`/heroes/${id}/build-stats`, { query: { tier, match_mode } }),
  //The hero's abilities (id/name/icon/slot order) — warmed proxy backing the imbue prompt + ability
  //order rendering. 502 with an empty list when the upstream assets payload is briefly unavailable.
  getHeroAbilities: (id: number) => apiFetch<HeroAbility[]>(`/heroes/${id}/abilities`),
  getHeroMatchups: (id: number, bracket?: number, game_mode?: GameMode) =>
    apiFetch<MatchupEntry[]>(`/heroes/${id}/matchups`, { query: { bracket, game_mode } }),
  getHeroCounters: (id: number) => apiFetch<HeroCountersResponse>(`/heroes/${id}/counters`),
  getHeroSynergies: (id: number) => apiFetch<HeroSynergiesResponse>(`/heroes/${id}/synergies`),
  getHeroItemWinRates: (id: number, params?: { band?: number; game_mode?: GameMode }) =>
    apiFetch<HeroItemWinRate[]>(`/heroes/${id}/item-win-rates`, { query: params }).then(enrichItems),
  getItems: (bracket?: number, game_mode?: GameMode, hero_id?: number) =>
    apiFetch<ItemStat[]>('/items/stats', { query: { bracket, game_mode, hero_id } }).then(enrichItems),
  //Purchase-minute histogram + quartiles for one item.
  getItemTiming: (item_id: number) => apiFetch<ItemTimingResponse>(`/items/${item_id}/timing`),
  //Catalog row + component-tree edges + Valve's text. 404 on an unknown id.
  getItemDetail: (item_id: number) => apiFetch<ItemDetailResponse>(`/items/${item_id}/detail`),
  //Partner items and the win-rate lift when both are on the board.
  getItemPairs: (item_id: number) => apiFetch<ItemPairsResponse>(`/items/${item_id}/pairs`),
  //Win rate across the 11 ranked tiers; a tier under `thin_below` matches is flagged `thin`.
  getItemRankWinRates: (item_id: number) =>
    apiFetch<ItemRankWinRatesResponse>(`/items/${item_id}/win-rate-by-rank`),
  //Who buys this item, from our own matches. An item the fold has no rows for is an EMPTY
  //hero list, never a 404 — the card renders its own empty state.
  getItemHeroes: (item_id: number) => apiFetch<ItemHeroesResponse>(`/items/${item_id}/heroes`),
  //Offset paging (ui-residuals C1): limit ≤50, offset ≤100k; the offset path answers with
  //X-Total-Count so the /matches pager can size itself (`total` null until that ships live).
  getRecentMatches: (params?: { game_mode?: string; match_mode?: string; limit?: number; offset?: number }) =>
    apiFetchWithTotal<MatchRow[]>('/matches/recent', { query: params }),

  //per-match / per-user surface (CSR islands)
  getMatch: (id: number) => apiFetch<MatchDetail>(`/matches/${id}`),
  getMatchInspect: (id: number) => apiFetch<MatchInspect>(`/matches/${id}/inspect`),
  searchPlayers: (q: string, limit?: number) =>
    apiFetch<SearchResult[]>('/players/search', { query: { q, limit } }),
  getPlayer: (id: number, game_mode?: GameMode) =>
    apiFetch<PlayerProfileResponse>(`/players/${id}`, { query: { game_mode } }),
  getPlayerMatches: (
    id: number,
    params?: { limit?: number; cursor?: string; hero_id?: number; game_mode?: string; match_mode?: string },
  ) => apiFetch<PlayerMatchRow[]>(`/players/${id}/matches`, { query: params }),
  getPlayerMmr: (id: number) => apiFetch<MMRHistoryRow[]>(`/players/${id}/mmr`),
  getPlayerHeroes: (id: number, game_mode?: GameMode) =>
    apiFetch<HeroLedgerRow[]>(`/players/${id}/heroes`, { query: { game_mode } }),
  getPlayerHeroesPlayed: (id: number, game_mode?: GameMode, match_mode?: MatchMode) =>
    apiFetch<HeroPlayed[]>(`/players/${id}/heroes-played`, { query: { game_mode, match_mode } }),
  getPlayerBadgeHistory: (id: number) => apiFetch<BadgeHistoryRow[]>(`/players/${id}/badge-history`),
  //The player's published in-game builds (C1 author_id proxy). Empty array for a player who never
  //published; suppression-404'd like every by-account surface. Newest-first.
  getPlayerBuilds: (id: number) => apiFetch<TrimmedBuild[]>(`/players/${id}/builds`),
  getPlayerPerformance: (id: number, game_mode?: GameMode) =>
    apiFetch<PerformanceResponse>(`/players/${id}/performance`, { query: { game_mode } }),
  getPlayerCompare: (
    id: number,
    params?: {
      hero_id?: number;
      league_offset?: string;
      target_tier?: number;
      game_mode?: GameMode;
      match_mode?: MatchMode;
      last_games?: number;
      last_days?: number;
    },
  ) => apiFetch<CompareResponse>(`/players/${id}/compare`, { query: params }),
  //Rank-up readiness verdict (backlog A1): the player's recent-window averages vs the
  //band-above cohort medians. `target_tier` (bracket 1..5) overrides the auto band-above;
  //200 with matches_in_window:0 means no recent games, 202 while the cohort computes.
  getPlayerReadiness: (id: number, params?: { target_tier?: number; game_mode?: GameMode }) =>
    apiFetch<ReadinessResponse>(`/players/${id}/readiness`, { query: params }),
  getPlayerComparePlayer: (
    id: number,
    params: {
      vs: number;
      hero_id?: number;
      game_mode?: GameMode;
      match_mode?: MatchMode;
      last_games?: number;
      last_days?: number;
    },
  ) => apiFetch<ComparePlayerResponse>(`/players/${id}/compare-player`, { query: params }),
  getPlayerImprove: (
    id: number,
    params?: { hero_id?: number; window?: string; bracket?: number; game_mode?: GameMode },
  ) => apiFetch<ImproveResponse>(`/players/${id}/improve`, { query: params }),
  getPlayerEconomy: (id: number, game_mode?: GameMode) =>
    apiFetch<PlayerEconomy>(`/players/${id}/economy`, { query: { game_mode } }),
  getPlayerEconomyCurve: (
    id: number,
    params?: {
      metric?: string;
      vs_band?: number;
      hero?: number;
      match?: number;
      match_mode?: MatchMode;
      rank?: number;
      tier?: number;
      division?: number;
    },
  ) => apiFetch<PlayerEconomyCurveResponse>(`/players/${id}/economy-curve`, { query: params }),
  getPlayerSoulsSources: (id: number, params?: { hero?: number; match_mode?: MatchMode }) =>
    apiFetch<PlayerSoulsResponse>(`/players/${id}/souls-sources`, { query: params }),

  //patch tracking (C9) — fully built backend, previously zero FE refs (§A.4). The
  //patch LIST is mode-agnostic; the per-patch hero stats + movers are mode-separated
  //(patch_hero_stats carries game_mode — 022).
  getPatches: () => apiFetch<Patch[]>('/patches'),
  getCurrentPatch: () => apiFetch<Patch>('/patches/current'),
  getPatch: (id: string, bracket?: number, game_mode?: GameMode) =>
    apiFetch<PatchDetail>(`/patches/${id}`, { query: { bracket, game_mode } }),
  getPatchMovers: (id: string, params?: { bracket?: number; limit?: number; game_mode?: GameMode }) =>
    apiFetch<PatchMovers>(`/patches/${id}/movers`, { query: params }),

  //Build Lab (C9) — base stats + item modifiers (§A.4). Note: hero_base_stats is
  //empty locally until the patch snapshot hook runs, so these empty-state.
  getHeroBaseStats: (patch_id?: string) =>
    apiFetch<HeroBaseStats[]>('/heroes/base-stats', { query: { patch_id } }),
  getHeroBaseStatsOne: (id: number, patch_id?: string) =>
    apiFetch<HeroBaseStats>(`/heroes/${id}/base-stats`, { query: { patch_id } }),
  getItemModifiers: (params?: { slot?: string; tier?: number }) =>
    apiFetch<ItemModifier[]>('/items/modifiers', { query: params }).then((rows) => rows.filter(isPublicItem)),

  getLaneEconomyCurve: (params?: {
    band?: number;
    metric?: string;
    game_mode?: GameMode;
    rank?: number;
    tier?: number;
    division?: number;
  }) => laneLabFetch<LaneCurveResponse>('/lane-lab/economy-curve', { query: params }),
  //Per-minute farm (last-hits) curve; same CurveResponse shape + band/cohort overlay as
  //the economy curve. The endpoint serves last_hits + souls only — callers default to
  //last_hits (the farm headline). Same 501/202 build-ahead states + rank/tier/division cohort.
  getLaneFarmCurve: (params?: {
    band?: number;
    metric?: string;
    game_mode?: GameMode;
    rank?: number;
    tier?: number;
    division?: number;
  }) => laneLabFetch<LaneCurveResponse>('/lane-lab/farm-curve', { query: params }),
  getLaneEarlyEconVerdict: (params?: { band?: number; game_mode?: GameMode }) =>
    laneLabFetch<EarlyEconVerdictResponse>('/lane-lab/early-econ-verdict', { query: params }),
  //Cohort souls-by-source (migration 048) — the tier half of the "you vs tier" stack. `band` is the
  //rank tier (badge/10, 0..11; omit to aggregate all bands); `metric_group` narrows to one source
  //(unknown ⇒ all six). RICH_ANALYTICS-gated (501 off, 202 until the first fold); `match_mode` per 047.
  getLaneSoulsSources: (params?: { band?: number; metric_group?: string; match_mode?: MatchMode }) =>
    laneLabFetch<SoulsCohortResponse>('/lane-lab/souls-sources', { query: params }),
  //Ranked player-games per Valve rank at the busiest 180s bucket (migration 057,
  //analytics.rank_population). `game_mode` is accepted for forward-compat; the
  //view returns one group today ('Normal','Ranked') and the client filters it.
  getRankDistribution: (game_mode?: GameMode) =>
    apiFetch<RankPopulationRow[]>('/stats/rank-distribution', { query: { game_mode } }),
  //Freshness metadata (backend meta.rs, ungated + fail-open server-side). Consumers must
  //treat ANY failure — including a 404 from an API that predates the route — as "unknown"
  //and render nothing: no fake date, no error state (Component 11 data-age honesty).
  getDataHorizon: () => apiFetch<DataHorizonResponse>('/meta/data-horizon'),

  //Authed: the session cookie must ride cross-origin, so this is the one main-API call
  //that opts into `credentials: 'include'` (all other reads are public → 'same-origin').
  getCurrentUser: () => apiFetch<CurrentUser>('/me', { credentials: 'include' }),
};

export type ApiClient = typeof api;
