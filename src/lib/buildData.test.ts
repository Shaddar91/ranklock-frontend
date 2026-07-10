import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildFetch, buildFetchNonEmpty } from './buildData';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('buildFetch', () => {
  it('returns the resolved value', async () => {
    await expect(buildFetch(Promise.resolve([1, 2]), [])).resolves.toEqual([1, 2]);
  });

  it('falls back on rejection instead of throwing', async () => {
    await expect(buildFetch(Promise.reject(new Error('cold origin')), 'fb')).resolves.toBe('fb');
  });

  it('falls back when the promise does not settle within ms', async () => {
    const never = new Promise<string>(() => {});
    await expect(buildFetch(never, 'fb', 20)).resolves.toBe('fb');
  });
});

describe('buildFetchNonEmpty (bake-empty guard)', () => {
  it('passes non-empty rows through', async () => {
    await expect(buildFetchNonEmpty(Promise.resolve([{ id: 1 }]), '/items/stats')).resolves.toEqual([
      { id: 1 },
    ]);
  });

  it('throws when the bake resolves empty', async () => {
    await expect(buildFetchNonEmpty(Promise.resolve([]), '/items/stats')).rejects.toThrow(
      /bake-empty guard.*\/items\/stats/,
    );
  });

  it('throws when the origin rejects (fallback would be empty)', async () => {
    await expect(
      buildFetchNonEmpty(Promise.reject(new Error('ECONNREFUSED')), '/items/stats'),
    ).rejects.toThrow(/baked 0 rows/);
  });

  it('throws when the origin hangs past the timeout', async () => {
    const never = new Promise<unknown[]>(() => {});
    await expect(buildFetchNonEmpty(never, '/items/stats', 20)).rejects.toThrow(/bake-empty guard/);
  });

  it('ALLOW_EMPTY_STATS_BUILD=1 lets an intentional empty build through', async () => {
    vi.stubEnv('ALLOW_EMPTY_STATS_BUILD', '1');
    await expect(buildFetchNonEmpty(Promise.resolve([]), '/items/stats')).resolves.toEqual([]);
  });

  it('ALLOW_EMPTY_STATS_BUILD must be exactly "1" — other values still guard', async () => {
    vi.stubEnv('ALLOW_EMPTY_STATS_BUILD', 'true');
    await expect(buildFetchNonEmpty(Promise.resolve([]), '/items/stats')).rejects.toThrow(
      /bake-empty guard/,
    );
  });
});
