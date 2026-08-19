import { describe, it, expect } from 'vitest';
import { heroBackdropArt, BACKDROP_SMALL_MQ } from './heroBackdrop';
import { DEADLOCK_ASSETS_HOST } from './assets';

const OURS = 'https://assets.ranklock.app';

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
});
