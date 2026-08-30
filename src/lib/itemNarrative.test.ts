import { describe, expect, it } from 'vitest';
import { itemNarrative, type ItemFacts, type ItemNarrativeInput } from './itemNarrative';
import { plainText } from './narrative';

const facts = (over: Partial<ItemFacts> = {}): ItemFacts => ({
  item_id: 7409189, name: 'Improved Spirit', cost: 1250, tier: 2, slot: 'spirit', active: false,
  win_rate: 50.79, matches: 7959671, players: 770342,
  avg_buy_time_s: 840, avg_buy_time_relative: 36.8, avg_sell_time_s: 1795, avg_sell_time_relative: 73.5, ...over,
});
const input = (over: Partial<ItemNarrativeInput> = {}): ItemNarrativeInput => ({
  item: facts(),
  all: [
    { item_id: 7409189, win_rate: 50.79, matches: 7959671 }, { item_id: 1, win_rate: 55.2, matches: 500000 },
    { item_id: 2, win_rate: 48.1, matches: 3000000 }, { item_id: 3, win_rate: 51.0, matches: 900000 },
  ],
  peers: [
    { item_id: 7409189, name: 'Improved Spirit', win_rate: 50.79, matches: 7959671 },
    { item_id: 1, name: 'Mystic Burst', win_rate: 55.2, matches: 500000 },
    { item_id: 3, name: 'Spirit Strike', win_rate: 51.0, matches: 900000 },
  ],
  heroes: [
    { hero_id: 13, name: 'Haze', games: 800000, win_rate: 0.52 },
    { hero_id: 2, name: 'Seven', games: 300000, win_rate: 0.55 },
    { hero_id: 1, name: 'Abrams', games: 100, win_rate: 0.6 },
  ],
  ...over,
});

describe('itemNarrative', () => {
  it('ranks the item against all items and its slot/tier peers with timing', () => {
    const text = plainText(itemNarrative(input()));
    expect(text).toContain('How Improved Spirit performs');
    expect(text).toContain('3rd of 4 items by win rate');
    expect(text).toContain('1st most bought item');
    expect(text).toContain('Among the 3 tier 2 spirit items it ranks 3rd');
    expect(text).toContain('behind Mystic Burst at 55.2%');
    expect(text).toContain('bought around 14:00');
    expect(text).toContain('stepping-stone');
  });
  it('names the heroes who win with it and who buy it', () => {
    const sections = itemNarrative(input());
    const text = plainText(sections);
    expect(text).toContain('wins most often on Seven (55.0%) and Haze (52.0%)');
    expect(text).toContain('The heroes who buy it most are Haze and Seven.');
    expect(text).toContain('Haze is both a frequent and a winning buyer');
    const hrefs = sections.flatMap((s) => s.paras.flat()).filter((seg) => typeof seg !== 'string').map((seg) => (seg as { href: string }).href);
    expect(hrefs).toContain('/heroes/13/');
    expect(hrefs).toContain('/items/1/');
  });
  it('reads late/early timing', () => {
    expect(plainText(itemNarrative(input({ item: facts({ avg_buy_time_relative: 65, avg_buy_time_s: 1500 }) })))).toContain('bought late');
    expect(plainText(itemNarrative(input({ item: facts({ avg_buy_time_relative: 20, avg_buy_time_s: 300 }) })))).toContain('early buy');
  });
  it('falls back to the about note without stats and never leaks NaN', () => {
    const sections = itemNarrative(input({ item: facts({ win_rate: null, matches: null }), heroes: [] }));
    expect(sections.map((s) => s.heading)).toEqual(['About these numbers']);
    expect(plainText(itemNarrative(input()))).not.toMatch(/NaN|undefined|null/);
  });
});
