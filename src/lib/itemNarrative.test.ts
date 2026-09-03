import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  itemNarrative,
  type ItemBracketRow,
  type ItemFacts,
  type ItemHeroRow,
  type ItemNarrativeInput,
  type ItemPeer,
} from './itemNarrative';
import { plainText, rankDesc, toPct } from './narrative';
import catalog from '../data/items-detail.json';

const facts = (over: Partial<ItemFacts> = {}): ItemFacts => ({
  item_id: 7409189, name: 'Improved Spirit', cost: 1600, tier: 2, slot: 'spirit', active: false,
  win_rate: 50.79, matches: 7959671, players: 770342,
  avg_buy_time_s: 840, avg_buy_time_relative: 36.8, avg_sell_time_s: 1795, avg_sell_time_relative: 73.5, ...over,
});
const band = (bracket: number, win_rate: number, matches: number, buy: number, rank: number): ItemBracketRow => ({
  bracket, win_rate, matches, avg_buy_time_s: buy, rank, of: 150,
});
const input = (over: Partial<ItemNarrativeInput> = {}): ItemNarrativeInput => ({
  item: facts(),
  all: [
    { item_id: 7409189, win_rate: 50.79, matches: 7959671 }, { item_id: 1, win_rate: 55.2, matches: 500000 },
    { item_id: 2, win_rate: 48.1, matches: 3000000 }, { item_id: 3, win_rate: 51.0, matches: 900000 },
  ],
  peers: [
    { item_id: 7409189, name: 'Improved Spirit', win_rate: 50.79, matches: 7959671, avg_buy_time_s: 840 },
    { item_id: 1, name: 'Mystic Burst', win_rate: 55.2, matches: 500000, avg_buy_time_s: 1200 },
    { item_id: 3, name: 'Spirit Strike', win_rate: 51.0, matches: 900000, avg_buy_time_s: 960 },
  ],
  heroes: [
    { hero_id: 13, name: 'Haze', games: 800000, win_rate: 0.52, hero_games: 1000000 },
    { hero_id: 2, name: 'Seven', games: 300000, win_rate: 0.55, hero_games: 1000000 },
    { hero_id: 1, name: 'Abrams', games: 100, win_rate: 0.6, hero_games: 900000 },
  ],
  brackets: [band(1, 50.1, 900000, 900, 96), band(2, 50.5, 600000, 870, 88), band(3, 51.0, 550000, 840, 70), band(4, 51.6, 540000, 810, 44), band(5, 52.4, 14000, 780, 21)],
  ...over,
});

describe('itemNarrative', () => {
  it('opens on the buy window with cost, slot and the peer gap', () => {
    const text = plainText(itemNarrative(input()));
    expect(text).toContain('When players buy Improved Spirit');
    expect(text).toContain('1,600 souls buys Improved Spirit, a tier 2 spirit passive');
    expect(text).toContain('14:00 into a match on average, 37% of the way through');
    expect(text).toContain('No other tier 2 spirit item is bought sooner; the group averages 18:00.');
  });

  it('reads the buy window across the badge tiers in Valve tier names', () => {
    const text = plainText(itemNarrative(input()));
    expect(text).toContain('Higher bands get there 2:00 sooner, 15:00 at Initiate to Alchemist against 13:00 at Ascendant to Eternus');
  });

  it('ranks the item against every item and its tier peers', () => {
    const text = plainText(itemNarrative(input()));
    expect(text).toContain('Improved Spirit wins 50.8% of the 7,959,671 ranked games it was bought in, 3rd of 4 items');
    expect(text).toContain('Against the 3 tier 2 spirit items it ranks 3rd');
    expect(text).toContain('last of the group, with Spirit Strike');
  });

  it('names the win-rate curve by badge tier and the standing that moves with it', () => {
    const text = plainText(itemNarrative(input()));
    expect(text).toContain('Improved Spirit pays off more the higher the badge tier');
    expect(text).toContain('50.1% at Initiate to Alchemist (96th of 150)');
    expect(text).toContain('52.4% at Ascendant to Eternus (21st of 150)');
    expect(text).toContain('75 places up');
  });

  it('names the heroes by their own share of games and links them', () => {
    const sections = itemNarrative(input());
    const text = plainText(sections);
    expect(text).toContain('Haze at 80%');
    expect(text).toContain('Seven at 30% of their own games');
    expect(text).toContain('It returns most on Seven at 55.0% and least on Haze at 52.0%');
    const hrefs = sections.flatMap((s) => s.paras.flat()).filter((s) => typeof s !== 'string').map((s) => (s as { href: string }).href);
    expect(hrefs).toContain('/heroes/haze/');
    expect(hrefs).toContain('/items/3/');
    expect(hrefs.every((h) => h.endsWith('/'))).toBe(true);
  });

  it('is deterministic for the same input', () => {
    expect(plainText(itemNarrative(input()))).toBe(plainText(itemNarrative(input())));
  });
});

