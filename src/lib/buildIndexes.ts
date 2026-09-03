//Build-time caches shared by the prerendered hero and item pages: one fetch per
//build for the per-bracket rosters and the hero -> item win-rate index.
import { api } from './apiClient';
import { buildFetch } from './buildData';
import { rankDesc, toPct } from './narrative';
import type { ItemBracketRow } from './itemNarrative';
import type { DataHorizonResponse, HeroBracket, HeroItemWinRate, HeroSummary, ItemStat } from '../types/api';

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

/** One /meta/data-horizon fetch per build, shared by every page that prints a fold window. */
export function dataHorizon(): Promise<DataHorizonResponse | null> {
  return once('dataHorizon', () => buildFetch(api.getDataHorizon(), null as DataHorizonResponse | null));
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

//Items use the integer badge buckets 1-5 (lib/brackets.ts bracket_badge_range); 0 is the
//all-ranks row the item pages already fetch.
const ITEM_BADGE_BRACKETS = [1, 2, 3, 4, 5] as const;

/** item_id -> one row per badge tier, with the win-rate rank measured inside that tier. */
export function itemBracketIndex(): Promise<Map<number, ItemBracketRow[]>> {
  return once('itemBracketIndex', async () => {
    const perBracket = await Promise.all(
      ITEM_BADGE_BRACKETS.map(async (b) => [b, await buildFetch(api.getItems(b), [] as ItemStat[])] as const),
    );
    const index = new Map<number, ItemBracketRow[]>();
    for (const [bracket, rows] of perBracket) {
      const rated = rows.filter((r) => r.win_rate != null && (r.matches ?? r.picks ?? 0) > 0);
      const wrs = rated.map((r) => toPct(r.win_rate as number));
      for (const r of rows) {
        const matches = r.matches ?? r.picks ?? null;
        const ranked = r.win_rate != null && (matches ?? 0) > 0;
        const list = index.get(r.item_id) ?? [];
        list.push({
          bracket,
          win_rate: r.win_rate ?? null,
          matches,
          avg_buy_time_s: r.avg_buy_time_s ?? null,
          rank: ranked ? rankDesc(wrs, toPct(r.win_rate as number)) : null,
          of: ranked ? rated.length : null,
        });
        index.set(r.item_id, list);
      }
    }
    console.log(`[itemBracketIndex] ${index.size} items across ${ITEM_BADGE_BRACKETS.length} badge tiers`);
    return index;
  });
}
