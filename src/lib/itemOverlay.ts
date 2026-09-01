//Data mapping for the shared item overlay (Build Lab modifiers table + creator catalog):
//one card model from both row shapes, "upgrades from" lineage (item-upgrades.json), and the
//Street Brawl split. Brawl detection = shop-art path (images/items/brawl/) — the payload has no flag.
import upgrades from '../data/item-upgrades.json';
import { itemMeta } from './itemCatalog';
import type { ModifierRow } from './computeStats';
import type { ItemModifier } from '../types/api';

export interface UpgradeRef {
  id: number;
  name: string;
  icon: string | null;
}

export interface ItemOverlayData {
  id: number | null;
  name: string;
  icon: string | null;
  slot: string | null;
  tier: number | null;
  cost: number | null;
  brawl: boolean;
  modifiers: ModifierRow[];
  upgradesFrom: UpgradeRef[];
}

//Structural twin of buildModel's CatalogItem, so the lib never imports component code.
export interface OverlayCatalogRow {
  item_id: number;
  item_name: string | null;
  item_slot_type: string | null;
  item_tier: number | null;
  cost: number | null;
  icon: string | null;
  modifiers: ModifierRow[];
}

export type UpgradesMap = Record<string, number[]>;

const UPGRADES = upgrades as UpgradesMap;

export function isBrawlAsset(url: string | null | undefined): boolean {
  return typeof url === 'string' && url.includes('/items/brawl/');
}

/** Wire `modifiers: unknown[]` → typed rows; malformed entries are dropped. */
export function toModifierRows(raw: unknown[] | null | undefined): ModifierRow[] {
  const out: ModifierRow[] = [];
  for (const v of raw ?? []) {
    const r = v as Partial<ModifierRow> | null;
    if (!r || typeof r.property_type !== 'string' || typeof r.value !== 'number') continue;
    out.push({
      property_type: r.property_type,
      value: r.value,
      is_percent: r.is_percent === true,
      label: typeof r.label === 'string' ? r.label : null,
    });
  }
  return out;
}

/** "+8% Weapon Damage" — one modifier row rendered from the values on the wire. */
export function formatModifier(row: ModifierRow): string {
  const sign = row.value > 0 ? '+' : '';
  const unit = row.is_percent ? '%' : '';
  const value = Number.isInteger(row.value) ? String(row.value) : row.value.toFixed(1);
  return `${sign}${value}${unit} ${row.label ?? ''}`.trim();
}

/** Lineage refs for an item; names/icons resolve through the bundled catalog. */
export function upgradesFor(id: number | null | undefined, map: UpgradesMap = UPGRADES): UpgradeRef[] {
  if (id == null) return [];
  return (map[String(id)] ?? []).map((cid) => {
    const meta = itemMeta(cid);
    return { id: cid, name: meta?.name ?? `Item ${cid}`, icon: meta?.icon ?? null };
  });
}

export function overlayFromWire(r: ItemModifier, map: UpgradesMap = UPGRADES): ItemOverlayData {
  return {
    id: r.item_id,
    name: r.item_name ?? (r.item_id != null ? `Item ${r.item_id}` : 'Item'),
    icon: r.shop_image_webp,
    slot: r.item_slot_type,
    tier: r.item_tier,
    cost: r.cost,
    brawl: isBrawlAsset(r.shop_image_webp),
    modifiers: toModifierRows(r.modifiers),
    upgradesFrom: upgradesFor(r.item_id, map),
  };
}

export function overlayFromCatalog(it: OverlayCatalogRow, map: UpgradesMap = UPGRADES): ItemOverlayData {
  return {
    id: it.item_id,
    name: it.item_name ?? `Item ${it.item_id}`,
    icon: it.icon,
    slot: it.item_slot_type,
    tier: it.item_tier,
    cost: it.cost,
    brawl: isBrawlAsset(it.icon),
    modifiers: it.modifiers,
    upgradesFrom: upgradesFor(it.item_id, map),
  };
}

/** Order-preserving split of any item list into competitive vs Street Brawl rows. */
export function splitBrawl<T>(rows: T[], iconOf: (row: T) => string | null | undefined): { competitive: T[]; brawl: T[] } {
  const competitive: T[] = [];
  const brawl: T[] = [];
  for (const row of rows) (isBrawlAsset(iconOf(row)) ? brawl : competitive).push(row);
  return { competitive, brawl };
}
