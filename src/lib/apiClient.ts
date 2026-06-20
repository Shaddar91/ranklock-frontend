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
  CurrentUser,
  EarlyEconVerdictResponse,
  HealthResponse,
  HeroBracket,
  HeroCountersResponse,
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
  PlayerMatchRow,
  PlayerProfileResponse,
  RankBucket,
  SearchResult,
  TrimmedBuild,
} from '../types/api';

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
 * Core fetch against an explicit base URL. Sends cookies (`credentials: 'include'`)
 * so cross-origin "My Stats" calls carry the session (requirements §A.7), asks for
 * JSON, and throws a typed `ApiError` on any non-2xx. 204/205 → undefined. The base
 * is a parameter so the same contract serves both the main API (`apiFetch`) and the
 * standalone Lane Lab service (`laneLabFetch`).
 */
async function fetchFrom<T>(
  base: string,
  path: string,
  opts: { query?: Query; init?: RequestInit } = {},
): Promise<T> {
  const url = buildUrl(base, path, opts.query);
  let res: Response;
  try {
    res = await fetch(url, {
      credentials: 'include',
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
  opts: { query?: Query; init?: RequestInit } = {},
): Promise<T> {
  return fetchFrom<T>(API_BASE, path, opts);
}

/**
 * Fetch against the standalone Lane Lab service base (ranklock-lane-lab / PUBLIC_LANE_LAB_BASE_URL).
 * Identical credentialed + typed-ApiError contract as `apiFetch`; only the base URL differs, so a
 * logged-in user's `session_id` cookie (shared via the same Redis store) rides along to Lane Lab.
 */
export function laneLabFetch<T>(
  path: string,
  opts: { query?: Query; init?: RequestInit } = {},
): Promise<T> {
  return fetchFrom<T>(LANE_LAB_BASE, path, opts);
}

//---- query-key factory (TanStack Query) -------------------------------------
//Stable, hierarchical keys so islands can invalidate by prefix.
export const queryKeys = {
  health: () => ['health'] as const,
  leaderboard: (params?: Query) => ['leaderboard', params ?? {}] as const,
  heroes: (params?: Query) => ['heroes', params ?? {}] as const,
  heroStats: (id: number, bracket?: HeroBracket) => ['hero', id, 'stats', bracket ?? null] as const,
  heroBuilds: (id: number) => ['hero', id, 'builds'] as const,
  heroMatchups: (id: number, bracket?: HeroBracket) =>
    ['hero', id, 'matchups', bracket ?? null] as const,
  heroCounters: (id: number) => ['hero', id, 'counters'] as const,
  heroSynergies: (id: number) => ['hero', id, 'synergies'] as const,
  items: (bracket?: number) => ['items', bracket ?? 0] as const,
  recentMatches: () => ['matches', 'recent'] as const,
  match: (id: number) => ['match', id] as const,
  search: (q: string) => ['search', q] as const,
  player: (id: number) => ['player', id] as const,
  playerMatches: (id: number, params?: Query) => ['player', id, 'matches', params ?? {}] as const,
  playerMmr: (id: number) => ['player', id, 'mmr'] as const,
  playerHeroes: (id: number) => ['player', id, 'heroes'] as const,
  playerHeroesPlayed: (id: number) => ['player', id, 'heroes-played'] as const,
  playerBadgeHistory: (id: number) => ['player', id, 'badge-history'] as const,
  playerPerformance: (id: number) => ['player', id, 'performance'] as const,
  playerCompare: (id: number, params?: Query) => ['player', id, 'compare', params ?? {}] as const,
  playerImprove: (id: number, params?: Query) => ['player', id, 'improve', params ?? {}] as const,
  rankDistribution: () => ['stats', 'rank-distribution'] as const,
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
  //Lane Lab surface (rich-analytics tier) — cohort economy curves + early-econ verdict.
  laneEconomyCurve: (params?: Query) => ['lane-lab', 'economy-curve', params ?? {}] as const,
  laneEarlyEconVerdict: (params?: Query) => ['lane-lab', 'early-econ-verdict', params ?? {}] as const,
  me: () => ['me'] as const,
};

//---- typed endpoint methods -------------------------------------------------
//One method per route the frontend consumes. Each returns the hand-written type
//from types/api.ts (regenerate via ts-rs when the backend derives TS).
export const api = {
  getHealth: () => apiFetch<HealthResponse>('/health'),

  //SEO / reference surface (SSG build-time fetch + CSR)
  getLeaderboard: (params?: { patch_id?: number; limit?: number; cursor?: string }) =>
    apiFetch<LeaderboardEntry[]>('/leaderboard', { query: params }),
  getHeroes: (params?: { bracket?: HeroBracket; patch_id?: number }) =>
    apiFetch<HeroSummary[]>('/heroes', { query: params }),
  getHeroStats: (id: number, bracket?: HeroBracket) =>
    apiFetch<HeroSummary>(`/heroes/${id}/stats`, { query: { bracket } }),
  getHeroBuilds: (id: number) => apiFetch<TrimmedBuild[]>(`/heroes/${id}/builds`),
  getHeroMatchups: (id: number, bracket?: HeroBracket) =>
    apiFetch<MatchupEntry[]>(`/heroes/${id}/matchups`, { query: { bracket } }),
  getHeroCounters: (id: number) => apiFetch<HeroCountersResponse>(`/heroes/${id}/counters`),
  getHeroSynergies: (id: number) => apiFetch<HeroSynergiesResponse>(`/heroes/${id}/synergies`),
  //Items use an INTEGER badge-bucket (0..5; 0 = all) — see lib/brackets.ts. The
  //label fix (badge tiers, not MMR ranges) lives in the UI; this just forwards
  //the bucket the backend's `bracket_badge_range` expects.
  getItems: (bracket?: number) => apiFetch<ItemStat[]>('/items/stats', { query: { bracket } }),
  getRecentMatches: () => apiFetch<MatchRow[]>('/matches/recent'),

  //per-match / per-user surface (CSR islands)
  getMatch: (id: number) => apiFetch<MatchDetail>(`/matches/${id}`),
  searchPlayers: (q: string, limit?: number) =>
    apiFetch<SearchResult[]>('/players/search', { query: { q, limit } }),
  getPlayer: (id: number) => apiFetch<PlayerProfileResponse>(`/players/${id}`),
  getPlayerMatches: (id: number, params?: { limit?: number; cursor?: string; hero_id?: number }) =>
    apiFetch<PlayerMatchRow[]>(`/players/${id}/matches`, { query: params }),
  getPlayerMmr: (id: number) => apiFetch<MMRHistoryRow[]>(`/players/${id}/mmr`),
  getPlayerHeroes: (id: number) => apiFetch<HeroLedgerRow[]>(`/players/${id}/heroes`),
  getPlayerHeroesPlayed: (id: number) => apiFetch<HeroPlayed[]>(`/players/${id}/heroes-played`),
  getPlayerBadgeHistory: (id: number) => apiFetch<BadgeHistoryRow[]>(`/players/${id}/badge-history`),
  getPlayerPerformance: (id: number) => apiFetch<PerformanceResponse>(`/players/${id}/performance`),
  getPlayerCompare: (id: number, params?: { hero?: number; league_offset?: string }) =>
    apiFetch<CompareResponse>(`/players/${id}/compare`, { query: params }),
  getPlayerImprove: (id: number, params?: { hero?: number; window?: string; vs_tier?: number }) =>
    apiFetch<ImproveResponse>(`/players/${id}/improve`, { query: params }),

  //patch tracking (C9) — fully built backend, previously zero FE refs (§A.4).
  getPatches: () => apiFetch<Patch[]>('/patches'),
  getCurrentPatch: () => apiFetch<Patch>('/patches/current'),
  getPatch: (id: string, bracket?: number) =>
    apiFetch<PatchDetail>(`/patches/${id}`, { query: { bracket } }),
  getPatchMovers: (id: string, params?: { bracket?: number; limit?: number }) =>
    apiFetch<PatchMovers>(`/patches/${id}/movers`, { query: params }),

  //Build Lab (C9) — base stats + item modifiers (§A.4). Note: hero_base_stats is
  //empty locally until the patch snapshot hook runs, so these empty-state.
  getHeroBaseStats: (patch_id?: string) =>
    apiFetch<HeroBaseStats[]>('/heroes/base-stats', { query: { patch_id } }),
  getHeroBaseStatsOne: (id: number, patch_id?: string) =>
    apiFetch<HeroBaseStats>(`/heroes/${id}/base-stats`, { query: { patch_id } }),
  getItemModifiers: (params?: { slot?: string; tier?: number }) =>
    apiFetch<ItemModifier[]>('/items/modifiers', { query: params }),

  //Lane Lab (rich-analytics tier — RICH_ANALYTICS_ENABLED gate). Served by the standalone Lane Lab
  //SERVICE (ranklock-lane-lab) via `laneLabFetch`/LANE_LAB_BASE, not the main API. `band` is the
  //rank tier (badge/10, 0..11); omit it to aggregate all bands. 501 while the flag is off, 202 until
  //the lane producers have run — callers empty-state both.
  //NOTE: these `/lane-lab/*` paths mirror deadlock-backend/src/handlers/lane_lab.rs (the API the
  //frontend was modeled on). The standalone service currently exposes /cohort/economy-curve +
  ///me/economy-overlay instead — see the C4 deliverable for the route-reconciliation the owner/next
  //component must land (service grows /lane-lab/* OR this island is reworked to the /cohort/* shape).
  getLaneEconomyCurve: (params?: { band?: number; metric?: string }) =>
    laneLabFetch<LaneCurveResponse>('/lane-lab/economy-curve', { query: params }),
  getLaneEarlyEconVerdict: (params?: { band?: number }) =>
    laneLabFetch<EarlyEconVerdictResponse>('/lane-lab/early-econ-verdict', { query: params }),

  //stats + session
  getRankDistribution: () => apiFetch<RankBucket[]>('/stats/rank-distribution'),
  getCurrentUser: () => apiFetch<CurrentUser>('/me'),
};

export type ApiClient = typeof api;
