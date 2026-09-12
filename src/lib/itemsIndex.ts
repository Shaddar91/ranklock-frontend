//Items index arithmetic (design 01 Items §1-§4): the slot x tier category selection,
//the four sort presets that drive the table, and the catalog join that gives every
///items/stats row its slot, tier and cost.
import { ITEM_TIERS, itemTierLabel, itemTierNumeral } from './itemTiers';
import type { ItemModifier, ItemStat } from '../types/api';

export interface ItemSlotOption {
  key: string;
  label: string;
  //sets --cat for the swatch and the active ring (components.css .cat-*).
  cls: string;
}

export const ITEM_SLOTS: readonly ItemSlotOption[] = [
  { key: 'weapon', label: 'Weapon', cls: 'cat-weapon' },
  { key: 'vitality', label: 'Vitality', cls: 'cat-vitality' },
  { key: 'spirit', label: 'Spirit', cls: 'cat-spirit' },
];

export const CATEGORY_TIERS: readonly number[] = ITEM_TIERS.map((t) => t.tier);

//A tier is never selected without its slot: picking Weapon III replaces a Weapon-only
//selection rather than stacking on it. Both null = every item.
export interface CategorySelection {
  slot: string | null;
  tier: number | null;
}

export const ALL_CATEGORIES: CategorySelection = { slot: null, tier: null };

export function slotActive(sel: CategorySelection, slot: string): boolean {
  return sel.slot === slot && sel.tier == null;
}

export function tierActive(sel: CategorySelection, slot: string, tier: number): boolean {
  return sel.slot === slot && sel.tier === tier;
}

export function toggleSlot(sel: CategorySelection, slot: string): CategorySelection {
  return slotActive(sel, slot) ? ALL_CATEGORIES : { slot, tier: null };
}

export function toggleTier(sel: CategorySelection, slot: string, tier: number): CategorySelection {
  return tierActive(sel, slot, tier) ? ALL_CATEGORIES : { slot, tier };
}

export function slotLabel(slot: string | null | undefined): string | null {
  return ITEM_SLOTS.find((s) => s.key === slot)?.label ?? null;
}

export function slotClass(slot: string | null | undefined): string {
  return ITEM_SLOTS.find((s) => s.key === slot)?.cls ?? 'cat-flex';
}

export function categoryTitle(sel: CategorySelection): string {
  const slot = slotLabel(sel.slot);
  if (!slot) return 'All items';
  const tier = itemTierLabel(sel.tier);
  return tier ? `${slot} · ${tier}` : slot;
}

export interface SortSpec {
  key: string;
  dir: 1 | -1;
}

export interface SortPreset {
  key: string;
  label: string;
  sort: SortSpec;
}

export const SORT_PRESETS: readonly SortPreset[] = [
  { key: 'top-wr', label: 'Highest WR', sort: { key: 'wr', dir: -1 } },
  { key: 'most-bought', label: 'Most bought', sort: { key: 'matches', dir: -1 } },
  { key: 'earliest', label: 'Earliest', sort: { key: 'buy', dir: 1 } },
  { key: 'late-spikes', label: 'Late spikes', sort: { key: 'buy', dir: -1 } },
];

//A header click can land on a sort no preset spells; then no preset reads as active.
export function activePreset(sort: SortSpec | null | undefined): SortPreset | undefined {
  if (!sort) return undefined;
  return SORT_PRESETS.find((p) => p.sort.key === sort.key && p.sort.dir === sort.dir);
}

export interface ItemIndexRow extends ItemStat {
  slot: string | null;
  tier: number | null;
  cost: number | null;
  //"Weapon · III", or just the half the catalog knows; empty when it knows neither.
  slotTier: string;
}

export function itemIndexRows(
  stats: readonly ItemStat[],
  catalog: readonly ItemModifier[],
): ItemIndexRow[] {
  const meta = new Map(catalog.filter((r) => r.item_id != null).map((r) => [r.item_id as number, r]));
  return stats.map((it) => {
    const m = meta.get(it.item_id);
    const slot = m?.item_slot_type ?? null;
    const tier = m?.item_tier ?? null;
    return {
      ...it,
      slot,
      tier,
      cost: m?.cost ?? null,
      slotTier: [slotLabel(slot), itemTierNumeral(tier)].filter(Boolean).join(' · '),
    };
  });
}

export function filterByCategory(
  rows: readonly ItemIndexRow[],
  sel: CategorySelection,
): ItemIndexRow[] {
  if (sel.slot == null) return [...rows];
  return rows.filter((r) => r.slot === sel.slot && (sel.tier == null || r.tier === sel.tier));
}

//The "Most bought on" column is additive: it renders only once the item_hero_stats
//fold has served at least one row, never as a column of dashes promising a number.
export function hasTopHero(rows: readonly ItemStat[]): boolean {
  return rows.some((r) => r.top_hero?.hero_id != null);
}
