import { describe, it, expect } from 'vitest';
import { rewriteAssetUrl, preferWebp, resolveAsset, DEADLOCK_ASSETS_HOST } from './assets';

const OURS = 'https://assets.ranklock.app';
const UP_HERO = 'https://assets-bucket.deadlock-api.com/assets-api-res/images/heroes/backgrounds/haze_bg.png';
const UP_HERO_WEBP = 'https://assets-bucket.deadlock-api.com/assets-api-res/images/heroes/backgrounds/haze_bg.webp';
const OURS_HERO = 'https://assets.ranklock.app/heroes/backgrounds/haze_bg.png';
const OURS_HERO_WEBP = 'https://assets.ranklock.app/heroes/backgrounds/haze_bg.webp';
const UP_ITEM = 'https://assets-bucket.deadlock-api.com/assets-api-res/images/items/spirit/improved_spirit.webp';
const OURS_ITEM = 'https://assets.ranklock.app/items/spirit/improved_spirit.webp';
const UP_UPGRADE_PNG = 'https://assets-bucket.deadlock-api.com/assets-api-res/images/upgrades/mods_armor/last_stand.png';
const OURS_UPGRADE_PNG = 'https://assets.ranklock.app/upgrades/mods_armor/last_stand.png';

describe('rewriteAssetUrl', () => {
  it('is a no-op on the default (upstream) base — v1 stays byte-for-byte', () => {
    expect(rewriteAssetUrl(UP_HERO, DEADLOCK_ASSETS_HOST)).toBe(UP_HERO);
    expect(rewriteAssetUrl(UP_HERO, undefined)).toBe(UP_HERO);
    expect(rewriteAssetUrl(UP_HERO, '')).toBe(UP_HERO);
  });

  it('rewrites the upstream image prefix onto our base when flipped', () => {
    expect(rewriteAssetUrl(UP_HERO, OURS)).toBe(OURS_HERO);
    expect(rewriteAssetUrl(UP_ITEM, OURS)).toBe(OURS_ITEM);
    //trailing slash on the base is tolerated (no double slash in the result)
    expect(rewriteAssetUrl(UP_HERO, `${OURS}/`)).toBe(OURS_HERO);
  });

  it('passes nullish through untouched so the GameIcon monogram fallback survives', () => {
    expect(rewriteAssetUrl(null, OURS)).toBeNull();
    expect(rewriteAssetUrl(undefined, OURS)).toBeUndefined();
    expect(rewriteAssetUrl('', OURS)).toBe('');
  });

  it('leaves already-local and foreign URLs untouched even when flipped', () => {
    expect(rewriteAssetUrl('/assets/ranks/rank07-archon.png', OURS)).toBe('/assets/ranks/rank07-archon.png');
    expect(rewriteAssetUrl('https://example.com/x.png', OURS)).toBe('https://example.com/x.png');
  });

  it('is idempotent — resolving an already-resolved URL is a no-op', () => {
    expect(rewriteAssetUrl(OURS_HERO, OURS)).toBe(OURS_HERO);
  });
});

describe('preferWebp', () => {
  it('swaps a covered (heroes) png to its webp twin on the upstream base', () => {
    expect(preferWebp(UP_HERO)).toBe(UP_HERO_WEBP);
    expect(preferWebp(UP_HERO, DEADLOCK_ASSETS_HOST)).toBe(UP_HERO_WEBP);
  });

  it('swaps on our base too — the mirror serves the same key space', () => {
    expect(preferWebp(UP_HERO, OURS)).toBe(UP_HERO_WEBP);
    expect(preferWebp(OURS_HERO, OURS)).toBe(OURS_HERO_WEBP);
  });

  it('leaves pngs in uncovered categories (upgrades/abilities/items) alone', () => {
    expect(preferWebp(UP_UPGRADE_PNG)).toBe(UP_UPGRADE_PNG);
    expect(preferWebp(UP_UPGRADE_PNG, OURS)).toBe(UP_UPGRADE_PNG);
    expect(preferWebp(OURS_UPGRADE_PNG, OURS)).toBe(OURS_UPGRADE_PNG);
  });

  it('passes through webp, svg, foreign, app-owned, and nullish URLs untouched', () => {
    expect(preferWebp(UP_ITEM, OURS)).toBe(UP_ITEM);
    expect(preferWebp(UP_HERO_WEBP, OURS)).toBe(UP_HERO_WEBP);
    expect(preferWebp('https://assets-bucket.deadlock-api.com/assets-api-res/images/heroes/haze.svg', OURS)).toBe(
      'https://assets-bucket.deadlock-api.com/assets-api-res/images/heroes/haze.svg',
    );
    expect(preferWebp('https://example.com/x.png', OURS)).toBe('https://example.com/x.png');
    expect(preferWebp('/assets/ranks/rank07-archon.png', OURS)).toBe('/assets/ranks/rank07-archon.png');
    expect(preferWebp(null, OURS)).toBeNull();
    expect(preferWebp(undefined, OURS)).toBeUndefined();
    expect(preferWebp('', OURS)).toBe('');
  });
});

describe('resolveAsset (build-time base)', () => {
  it('prefers the webp twin for covered game art on the default base', () => {
    //No PUBLIC_ASSETS_BASE in the test env => base is the upstream host.
    expect(resolveAsset(UP_HERO)).toBe(UP_HERO_WEBP);
  });

  it('passes nullish through and leaves uncovered or already-webp art alone', () => {
    expect(resolveAsset(null)).toBeNull();
    expect(resolveAsset(UP_ITEM)).toBe(UP_ITEM);
    expect(resolveAsset(UP_UPGRADE_PNG)).toBe(UP_UPGRADE_PNG);
  });
});
