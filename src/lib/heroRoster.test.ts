import { describe, it, expect, vi, afterEach } from 'vitest';
import { isUnreleased, releasedRoster, UNRELEASED_NAME_PREFIX } from './heroRoster';

const row = (hero_id: number, hero_name: string) => ({ hero_id, hero_name });
const released = [row(15, 'Bebop'), row(13, 'Haze')];
const leaked = [...released, row(48, 'Unknown Hero 48 (disabled)'), row(55, 'Unknown Hero 55 (disabled)')];

afterEach(() => vi.restoreAllMocks());

describe('isUnreleased', () => {
  it('flags only the gap-fill placeholder names', () => {
    expect(UNRELEASED_NAME_PREFIX).toBe('Unknown Hero');
    expect(isUnreleased(row(48, 'Unknown Hero 48 (disabled)'))).toBe(true);
    expect(isUnreleased(row(99, 'Unknown Hero 99'))).toBe(true);
    expect(isUnreleased(row(15, 'Bebop'))).toBe(false);
    expect(isUnreleased(row(69, 'The Doorman'))).toBe(false);
  });
});

describe('releasedRoster', () => {
  it('passes a clean roster through untouched (same reference, same order)', () => {
    expect(releasedRoster(released, 'test', true)).toBe(released);
    expect(releasedRoster(released, 'test', false)).toBe(released);
  });

  it('strict (the build) throws and names every leaked id', () => {
    expect(() => releasedRoster(leaked, 'heroes/[id]', true)).toThrow(/released-roster guard/);
    expect(() => releasedRoster(leaked, 'heroes/[id]', true)).toThrow(/heroes\/\[id\]/);
    expect(() => releasedRoster(leaked, 'sitemap.xml', true)).toThrow(/48 "Unknown Hero 48 \(disabled\)", 55 "Unknown Hero 55 \(disabled\)"/);
  });

  it('non-strict (dev) drops the leaked rows with one warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(releasedRoster(leaked, 'sitemap.xml', false)).toEqual(released);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/sitemap\.xml: dropping 2 unreleased hero\(es\): 48 /);
  });

  it('defaults strict to the build flag, which is off under vitest', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(releasedRoster(leaked, 'default')).toEqual(released);
  });
});
