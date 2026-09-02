import { describe, it, expect } from 'vitest';
import { heroArt, heroClass } from './heroArt';
import { DEADLOCK_ASSETS_HOST } from './assets';
import upstream from './fixtures/upstream-hero-backgrounds.json';

const OURS = 'https://assets.ranklock.app';
const UP = `${DEADLOCK_ASSETS_HOST}/assets-api-res/images/heroes`;
const UP_ICONS = `${DEADLOCK_ASSETS_HOST}/assets-api-res/icons`;
const BEBOP_CARD = `${UP}/bebop_card.png`;

describe('heroClass', () => {
  it('extracts the class slug from a hero card url on either base', () => {
    expect(heroClass(BEBOP_CARD)).toBe('bebop');
    expect(heroClass(`${OURS}/heroes/bull_card.webp`)).toBe('bull');
  });

  it('is null for nullish, foreign, item and non-card hero urls', () => {
    expect(heroClass(null)).toBeNull();
    expect(heroClass(undefined)).toBeNull();
    expect(heroClass('')).toBeNull();
    expect(heroClass('https://example.com/heroes/bebop_card.png'.replace('example.com/heroes', 'example.com/x'))).toBeNull();
    expect(heroClass(`${DEADLOCK_ASSETS_HOST}/assets-api-res/images/items/spirit/improved_spirit.png`)).toBeNull();
    expect(heroClass(`${UP}/backgrounds/bebop_bg.png`)).toBeNull();
    expect(heroClass(`${UP}/bebop_sm.png`)).toBeNull();
  });
});

describe('heroArt', () => {
  it('derives every variant from the card url, webp-first on the upstream (default) base', () => {
    expect(heroArt(BEBOP_CARD, DEADLOCK_ASSETS_HOST)).toEqual({
      cls: 'bebop',
      card: `${UP}/bebop_card.webp`,
      cardGloat: `${UP}/bebop_card_gloat.webp`,
      cardCritical: `${UP}/bebop_card_critical.webp`,
      small: `${UP}/bebop_sm.webp`,
      minimap: `${UP}/bebop_mm.webp`,
      vertical: `${UP}/bebop_vertical.webp`,
      background: `${UP}/backgrounds/bebop_bg.webp`,
      nameSvg: `${UP_ICONS}/bebop.svg`,
    });
    //no explicit base => the build-time ASSETS_BASE, upstream in the test env
    expect(heroArt(BEBOP_CARD)?.cardGloat).toBe(`${UP}/bebop_card_gloat.webp`);
  });

  it('rewrites onto our base when flipped and keeps the webp preference', () => {
    const art = heroArt(BEBOP_CARD, OURS);
    expect(art?.cardGloat).toBe(`${OURS}/heroes/bebop_card_gloat.webp`);
    expect(art?.background).toBe(`${OURS}/heroes/backgrounds/bebop_bg.webp`);
    expect(art?.minimap).toBe(`${OURS}/heroes/bebop_mm.webp`);
    //the plate keeps the upstream stem where it differs from the class; the card variants keep the class
    expect(heroArt(`${UP}/gigawatt_card.png`, OURS)?.background).toBe(`${OURS}/heroes/backgrounds/seven_bg.webp`);
    expect(heroArt(`${UP}/gigawatt_card.png`, OURS)?.cardGloat).toBe(`${OURS}/heroes/gigawatt_card_gloat.webp`);
    //an already-rewritten card url (our base) derives the same set
    expect(heroArt(`${OURS}/heroes/bebop_card.webp`, OURS)?.vertical).toBe(`${OURS}/heroes/bebop_vertical.webp`);
  });

  it('maps the name wordmark by display-name slug and never moves it off the upstream host', () => {
    expect(heroArt(`${UP}/bull_card.png`, OURS)?.nameSvg).toBe(`${UP_ICONS}/abrams.svg`);
    expect(heroArt(`${UP}/digger_card.png`, OURS)?.nameSvg).toBe(`${UP_ICONS}/mo_krill.svg`);
    expect(heroArt(`${UP}/spectre_card.png`)?.nameSvg).toBe(`${UP_ICONS}/lady_geist.svg`);
    expect(heroArt(`${UP}/doorman_card.png`, OURS)?.nameSvg).toBe(`${UP_ICONS}/doorman.svg`);
  });

  it('keys the background plate by the upstream stem for every released hero', () => {
    expect(upstream.heroes).toHaveLength(38);
    for (const h of upstream.heroes) {
      const card = `${UP}/${h.icon_hero_card}_card.png`;
      expect(heroArt(card, OURS)?.background, h.name).toBe(`${OURS}/heroes/backgrounds/${h.background_image}.webp`);
      expect(heroArt(card, DEADLOCK_ASSETS_HOST)?.background, h.name).toBe(`${UP}/backgrounds/${h.background_image}.webp`);
    }
  });

  it('returns null when the url is not a hero card so the monogram fallback still fires', () => {
    expect(heroArt(null)).toBeNull();
    expect(heroArt(undefined)).toBeNull();
    expect(heroArt('')).toBeNull();
    expect(heroArt(`${UP}/backgrounds/bebop_bg.png`)).toBeNull();
    expect(heroArt(`${DEADLOCK_ASSETS_HOST}/assets-api-res/images/items/spirit/improved_spirit.png`)).toBeNull();
    expect(heroArt('/assets/ranks/rank07-archon.png')).toBeNull();
  });
});
