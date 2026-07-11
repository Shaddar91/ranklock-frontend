import { describe, it, expect } from 'vitest';
import { rewriteAssetUrl, resolveAsset, DEADLOCK_ASSETS_HOST } from './assets';

const OURS = 'https://assets.ranklock.app';
const UP_HERO = 'https://assets-bucket.deadlock-api.com/assets-api-res/images/heroes/backgrounds/haze_bg.png';
const OURS_HERO = 'https://assets.ranklock.app/heroes/backgrounds/haze_bg.png';
const UP_ITEM = 'https://assets-bucket.deadlock-api.com/assets-api-res/images/items/spirit/improved_spirit.webp';
const OURS_ITEM = 'https://assets.ranklock.app/items/spirit/improved_spirit.webp';

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

describe('resolveAsset (build-time base)', () => {
  it('defaults to theirs so the shipped v1 build is unchanged', () => {
    //No PUBLIC_ASSETS_BASE in the test env => default upstream host => no-op.
    expect(resolveAsset(UP_HERO)).toBe(UP_HERO);
    expect(resolveAsset(null)).toBeNull();
  });
});
