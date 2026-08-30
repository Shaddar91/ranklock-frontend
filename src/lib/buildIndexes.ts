//Build-time caches shared by the prerendered hero and item pages: one fetch per
//build for the per-bracket rosters and the hero -> item win-rate index.
import { api } from './apiClient';
import { buildFetch } from './buildData';
import type { HeroBracket, HeroItemWinRate, HeroSummary } from '../types/api';

export interface BracketDef {
  key: HeroBracket;
  label: string;
}

//Backend hero_bracket_mv (migration 003): badge < 80 low, < 100 mid, < 116 high, else top.
export const HERO_BRACKETS: readonly BracketDef[] = [
  { key: 'low', label: 'Obscurus to Archon' },
  { key: 'mid', label: 'Oracle and Phantom' },
  { key: 'high', label: 'Ascendant and Eternus 1 to 5' },
  { key: 'top', label: 'Eternus 6' },
];

const memo = new Map<string, Promise<unknown>>();
function once<T>(key: string, make: () => Promise<T>): Promise<T> {
  let p = memo.get(key) as Promise<T> | undefined;
  if (!p) {
    p = make();
    memo.set(key, p);
  }
  return p;
}

export function rosterByBracket(): Promise<Map<HeroBracket, HeroSummary[]>> {
  return once('rosterByBracket', async () => {
    const entries = await Promise.all(
      HERO_BRACKETS.map(
        async (b) => [b.key, await buildFetch(api.getHeroes({ bracket: b.key }), [] as HeroSummary[])] as const,
      ),
    );
    return new Map<HeroBracket, HeroSummary[]>(entries);
  });
}

export interface HeroItemRow extends HeroItemWinRate {
  hero_id: number;
}

/** item_id -> per-hero win-rate rows, from one /heroes/:id/item-win-rates call per hero. */
export function heroItemIndex(roster: HeroSummary[]): Promise<Map<number, HeroItemRow[]>> {
  return once('heroItemIndex', async () => {
    const perHero = await Promise.all(
      roster.map(async (h) =>
        (await buildFetch(api.getHeroItemWinRates(h.hero_id), [] as HeroItemWinRate[])).map((r) => ({
          ...r,
          hero_id: h.hero_id,
        })),
      ),
    );
    const index = new Map<number, HeroItemRow[]>();
    for (const rows of perHero) {
      for (const r of rows) {
        const list = index.get(r.item_id) ?? [];
        list.push(r);
        index.set(r.item_id, list);
      }
    }
    const covered = perHero.filter((rows) => rows.length > 0).length;
    console.log(`[heroItemIndex] ${covered}/${roster.length} heroes indexed, ${index.size} items`);
    return index;
  });
}
