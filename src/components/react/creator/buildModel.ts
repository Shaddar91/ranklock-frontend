//Pure model for the Build Creator: narrows the wire catalog into the shape computeStats eats,
//lays a build out over the 9 inventory + 3 flex slots, and answers which items an imbue can
//actually move (the ability-scoped property set derived from STAT_DEFS). No React, no I/O.
import { STAT_DEFS, type ItemMods, type ModifierRow } from '../../../lib/computeStats';
import { itemIcon } from '../../../lib/itemCatalog';
import { toModifierRows } from '../../../lib/itemOverlay';
import type { HeroAbility, ItemModifier } from '../../../types/api';

//Flex is a SLOT, never a shop category — an uncategorised item still takes an ordinary slot.
export type Category = 'weapon' | 'vitality' | 'spirit';

export const CATEGORIES: readonly Category[] = ['weapon', 'vitality', 'spirit'];

export const CATEGORY_LABEL: Record<Category, string> = {
  weapon: 'Weapon',
  vitality: 'Vitality',
  spirit: 'Spirit',
};

//The board since the 2025-11-21 client: 9 universal slots plus one flex slot per enemy Walker.
export const INVENTORY_SLOTS = 9;
export const FLEX_SLOTS = 3;
export const TOTAL_SLOTS = INVENTORY_SLOTS + FLEX_SLOTS;

export interface CatalogItem extends ItemMods {
  item_id: number;
  icon: string | null;
}

export function categoryOf(slot: string | null | undefined): Category | null {
  return slot === 'weapon' || slot === 'vitality' || slot === 'spirit' ? slot : null;
}

/** Wire rows (`modifiers: unknown[]`, nullable id) → the catalog computeStats consumes. */
export function normalizeCatalog(rows: ItemModifier[] | undefined): CatalogItem[] {
  const out: CatalogItem[] = [];
  for (const r of rows ?? []) {
    if (r.item_id == null) continue;
    const modifiers: ModifierRow[] = toModifierRows(r.modifiers);
    out.push({
      item_id: r.item_id,
      item_name: r.item_name,
      item_slot_type: r.item_slot_type,
      item_tier: r.item_tier,
      cost: r.cost,
      //the modifiers payload ships no icon for some shop items — join the bundled catalog
      icon: itemIcon(r.item_id, r.shop_image_webp),
      modifiers,
    });
  }
  return out;
}

export function indexCatalog(items: CatalogItem[]): Map<number, CatalogItem> {
  return new Map(items.map((it) => [it.item_id, it]));
}

export function itemLabel(itemId: number, item: CatalogItem | undefined): string {
  return item?.item_name ?? `Item ${itemId}`;
}

export interface BoardLayout {
  inventory: number[];
  flex: number[];
  //ids with no open slot, or absent from this patch's catalog — surfaced, never silently dropped.
  extra: number[];
}

/** Place items in pick order: the 9 inventory slots first, then the 3 flex slots. */
export function layoutBuild(items: number[], byId: Map<number, CatalogItem>): BoardLayout {
  const inventory: number[] = [];
  const flex: number[] = [];
  const extra: number[] = [];
  for (const id of items) {
    if (!byId.has(id)) {
      extra.push(id);
      continue;
    }
    if (inventory.length < INVENTORY_SLOTS) inventory.push(id);
    else if (flex.length < FLEX_SLOTS) flex.push(id);
    else extra.push(id);
  }
  return { inventory, flex, extra };
}

/** The four purchasable abilities; innate rows are not imbue targets. */
export function imbueAbilities(abilities: HeroAbility[] | undefined): HeroAbility[] {
  const rows = [...(abilities ?? [])].sort((a, b) => a.order - b.order);
  const signature = rows.filter((a) => a.slot?.startsWith('signature'));
  return signature.length > 0 ? signature : rows.filter((a) => a.ability_type !== 'innate');
}

export function indexAbilities(abilities: HeroAbility[]): Map<number, HeroAbility> {
  return new Map(abilities.map((a) => [a.ability_id, a]));
}

const ABILITY_SCOPED_PROPS = new Set(
  STAT_DEFS.filter((d) => d.scope === 'ability').flatMap((d) => [
    ...(d.addProps ?? []),
    ...(d.pctProps ?? []),
    ...(d.bonusProps ?? []),
  ]),
);

/** True when imbuing this item actually routes something onto an ability line. */
export function hasAbilityScopedMods(item: CatalogItem | undefined): boolean {
  return item != null && item.modifiers.some((m) => ABILITY_SCOPED_PROPS.has(m.property_type));
}