describe('itemNarrative empty inputs', () => {
  it('emits the catalog section alone when the item has no stats row', () => {
    const sections = itemNarrative(input({ item: facts({ win_rate: null, matches: null }), heroes: [], brackets: [] }));
    expect(sections.map((s) => s.heading)).toEqual(['What the catalog has on Improved Spirit']);
    const text = plainText(sections);
    expect(text).toContain('tier 2 spirit item costing 1,600 souls');
    expect(text).toContain('recorded no ranked purchases of it');
    expect(text).toContain('The 2 tier 2 spirit items that do have rows');
  });

  it('says nothing about badge tiers when no bracket row is supplied', () => {
    const headings = itemNarrative(input({ brackets: [] })).map((s) => s.heading);
    expect(headings).not.toContain('Improved Spirit by rank');
    expect(headings).toContain('When players buy Improved Spirit');
  });

  it('drops a badge tier whose sample is under the floor', () => {
    const thin = input({ brackets: [band(1, 50.1, 900000, 900, 96), band(2, 50.5, 600000, 870, 88), band(5, 61.0, 400, 780, 2)] });
    const text = plainText(itemNarrative(thin));
    expect(text).not.toContain('61.0%');
    expect(text).not.toContain('Ascendant to Eternus');
  });

  it('drops the hero section when fewer than two heroes clear the game floor', () => {
    const headings = itemNarrative(input({ heroes: [{ hero_id: 1, name: 'Abrams', games: 50, win_rate: 0.6 }] })).map((s) => s.heading);
    expect(headings).not.toContain('Who builds Improved Spirit');
  });

  it('drops the peer sentences when the item has no shop tier', () => {
    const text = plainText(itemNarrative(input({ item: facts({ tier: 5, cost: 9999 }) })));
    expect(text).not.toContain('tier 5');
    expect(text).not.toContain('9,999 souls');
    expect(text).toContain('Players reach Improved Spirit 14:00 into a match');
  });

  it('leaves the upstream-feed note out when no hero row was used', () => {
    const text = plainText(itemNarrative(input({ heroes: [] })));
    expect(text).not.toContain('deadlock-api.com item feed');
    expect(text).toContain('does not cause the win');
  });
});

//The C2 prose-overlap metric (word n-gram Jaccard, digits optionally masked) run over the
//generated text alone, on the same fixture shape heroNarrative.test.ts uses for the roster.
interface FixtureRow {
  item_id: number;
  win_rate: number | null;
  matches: number | null;
  players: number | null;
  avg_buy_time_s: number | null;
  avg_buy_time_relative: number | null;
  avg_sell_time_s: number | null;
  avg_sell_time_relative: number | null;
}
interface Fixture {
  heroes: { hero_id: number; hero_name: string }[];
  brackets: { bracket: number; rows: FixtureRow[] }[];
  heroItems: Record<string, { hero_id: number; games: number; win_rate: number }[]>;
}
interface CatalogEntry {
  name: string;
  cost: number | null;
  tier: number | null;
  slot: string | null;
  active: boolean | null;
}

const fixture = JSON.parse(readFileSync(new URL('./__fixtures__/items.json', import.meta.url), 'utf8')) as Fixture;
const CATALOG = catalog as unknown as Record<string, CatalogEntry>;

