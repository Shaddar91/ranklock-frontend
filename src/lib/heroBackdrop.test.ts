import { describe, it, expect } from 'vitest';
import { BACKDROP_HEROES, BACKDROP_SMALL_MQ, BACKDROP_STEM, backdropStem, heroBackdropArt } from './heroBackdrop';
import { DEADLOCK_ASSETS_HOST } from './assets';
import upstream from './fixtures/upstream-hero-backgrounds.json';

const OURS = 'https://assets.ranklock.app';
const UP_BG = `${DEADLOCK_ASSETS_HOST}/assets-api-res/images/heroes/backgrounds`;
const RELEASED = upstream.heroes;
const RENAMED = RELEASED.filter((h) => h.background_image !== `${h.icon_hero_card}_bg`);

describe('heroBackdropArt', () => {
  it('serves the verified upstream webp twin on the default (upstream) base', () => {
    expect(heroBackdropArt('haze', DEADLOCK_ASSETS_HOST)).toEqual({
      url: 'https://assets-bucket.deadlock-api.com/assets-api-res/images/heroes/backgrounds/haze_bg.webp',
    });
    //no explicit base => the build-time ASSETS_BASE, upstream in the test env
    expect(heroBackdropArt('haze').url).toBe(
      'https://assets-bucket.deadlock-api.com/assets-api-res/images/heroes/backgrounds/haze_bg.webp',
    );
  });

  it('serves the R2-only opt/ variant pair on our base', () => {
    expect(heroBackdropArt('haze', OURS)).toEqual({
      url: `${OURS}/heroes/backgrounds/opt/haze_bg_1920.webp`,
      smallUrl: `${OURS}/heroes/backgrounds/opt/haze_bg_828.webp`,
    });
  });

  it('always resolves a full-size url — the small plate is additive, never a replacement', () => {
    expect(heroBackdropArt('warden', OURS).url).toBe(`${OURS}/heroes/backgrounds/opt/warden_bg_1920.webp`);
    expect(BACKDROP_SMALL_MQ).toBe('(max-width: 828px)');
  });

  it('keys a renamed plate by the upstream stem, not the card class', () => {
    expect(heroBackdropArt('gigawatt', OURS)).toEqual({
      url: `${OURS}/heroes/backgrounds/opt/seven_bg_1920.webp`,
      smallUrl: `${OURS}/heroes/backgrounds/opt/seven_bg_828.webp`,
    });
    expect(heroBackdropArt('spectre', DEADLOCK_ASSETS_HOST).url).toBe(`${UP_BG}/geist_bg.webp`);
  });

  it('resolves every released hero to the plate upstream ships, on both bases', () => {
    expect(RELEASED).toHaveLength(38);
    for (const h of RELEASED) {
      expect(backdropStem(h.icon_hero_card), h.name).toBe(h.background_image);
      expect(heroBackdropArt(h.icon_hero_card, OURS), h.name).toEqual({
        url: `${OURS}/heroes/backgrounds/opt/${h.background_image}_1920.webp`,
        smallUrl: `${OURS}/heroes/backgrounds/opt/${h.background_image}_828.webp`,
      });
      expect(heroBackdropArt(h.icon_hero_card, DEADLOCK_ASSETS_HOST), h.name).toEqual({
        url: `${UP_BG}/${h.background_image}.webp`,
      });
    }
  });

  it('maps exactly the classes whose upstream plate stem differs, no more, no fewer', () => {
    expect(RENAMED).toHaveLength(18);
    expect(Object.keys(BACKDROP_STEM).sort()).toEqual(RENAMED.map((h) => h.icon_hero_card).sort());
  });

  it('rotates only through released classes, so every roster plate exists', () => {
    const released = new Set(RELEASED.map((h) => h.icon_hero_card));
    for (const cls of BACKDROP_HEROES) expect(released.has(cls), cls).toBe(true);
  });
});
