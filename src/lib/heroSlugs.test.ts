import { describe, expect, it } from 'vitest';
import { HERO_IDENTITY, HERO_ID_REDIRECTS, heroPath, heroSlug, idOf, slugOf, slugRoster } from './heroSlugs';

const row = (hero_id: number, hero_name: string) => ({ hero_id, hero_name });

describe('heroSlug', () => {
  it('lowercases and collapses every non-alphanumeric run to one hyphen', () => {
    expect(heroSlug('Haze')).toBe('haze');
    expect(heroSlug('Lady Geist')).toBe('lady-geist');
    expect(heroSlug('Mo & Krill')).toBe('mo-krill');
    expect(heroSlug('Grey Talon')).toBe('grey-talon');
    expect(heroSlug('The Doorman')).toBe('the-doorman');
    expect(heroSlug('McGinnis')).toBe('mcginnis');
  });
  it('trims edge hyphens and yields empty for a name with no alphanumerics', () => {
    expect(heroSlug(' -- Ivy -- ')).toBe('ivy');
    expect(heroSlug('???')).toBe('');
  });
  it('builds a trailing-slash page path', () => {
    expect(heroPath('Mo & Krill')).toBe('/heroes/mo-krill/');
  });
});

describe('pinned identity table', () => {
  it('covers the 38 released heroes with unique non-empty slugs', () => {
    expect(HERO_IDENTITY).toHaveLength(38);
    const slugs = HERO_IDENTITY.map((h) => h.slug);
    expect(new Set(slugs).size).toBe(38);
    expect(slugs.every((s) => s.length > 0)).toBe(true);
  });
  it('resolves ids and slugs both ways', () => {
    expect(slugOf(13)).toBe('haze');
    expect(slugOf(18)).toBe('mo-krill');
    expect(idOf('haze')).toBe(13);
    expect(slugOf(999)).toBeNull();
    expect(idOf('nobody')).toBeNull();
  });
  it('maps every numeric hero URL to a 301 at its slug, apex and per locale', () => {
    expect(Object.keys(HERO_ID_REDIRECTS)).toHaveLength(38 * 7);
    expect(HERO_ID_REDIRECTS['/heroes/13']).toEqual({ status: 301, destination: '/heroes/haze/' });
    expect(HERO_ID_REDIRECTS['/heroes/4']).toEqual({ status: 301, destination: '/heroes/lady-geist/' });
    expect(HERO_ID_REDIRECTS['/ru/heroes/13']).toEqual({ status: 301, destination: '/ru/heroes/haze/' });
    expect(HERO_ID_REDIRECTS['/en/heroes/13']).toBeUndefined();
    for (const [from, to] of Object.entries(HERO_ID_REDIRECTS)) {
      expect(from).toMatch(/^(\/[a-z]{2})?\/heroes\/\d+$/);
      expect(to.destination).toMatch(/^(\/[a-z]{2})?\/heroes\/[a-z0-9-]+\/$/);
    }
  });
});

describe('slugRoster', () => {
  it('attaches slugs and accepts a hero the pinned table does not know', () => {
    const rows = slugRoster([row(13, 'Haze'), row(82, 'Newcomer')], 'test', true);
    expect(rows.map((r) => r.slug)).toEqual(['haze', 'newcomer']);
  });
  it('refuses a pinned hero renamed out from under its 301', () => {
    expect(() => slugRoster([row(13, 'Hazel')], 'test', true)).toThrow(/\/heroes\/13\/ redirects to \/heroes\/haze\//);
  });
  it('refuses a collision and an empty slug', () => {
    expect(() => slugRoster([row(90, 'Rem'), row(91, 'REM')], 'test', true)).toThrow(/collides/);
    expect(() => slugRoster([row(92, '???')], 'test', true)).toThrow(/empty string/);
  });
  it('drops the offending rows instead of throwing outside a production build', () => {
    const rows = slugRoster([row(13, 'Haze'), row(90, 'Rem'), row(91, 'REM')], 'test', false);
    expect(rows.map((r) => r.hero_id)).toEqual([13, 90]);
  });
});