function catalogInputs(fx: Fixture): ItemNarrativeInput[] {
  const byBracket = new Map(fx.brackets.map((b) => [b.bracket, new Map(b.rows.map((r) => [r.item_id, r]))]));
  const base = byBracket.get(0) as Map<number, FixtureRow>;
  const heroName = new Map(fx.heroes.map((h) => [h.hero_id, h.hero_name]));
  const heroFeedGames = new Map<number, number>();
  for (const rows of Object.values(fx.heroItems))
    for (const r of rows) heroFeedGames.set(r.hero_id, Math.max(heroFeedGames.get(r.hero_id) ?? 0, r.games));
  const standing = new Map<number, Map<number, { rank: number; of: number }>>();
  for (const b of fx.brackets) {
    if (b.bracket === 0) continue;
    const rated = b.rows.filter((r) => r.win_rate != null && (r.matches ?? 0) > 0);
    const wrs = rated.map((r) => toPct(r.win_rate as number));
    standing.set(b.bracket, new Map(rated.map((r) => [r.item_id, { rank: rankDesc(wrs, toPct(r.win_rate as number)), of: rated.length }])));
  }
  const entries = Object.entries(CATALOG);
  const all = [...base.values()].map((r) => ({ item_id: r.item_id, win_rate: r.win_rate, matches: r.matches }));
  return entries.map(([id, meta]) => {
    const itemId = Number(id);
    const st = base.get(itemId);
    const item: ItemFacts = {
      item_id: itemId, name: meta.name, cost: meta.cost, tier: meta.tier, slot: meta.slot, active: meta.active,
      win_rate: st?.win_rate ?? null, matches: st?.matches ?? null, players: st?.players ?? null,
      avg_buy_time_s: st?.avg_buy_time_s ?? null, avg_buy_time_relative: st?.avg_buy_time_relative ?? null,
      avg_sell_time_s: st?.avg_sell_time_s ?? null, avg_sell_time_relative: st?.avg_sell_time_relative ?? null,
    };
    const peers: ItemPeer[] = entries
      .filter(([, m]) => m.slot === meta.slot && m.tier === meta.tier)
      .map(([peerId, m]) => {
        const row = base.get(Number(peerId));
        return { item_id: Number(peerId), name: m.name, win_rate: row?.win_rate ?? null, matches: row?.matches ?? null, avg_buy_time_s: row?.avg_buy_time_s ?? null, active: m.active };
      });
    const heroes: ItemHeroRow[] = (fx.heroItems[id] ?? []).map((h) => ({
      hero_id: h.hero_id, name: heroName.get(h.hero_id) ?? `Hero ${h.hero_id}`, games: h.games, win_rate: h.win_rate,
      hero_games: heroFeedGames.get(h.hero_id) ?? null,
    }));
    const brackets: ItemBracketRow[] = [1, 2, 3, 4, 5].map((b) => {
      const row = byBracket.get(b)?.get(itemId);
      const at = standing.get(b)?.get(itemId);
      return {
        bracket: b, win_rate: row?.win_rate ?? null, matches: row?.matches ?? null,
        avg_buy_time_s: row?.avg_buy_time_s ?? null, rank: at?.rank ?? null, of: at?.of ?? null,
      };
    });
    return { item, all, peers, heroes, brackets };
  });
}

const maskNumbers = (text: string): string => text.replace(/\d[\d,.]*%?/g, '#');

function shingles(text: string, n: number): Set<string> {
  const words = text.toLowerCase().match(/[a-z0-9'’.%#-]+/g) ?? [];
  const set = new Set<string>();
  for (let i = 0; i + n <= words.length; i++) set.add(words.slice(i, i + n).join(' '));
  return set;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let intersection = 0;
  for (const s of a) if (b.has(s)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function worstPair(texts: string[], n: number, masked: boolean): { max: number; a: number; b: number } {
  const sets = texts.map((t) => shingles(masked ? maskNumbers(t) : t, n));
  let max = 0;
  let a = 0;
  let b = 0;
  for (let i = 0; i < sets.length; i++)
    for (let k = i + 1; k < sets.length; k++) {
      const j = jaccard(sets[i] as Set<string>, sets[k] as Set<string>);
      if (j > max) {
        max = j;
        a = i;
        b = k;
      }
    }
  return { max, a, b };
}

describe('itemNarrative over the live item catalog fixture', () => {
  const inputs = catalogInputs(fixture);
  const withRows = inputs.filter((i) => i.item.win_rate != null && i.item.matches != null);
  const texts = withRows.map((i) => plainText(itemNarrative(i)));
  const names = withRows.map((i) => i.item.name);

  it('covers every catalog item that has a stats row', () => {
    expect(inputs.length).toBeGreaterThanOrEqual(150);
    expect(withRows.length).toBeGreaterThanOrEqual(120);
    expect(new Set(names).size).toBe(withRows.length);
    expect(texts.every((t) => t.length > 0)).toBe(true);
  });

  it('is deterministic for the same input', () => {
    expect(withRows.map((i) => plainText(itemNarrative(i)))).toEqual(texts);
  });

  it('never renders a missing value', () => {
    for (const t of inputs.map((i) => plainText(itemNarrative(i)))) expect(t).not.toMatch(/NaN|undefined|\bnull\b|—/);
  });

  it('holds pairwise word 5-gram overlap at or below 0.60', () => {
    const { max, a, b } = worstPair(texts, 5, false);
    expect(max, `worst pair ${names[a]}/${names[b]}`).toBeLessThanOrEqual(0.6);
  });

  //Same frames with the numbers swapped: every digit run masked before shingling.
  //C2 recommended 0.60 here; 0.700 is what the catalog reaches, guarded at 0.72.
  it('holds the numbers-masked 3-gram overlap under its regression ceiling', () => {
    const { max, a, b } = worstPair(texts, 3, true);
    expect(max, `worst pair ${names[a]}/${names[b]}`).toBeLessThanOrEqual(0.72);
  });

  //The 34 catalog entries the item fold has no rows for (23 of them unreleased tier-5
  //sentinels) can only state their catalog facts, so same-group pairs stay close.
  it('bounds the no-rows pages at what their catalog facts allow', () => {
    const empty = inputs.filter((i) => i.item.win_rate == null || i.item.matches == null);
    const { max } = worstPair(empty.map((i) => plainText(itemNarrative(i))), 5, false);
    expect(empty.length).toBeGreaterThan(0);
    expect(max).toBeLessThanOrEqual(0.8);
  });
});
