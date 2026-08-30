//============================================================================
//Typed HTTP/JSON client for the RankLock Rust/Axum API (api.ranklock.app).
//
//The frontend is a PURE HTTP/JSON client — no DB, no BFF (architecture §8).
//This module is the single fetch surface: every island and every build-time
//`.astro` fetch goes through `apiFetch` so error handling, auth cookies, and
//base-URL resolution live in ONE place.
//
//Reliability contract (requirements §A.6): callers must never assume `res.ok`.
//`apiFetch` checks it and throws a typed `ApiError` carrying the status, so a
//bad/HTML/500 response becomes a handled query error (an empty/error state),
//never a white-screen. The build-ahead surfaces (requirements §8.1 / §A.3) also
//return 202 (computing) / 501 (analytics disabled) before the data pipeline is
//live — `isComputing()` / `isDisabled()` let the UI empty-state those without
//treating them as hard failures.
//============================================================================
import type {
  BadgeHistoryRow,
  CompareResponse,
  ComparePlayerResponse,
  CurrentUser,
  DataHorizonResponse,
  EarlyEconVerdictResponse,
  GameMode,
  HealthResponse,
  HeroBracket,
  HeroCountersResponse,
  HeroItemWinRate,
  HeroBaseStats,
  HeroLedgerRow,
  HeroPlayed,
  HeroSummary,
  HeroSynergiesResponse,
  ImproveResponse,
  ItemModifier,
  ItemStat,
  LaneCurveResponse,
  LeaderboardEntry,
  MatchDetail,
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
  RankBucket,
  ReadinessResponse,
  SearchResult,
  TrimmedBuild,
} from '../types/api';
//Fills item_name/icon_url the stats endpoints leave null (see itemCatalog.ts).
import { enrichItems } from './itemCatalog';

//Public production API base. Overridden at build time by CI via
//PUBLIC_API_BASE_URL (requirements §A.2 — never a committed .env.production).
//The default is the PUBLIC prod origin (not a secret) so local dev and a
//missing-env build still resolve to a real host instead of 404ing into the SPA.
export const API_BASE: string =
  import.meta.env.PUBLIC_API_BASE_URL?.replace(/\/+$/, '') ?? 'https://api.ranklock.app';

//Base URL of the standalone Lane Lab service (ranklock-lane-lab; :8100 local). Lane Lab is its OWN
//service, deployed/scaled/failed independently of the main API ("Lane Lab = its own service" —
//ranklock-lane-lab/CLAUDE.md). The Lane Lab endpoint methods go through `laneLabFetch` against this
//base. When PUBLIC_LANE_LAB_BASE_URL is UNSET it falls back to API_BASE, so Lane Lab keeps resolving
//against whatever serves /lane-lab/* today (the backend) with no behavior change until a real Lane
//Lab origin is wired in an environment.
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

