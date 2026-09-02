import { describe, it, expect, vi, afterEach } from 'vitest';
import { api, queryKeys, ApiError, isComputing, isDisabled } from './apiClient';

//Wire contract for the hero-itemset win-rate endpoints (E1 build-stats, E2 scored
//builds): the exact query the client sends, the cache keys that must not collide,
//and the 202/501 classification the page branches on.

const jsonOk = (body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }));

const urlOf = (fetchMock: ReturnType<typeof vi.fn>) => new URL(String(fetchMock.mock.calls[0]?.[0]));

afterEach(() => vi.unstubAllGlobals());

describe('getHeroBuildStats (E1)', () => {
  it('defaults to tier=0 all-ranks and Ranked', async () => {
    const f = jsonOk({ hero_id: 15, tier: 0, match_mode: 'Ranked', game_mode: 'Normal', item_sets: [], buy_order: [] });
    vi.stubGlobal('fetch', f);
    await api.getHeroBuildStats(15);
    const url = urlOf(f);
    expect(url.pathname).toBe('/heroes/15/build-stats');
    expect(url.searchParams.get('tier')).toBe('0');
    expect(url.searchParams.get('match_mode')).toBe('Ranked');
  });

  it('surfaces 202 as computing and 501 as disabled, not as an outage', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"status":"computing","retry_after":3600}', { status: 202 })));
    const computing = await api.getHeroBuildStats(15).catch((e: unknown) => e);
    expect(isComputing(computing)).toBe(true);

    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 501 })));
    const disabled = await api.getHeroBuildStats(15).catch((e: unknown) => e);
    expect(isDisabled(disabled)).toBe(true);
    expect((disabled as ApiError).status).toBe(501);
  });

  it('serves a folded-but-empty 200 as data, not as a cold state', async () => {
    const f = jsonOk({ hero_id: 15, tier: 0, match_mode: 'Ranked', game_mode: 'Normal', item_sets: [], buy_order: [] });
    vi.stubGlobal('fetch', f);
    const stats = await api.getHeroBuildStats(15);
    expect(stats.item_sets).toEqual([]);
    expect(stats.buy_order).toEqual([]);
  });
});

describe('getHeroBuilds scored flag (E2)', () => {
  it('omits the flag entirely when unscored — the plain contract is byte-identical', async () => {
    const f = jsonOk([]);
    vi.stubGlobal('fetch', f);
    await api.getHeroBuilds(15, 'weekly');
    expect(urlOf(f).searchParams.has('scored')).toBe(false);
  });

  it('sends scored=1 when opted in', async () => {
    const f = jsonOk([]);
    vi.stubGlobal('fetch', f);
    await api.getHeroBuilds(15, 'weekly', true);
    expect(urlOf(f).searchParams.get('scored')).toBe('1');
  });
});

describe('cache keys', () => {
  it('keys the scored list apart from the plain one', () => {
    expect(queryKeys.heroBuilds(15, 'weekly', true)).not.toEqual(queryKeys.heroBuilds(15, 'weekly'));
  });
  it('keys build-stats per tier and match mode', () => {
    expect(queryKeys.heroBuildStats(15)).toEqual(['hero', 15, 'build-stats', 0, 'Ranked']);
    expect(queryKeys.heroBuildStats(15, 1)).not.toEqual(queryKeys.heroBuildStats(15, 0));
  });
});
