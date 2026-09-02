import { describe, expect, it } from 'vitest';
import { heroNarrative, type HeroNarrativeInput } from './heroNarrative';
import { plainText } from './narrative';
import type { HeroSummary } from '../types/api';

const mk = (id: number, name: string, wr: number | null, picks: number, k = 6, d = 6, a = 8, nw = 40000): HeroSummary => ({
  hero_id: id, hero_name: name, icon_url: null, picks, win_rate: wr, avg_kills: k, avg_deaths: d, avg_assists: a, avg_net_worth: nw, avg_duration_s: null,
});
const roster = [
  mk(1, 'Abrams', 49, 900000), mk(2, 'Seven', 55.9, 1900000, 9, 5, 12, 52000), mk(3, 'Bebop', 50.5, 1200000),
  mk(4, 'Haze', 52.6, 2000000, 11, 7, 10, 45000), mk(5, 'Lash', 50.8, 600000, 7, 4, 9, 38000), mk(6, 'Wraith', 47, 300000, 5, 8, 6, 30000),
  mk(7, 'Kelvin', 51, 700000), mk(8, 'Dynamo', 48.5, 500000),
];
const names = new Map(roster.map((h) => [h.hero_id, h.hero_name]));
const haze = roster[3] as HeroSummary;
function input(hero: HeroSummary, extra: Partial<HeroNarrativeInput> = {}): HeroNarrativeInput {
  return {
    hero, roster, matchups: [], synergies: [], items: [], brackets: [],
    heroName: (id) => names.get(id) ?? `Hero ${id}`,
    statsThrough: 'Aug 23, 2026', window: { lo: 'May 1, 2026', hi: 'Aug 23, 2026' }, patchesInWindow: 13,
    currentPatch: { label: '1.2', since: 'Aug 20, 2026' }, ...extra,
  };
}
const full = (hero: HeroSummary) =>
  input(hero, {
    matchups: [
      { hero_b_id: 1, matches: 400000, hero_a_wins: 232000, win_rate: 0.58 },
      { hero_b_id: 2, matches: 380000, hero_a_wins: 167200, win_rate: 0.44 },
      { hero_b_id: 3, matches: 390000, hero_a_wins: 198900, win_rate: 0.51 },
      { hero_b_id: 5, matches: 50, hero_a_wins: 45, win_rate: 0.9 },
    ],
    synergies: [
      { partnerId: 2, matches: 50000, winRate: 56 }, { partnerId: 3, matches: 80000, winRate: 52 }, { partnerId: 5, matches: 20000, winRate: 58 },
    ],
    items: [
      { item_id: 10, item_name: 'Boundless Spirit', win_rate: 0.63, games: 60000 },
      { item_id: 11, item_name: 'Improved Spirit', win_rate: 0.51, games: 900000 },
      { item_id: 12, item_name: 'Extra Health', win_rate: 0.5, games: 800000 },
    ],
    brackets: [
      { key: 'low', label: 'Obscurus to Archon', roster: [mk(4, 'Haze', 54, 900000), mk(2, 'Seven', 53, 800000), mk(1, 'Abrams', 49, 500000)] },
      { key: 'high', label: 'Ascendant and Eternus 1 to 5', roster: [mk(4, 'Haze', 50, 90000), mk(2, 'Seven', 57, 100000), mk(1, 'Abrams', 51, 40000)] },
    ],
  });

describe('heroNarrative', () => {
  it('reads a high-win, high-pick hero as a meta pick with roster ranks', () => {
    const text = plainText(heroNarrative(input(haze)));
    expect(text).toContain('How Haze performs');
    expect(text).toContain('2nd of 8 heroes by win rate');
    expect(text).toContain('1st most played hero');
    expect(text).toContain('meta pick');
  });
  it('reads a low-win, low-pick hero as left behind', () => {
    expect(plainText(heroNarrative(input(roster[5] as HeroSummary)))).toContain('left behind');
  });
  it('names best and worst matchups, partners and items with links', () => {
    const sections = heroNarrative(full(haze));
    const text = plainText(sections);
    expect(text).toContain('winning record against 2 of its 3 common opponents');
    expect(text).toContain('Abrams (58.0% over 400,000 games)');
    expect(text).toContain('loses more than it wins against Seven (44.0% over 380,000 games)');
    expect(text).toContain('draft matters more');
    expect(text).toContain('Bebop is also its most common partner');
    expect(text).toContain('Boundless Spirit (63.0%)');
    expect(text).toContain('Improved Spirit is also the most bought item');
    expect(text).toContain('lower-volume buys');
    expect(text).toContain('loses 4.0 points between Obscurus to Archon and Ascendant and Eternus 1 to 5');
    const hrefs = sections.flatMap((s) => s.paras.flat()).filter((seg) => typeof seg !== 'string').map((seg) => (seg as { href: string }).href);
    expect(hrefs).toContain('/heroes/abrams/');
    expect(hrefs).toContain('/items/10/');
    expect(hrefs.every((h) => h.endsWith('/'))).toBe(true);
  });
  it('never leaks NaN or undefined and differs between heroes', () => {
    const a = plainText(heroNarrative(full(haze)));
    const b = plainText(heroNarrative(full(roster[1] as HeroSummary)));
    for (const t of [a, b]) {
      expect(t).not.toMatch(/NaN|undefined|null/);
    }
    expect(a).not.toBe(b);
  });
  it('collapses to the disabled note for a hero without games', () => {
    const sections = heroNarrative(input(mk(9, 'Ghost', null, 0)));
    expect(sections.map((s) => s.heading)).toEqual(['About these numbers']);
    expect(plainText(sections)).toContain('marked disabled');
  });
});