/**
 * Core fetch against an explicit base URL. Asks for JSON and throws a typed
 * `ApiError` on any non-2xx. 204/205 → undefined. The base is a parameter so the
 * same contract serves both the main API (`apiFetch`) and the standalone Lane Lab
 * service (`laneLabFetch`).
 *
 * Credentials mode (requirements §A.6/§A.7): PUBLIC reads default to `'same-origin'`.
 * A cross-origin public GET must NOT send credentials — with `credentials: 'include'`
 * the browser REJECTS the API's wildcard `Access-Control-Allow-Origin: *` ("the value
 * of the 'Access-Control-Allow-Origin' header must not be the wildcard '*' when the
 * request's credentials mode is 'include'"), so the fetch fails and the island shows
 * an error state (this was the Heroes rank-filter bug: every bracket refetch was
 * cross-origin `:4321 → :18000`, blocked by CORS, surfaced as "Hero meta unavailable").
 * Only the authed `/me*` surface passes `credentials: 'include'` explicitly to carry
 * the session cookie cross-origin.
 */
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

  if (!res.ok) {
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
  if (!res.ok) {
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

/**
 * Fetch against the standalone Lane Lab service base (ranklock-lane-lab / PUBLIC_LANE_LAB_BASE_URL).
 * Identical typed-ApiError contract as `apiFetch`; only the base URL differs. Public Lane Lab reads
 * use the default `'same-origin'`; authed calls pass `credentials: 'include'`
 * so a logged-in user's `session_id` cookie (shared via the same Redis store) rides along to Lane Lab.
 */
export function laneLabFetch<T>(
  path: string,
  opts: { query?: Query; init?: RequestInit; credentials?: RequestCredentials } = {},
): Promise<T> {
  return fetchFrom<T>(LANE_LAB_BASE, path, opts);
}

//---- query-key factory (TanStack Query) -------------------------------------
//Stable, hierarchical keys so islands can invalidate by prefix.
//
//game-mode separation (022): every mode-separated surface carries `game_mode` in
//its key so Normal and Brawl cache SIDE BY SIDE and never overwrite each other
//(the cache-key analog of the backend's widened Redis keys). Factories that take a
//`params` object fold `game_mode` into it at the call site (the params spread into
//the key already), so only the discrete-arg factories below grow a `game_mode`
//parameter. Mode-agnostic surfaces (health/me/search/recent-matches/mmr/
//badge-history/builds/base-stats/patch-list) deliberately do NOT carry it.
export const queryKeys = {
  health: () => ['health'] as const,
  leaderboard: (params?: Query) => ['leaderboard', params ?? {}] as const,
  heroes: (params?: Query) => ['heroes', params ?? {}] as const,
  heroStats: (id: number, bracket?: HeroBracket, game_mode?: GameMode) =>
    ['hero', id, 'stats', bracket ?? null, game_mode ?? null] as const,
  heroBuilds: (id: number) => ['hero', id, 'builds'] as const,
  heroMatchups: (id: number, bracket?: HeroBracket, game_mode?: GameMode) =>
    ['hero', id, 'matchups', bracket ?? null, game_mode ?? null] as const,
  heroCounters: (id: number) => ['hero', id, 'counters'] as const,
  heroSynergies: (id: number) => ['hero', id, 'synergies'] as const,
  heroItemWinRates: (id: number, params?: Query) => ['hero', id, 'item-win-rates', params ?? {}] as const,
  items: (bracket?: number, game_mode?: GameMode, hero_id?: number) =>
    ['items', bracket ?? 0, game_mode ?? null, hero_id ?? 0] as const,
  recentMatches: (params?: Query) => ['matches', 'recent', params ?? {}] as const,
  match: (id: number) => ['match', id] as const,
  search: (q: string) => ['search', q] as const,
  player: (id: number, game_mode?: GameMode) => ['player', id, game_mode ?? null] as const,
  playerMatches: (id: number, params?: Query) => ['player', id, 'matches', params ?? {}] as const,
  playerMmr: (id: number) => ['player', id, 'mmr'] as const,
  playerHeroes: (id: number, game_mode?: GameMode) => ['player', id, 'heroes', game_mode ?? null] as const,
  playerHeroesPlayed: (id: number, game_mode?: GameMode) =>
    ['player', id, 'heroes-played', game_mode ?? null] as const,
  playerBadgeHistory: (id: number) => ['player', id, 'badge-history'] as const,
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
  //patch tracking surface (C9)
  patches: () => ['patches'] as const,
  patchCurrent: () => ['patches', 'current'] as const,
  patch: (id: string, params?: Query) => ['patches', id, params ?? {}] as const,
  patchMovers: (id: string, params?: Query) => ['patches', id, 'movers', params ?? {}] as const,
  //Build Lab surface (C9)
  heroBaseStats: (params?: Query) => ['build-lab', 'hero-base-stats', params ?? {}] as const,
  heroBaseStatsOne: (id: number, params?: Query) =>
    ['build-lab', 'hero-base-stats', id, params ?? {}] as const,
  itemModifiers: (params?: Query) => ['build-lab', 'item-modifiers', params ?? {}] as const,
  //Lane Lab surface (rich-analytics tier) — cohort economy + farm curves + early-econ verdict.
  laneEconomyCurve: (params?: Query) => ['lane-lab', 'economy-curve', params ?? {}] as const,
  laneFarmCurve: (params?: Query) => ['lane-lab', 'farm-curve', params ?? {}] as const,
  laneEarlyEconVerdict: (params?: Query) => ['lane-lab', 'early-econ-verdict', params ?? {}] as const,
  //data-age freshness metadata (the "Stats through {date}" chip + sample windows).
  dataHorizon: () => ['meta', 'data-horizon'] as const,
  me: () => ['me'] as const,
};

//---- typed endpoint methods -------------------------------------------------
//One method per route the frontend consumes. Each returns the hand-written type
//from types/api.ts (regenerate via ts-rs when the backend derives TS).
export const api = {
  getHealth: () => apiFetch<HealthResponse>('/health'),

  //SEO / reference surface (SSG build-time fetch + CSR). `offset`/`limit` page the
  //ladder server-side and `min_badge`/`max_badge` (badge = tier*10+subrank) drive the
  //rank-band filter — both implemented backend-side (leaderboard Component 1). Omitting
  //the badge pair returns the full ladder. Returns `{ rows, total }` where `total` reads
  //the `X-Total-Count` response header (null when absent).
  getLeaderboard: (params?: {
    patch_id?: number;
    limit?: number;
    offset?: number;
    min_badge?: number;
    max_badge?: number;
    game_mode?: GameMode;
  }) => apiFetchWithTotal<LeaderboardEntry[]>('/leaderboard', { query: params }),
  //`band` is a single rank tier 0..11 (badge/10, migration 025 hero_band_mv) — the SAME 12-band
  //ladder Lane Lab filters on. Prefer it over the coarse 4-way `bracket`; omit both for all-ranks.
  getHeroes: (params?: { bracket?: HeroBracket; band?: number; patch_id?: number; game_mode?: GameMode }) =>
    apiFetch<HeroSummary[]>('/heroes', { query: params }),
  getHeroStats: (id: number, bracket?: HeroBracket, game_mode?: GameMode) =>
    apiFetch<HeroSummary>(`/heroes/${id}/stats`, { query: { bracket, game_mode } }),
  getHeroBuilds: (id: number) => apiFetch<TrimmedBuild[]>(`/heroes/${id}/builds`),
  getHeroMatchups: (id: number, bracket?: HeroBracket, game_mode?: GameMode) =>
    apiFetch<MatchupEntry[]>(`/heroes/${id}/matchups`, { query: { bracket, game_mode } }),
  getHeroCounters: (id: number) => apiFetch<HeroCountersResponse>(`/heroes/${id}/counters`),
  getHeroSynergies: (id: number) => apiFetch<HeroSynergiesResponse>(`/heroes/${id}/synergies`),
  //Best items by win rate for a hero, scoped to a rank band (rich-analytics tier; served
  //by the MAIN API under /heroes/*, so `apiFetch`). `band` is the numeric rank tier
  //(badge/10, 0..11); omit to aggregate. 501 while the tier is gated off, 202 until the
  //analytics pipeline serves.
  //hero_item_win_rates is mode-separated but lane-tier Normal-only (022) — the
  //param exists for symmetry; the UI only ever sends Normal here.
  getHeroItemWinRates: (id: number, params?: { band?: number; game_mode?: GameMode }) =>
    apiFetch<HeroItemWinRate[]>(`/heroes/${id}/item-win-rates`, { query: params }).then(enrichItems),
  //Items use an INTEGER badge-bucket (0..5; 0 = all) — see lib/brackets.ts. The
  //label fix (badge tiers, not MMR ranges) lives in the UI; this just forwards
  //the bucket the backend's `bracket_badge_range` expects. `game_mode` is forwarded
  //for forward-compat (the /items/stats Gold table is not yet mode-separated, so
  //the backend currently ignores it and returns the same rows for both modes).
  //`hero_id` scopes the rows to one hero (omit/0 = every hero); the backend 400s a bad value.
  getItems: (bracket?: number, game_mode?: GameMode, hero_id?: number) =>
    apiFetch<ItemStat[]>('/items/stats', { query: { bracket, game_mode, hero_id } }).then(enrichItems),
  getRecentMatches: (params?: { game_mode?: string; match_mode?: string }) =>
    apiFetch<MatchRow[]>('/matches/recent', { query: params }),

  //per-match / per-user surface (CSR islands)
  getMatch: (id: number) => apiFetch<MatchDetail>(`/matches/${id}`),
  searchPlayers: (q: string, limit?: number) =>
    apiFetch<SearchResult[]>('/players/search', { query: { q, limit } }),
  //Per-player aggregates are mode-separated (022): the profile headline, hero
  //ledger, heroes-played, percentiles and compare all accept `game_mode` (default
  //Normal). The per-MATCH lists (/matches, /mmr, /badge-history) are NOT — they
  //enumerate matches, not an aggregate, so they carry no mode.
  getPlayer: (id: number, game_mode?: GameMode) =>
    apiFetch<PlayerProfileResponse>(`/players/${id}`, { query: { game_mode } }),
  getPlayerMatches: (
    id: number,
    params?: { limit?: number; cursor?: string; hero_id?: number; game_mode?: string; match_mode?: string },
  ) => apiFetch<PlayerMatchRow[]>(`/players/${id}/matches`, { query: params }),
  getPlayerMmr: (id: number) => apiFetch<MMRHistoryRow[]>(`/players/${id}/mmr`),
  getPlayerHeroes: (id: number, game_mode?: GameMode) =>
    apiFetch<HeroLedgerRow[]>(`/players/${id}/heroes`, { query: { game_mode } }),
  getPlayerHeroesPlayed: (id: number, game_mode?: GameMode) =>
    apiFetch<HeroPlayed[]>(`/players/${id}/heroes-played`, { query: { game_mode } }),
  getPlayerBadgeHistory: (id: number) => apiFetch<BadgeHistoryRow[]>(`/players/${id}/badge-history`),
  getPlayerPerformance: (id: number, game_mode?: GameMode) =>
    apiFetch<PerformanceResponse>(`/players/${id}/performance`, { query: { game_mode } }),
  //Keys MUST be hero_id/league_offset/target_tier to match the backend CompareQuery
  //(main.rs). The old `hero` key was silently dropped server-side (read as hero_id),
  //so the hero selector never filtered — this is the live-bug fix. compare's cohort
  //baseline is hero_tier_cohort_mv (mode-separated), so `game_mode` is meaningful.
  //hero_id=0 opts into the ALL-heroes you-scope (null cohort side); absent hero_id
  //keeps the server default (most-played hero + cohort). last_games/last_days are
  //mutually exclusive window bounds; both absent = all loaded games.
  getPlayerCompare: (
    id: number,
    params?: {
      hero_id?: number;
      league_offset?: string;
      target_tier?: number;
      game_mode?: GameMode;
      last_games?: number;
      last_days?: number;
    },
  ) => apiFetch<CompareResponse>(`/players/${id}/compare`, { query: params }),
  //Rank-up readiness verdict (backlog A1): the player's recent-window averages vs the
  //band-above cohort medians. `target_tier` (bracket 1..5) overrides the auto band-above;
  //200 with matches_in_window:0 means no recent games, 202 while the cohort computes.
  getPlayerReadiness: (id: number, params?: { target_tier?: number; game_mode?: GameMode }) =>
    apiFetch<ReadinessResponse>(`/players/${id}/readiness`, { query: params }),
  //Compare you to a SPECIFIC other player. `vs` is the other player's account_id.
  //Hero scope is explicit only: absent/0 hero_id = all heroes for both sides; a
  //non-zero hero_id scopes both. last_games/last_days window both sides (mutually
  //exclusive). 404 only when an account has no games at all in the mode — a 0-game
  //side under a scope comes back 200 with matches:0 and null metrics.
  getPlayerComparePlayer: (
    id: number,
    params: { vs: number; hero_id?: number; game_mode?: GameMode; last_games?: number; last_days?: number },
  ) => apiFetch<ComparePlayerResponse>(`/players/${id}/compare-player`, { query: params }),
  //Keys MUST be hero_id/window/bracket to match improve.rs::ImproveQuery; the old
  //`hero`/`vs_tier` keys were ignored server-side. improve's cohort
  //(player_cohort_benchmarks) is Normal-only (022), so the UI pins this to Normal —
  //the param exists only so a future Brawl cohort would just work.
  getPlayerImprove: (
    id: number,
    params?: { hero_id?: number; window?: string; bracket?: number; game_mode?: GameMode },
  ) => apiFetch<ImproveResponse>(`/players/${id}/improve`, { query: params }),
  //Public per-player economy aggregate (backend C5; served by the MAIN API). Ranked-only,
  //suppression-honored — backs the Lane Lab player overlay. matches===0 / null rates ⇒ the
  //player has no ranked economy data yet (the UI empty-states it); 404 for a suppressed/unknown
  //account. NOTE: an AGGREGATE across the player's matches, NOT a per-minute curve.
  getPlayerEconomy: (id: number, game_mode?: GameMode) =>
    apiFetch<PlayerEconomy>(`/players/${id}/economy`, { query: { game_mode } }),
  //THE signature economy curve (ranklock-feature-economy-curve-signature C3). `you`/`points`
  //is the player's FIXED per-minute curve; `vs_band` (rank tier 0..11) and `hero` move ONLY
  //the `comparison` cohort. `metric` = souls (default) | last_hits; `match` narrows `you` to
  //one game. Served by the MAIN API. Suppressed/unknown account ⇒ 404 (empty-state); the
  //comparison degrades to null (never a hard fail) when rich-analytics is off/computing.
  getPlayerEconomyCurve: (
    id: number,
    params?: { metric?: string; vs_band?: number; hero?: number; match?: number },
  ) => apiFetch<PlayerEconomyCurveResponse>(`/players/${id}/economy-curve`, { query: params }),

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
    apiFetch<ItemModifier[]>('/items/modifiers', { query: params }),

  //Lane Lab (rich-analytics tier — RICH_ANALYTICS_ENABLED gate), served by deadlock-backend
  //(`laneLabFetch` resolves to the main API unless PUBLIC_LANE_LAB_BASE_URL overrides it). `band`
  //is the rank tier (badge/10, 0..11); omit it to aggregate all bands. 501 while the flag is off,
  //202 until the lane producers have folded — callers empty-state both. Lane curves are
  //Normal-only (022); `game_mode` is forwarded for forward-compat but the UI never sends anything
  //but Normal here (the global toggle is hard-gated off on Lane Lab).
  getLaneEconomyCurve: (params?: { band?: number; metric?: string; game_mode?: GameMode }) =>
    laneLabFetch<LaneCurveResponse>('/lane-lab/economy-curve', { query: params }),
  //Per-minute farm (last-hits) curve; same CurveResponse shape + band/cohort overlay as
  //the economy curve. The endpoint serves last_hits + souls only — callers default to
  //last_hits (the farm headline). Same 501/202 build-ahead states.
  getLaneFarmCurve: (params?: { band?: number; metric?: string; game_mode?: GameMode }) =>
    laneLabFetch<LaneCurveResponse>('/lane-lab/farm-curve', { query: params }),
  getLaneEarlyEconVerdict: (params?: { band?: number; game_mode?: GameMode }) =>
    laneLabFetch<EarlyEconVerdictResponse>('/lane-lab/early-econ-verdict', { query: params }),
  //stats + session. rank_distribution is mode-AGNOSTIC (per-player badge histogram —
  //product decision, 022); the param is accepted for symmetry but the backend ignores
  //it (no game_mode dimension on the table).
  getRankDistribution: (game_mode?: GameMode) =>
    apiFetch<RankBucket[]>('/stats/rank-distribution', { query: { game_mode } }),
  //Freshness metadata (backend meta.rs, ungated + fail-open server-side). Consumers must
  //treat ANY failure — including a 404 from an API that predates the route — as "unknown"
  //and render nothing: no fake date, no error state (Component 11 data-age honesty).
  getDataHorizon: () => apiFetch<DataHorizonResponse>('/meta/data-horizon'),

  //Authed: the session cookie must ride cross-origin, so this is the one main-API call
  //that opts into `credentials: 'include'` (all other reads are public → 'same-origin').
  getCurrentUser: () => apiFetch<CurrentUser>('/me', { credentials: 'include' }),
};

export type ApiClient = typeof api;
