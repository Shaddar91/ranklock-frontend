//Pure model for the Build Creator: narrows the wire catalog into the shape computeStats eats,
//lays a build out over the 4+4+4+4 item board, and answers which items an imbue can actually
//move (the ability-scoped property set derived from STAT_DEFS). No React, no I/O.
import { STAT_DEFS, type ItemMods, type ModifierRow } from '../../../lib/computeStats';
import type { HeroAbility, ItemModifier } from '../../../types/api';

export type Bucket = 'weapon' | 'vitality' | 'spirit' | 'flex';

export const BUCKETS: Bucket[] = ['weapon', 'vitality', 'spirit', 'flex'];

export const BUCKET_LABEL: Record<Bucket, string> = {
  weapon: 'Weapon',
  vitality: 'Vitality',
  spirit: 'Spirit',
  flex: 'Flex',
};

export const SLOTS_PER_BUCKET = 4;
export const MAX_ITEMS = BUCKETS.length * SLOTS_PER_BUCKET;

export interface CatalogItem extends ItemMods {
  item_id: number;
  icon: string | null;
}

//Mirrors computeStats' slotCategory so the board and the souls spend agree on a category.
export function bucketOf(slot: string | null | undefined): Bucket {
  return slot === 'weapon' || slot === 'vitality' || slot === 'spirit' ? slot : 'flex';
}

function toModifierRow(v: unknown): ModifierRow | null {
  const r = v as Partial<ModifierRow> | null;
  if (!r || typeof r.property_type !== 'string' || typeof r.value !== 'number') return null;
  return {
    property_type: r.property_type,
    value: r.value,
    is_percent: r.is_percent === true,
    label: typeof r.label === 'string' ? r.label : null,
  };
}

/** Wire rows (`modifiers: unknown[]`, nullable id) → the catalog computeStats consumes. */
export function normalizeCatalog(rows: ItemModifier[] | undefined): CatalogItem[] {
  const out: CatalogItem[] = [];
  for (const r of rows ?? []) {
    if (r.item_id == null) continue;
    const modifiers: ModifierRow[] = [];
    for (const raw of r.modifiers ?? []) {
      const row = toModifierRow(raw);
      if (row) modifiers.push(row);
    }
    out.push({
      item_id: r.item_id,
      item_name: r.item_name,
      item_slot_type: r.item_slot_type,
      item_tier: r.item_tier,
      cost: r.cost,
      icon: r.shop_image_webp,
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
  buckets: Record<Bucket, number[]>;
  //ids with no open slot, or absent from this patch's catalog — surfaced, never silently dropped.
  extra: number[];
}

/** Place items in pick order: own category first, a flex slot once that category is full. */
export function layoutBuild(items: number[], byId: Map<number, CatalogItem>): BoardLayout {
  const buckets: Record<Bucket, number[]> = { weapon: [], vitality: [], spirit: [], flex: [] };
  const extra: number[] = [];
  for (const id of items) {
    const item = byId.get(id);
    if (!item) {
      extra.push(id);
      continue;
    }
    const own = bucketOf(item.item_slot_type);
    if (buckets[own].length < SLOTS_PER_BUCKET) buckets[own].push(id);
    else if (buckets.flex.length < SLOTS_PER_BUCKET) buckets.flex.push(id);
    else extra.push(id);
  }
  return { buckets, extra };
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

/** "+8% Weapon Damage" — one modifier row rendered from the values on the wire. */
export function modifierSummary(row: ModifierRow): string {
  const sign = row.value > 0 ? '+' : '';
  const unit = row.is_percent ? '%' : '';
  const value = Number.isInteger(row.value) ? String(row.value) : row.value.toFixed(1);
  return `${sign}${value}${unit} ${row.label ?? ''}`.trim();
}
