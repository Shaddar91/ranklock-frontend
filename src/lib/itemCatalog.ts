//Item metadata fallback: fills item_name/icon_url where the API leaves them null, from the
//generated catalog (scripts/gen-item-catalog.mjs); the live API value always wins.
import catalog from '../data/items-catalog.json';
import glyphs from '../data/items-glyphs.json';
import { resolveAsset } from './assets';

//upgrade_clip_size_2 / _3 / _fixed_t3: internal tuning entries Valve never ships in the shop.
export const INTERNAL_ITEM_IDS = new Set<number>([4284855775, 3449296332, 2861048274]);
export function isPublicItem(id: number | null | undefined): boolean {
  return id == null || !INTERNAL_ITEM_IDS.has(id);
}

export interface ItemMeta {
  name: string;
  icon: string | null;
}

const CATALOG = catalog as Record<string, ItemMeta>;
const GLYPHS = glyphs as Record<string, ItemMeta>;

export function itemMeta(id: number | null | undefined): ItemMeta | undefined {
  return id == null ? undefined : CATALOG[String(id)];
}

type ItemMetaRow = { item_id: number | null; item_name?: string | null; icon_url?: string | null };

//The upstream feed emits `.../images/panorama:""` for a few stubs; a non-image URL counts as missing.
export function isImageUrl(url: string | null | undefined): url is string {
  return typeof url === 'string' && /\.(webp|png|jpg)$/i.test(url);
}

export function enrichItemMeta<T extends ItemMetaRow>(row: T): T {
  const meta = itemMeta(row.item_id);
  const wire = isImageUrl(row.icon_url) ? row.icon_url : null;
  if (!meta) return row.icon_url == null || wire ? row : { ...row, icon_url: null };
  return {
    ...row,
    item_name: row.item_name ?? meta.name,
    icon_url: resolveAsset(wire ?? meta.icon),
  };
}

export function enrichItems<T extends ItemMetaRow>(rows: T[]): T[] {
  return rows.map(enrichItemMeta);
}

//Creator rows: wire icon wins, then catalog, then the glyph map (items with no shop tile).
export function itemIcon(id: number | null | undefined, wireIcon: string | null | undefined): string | null {
  const wire = isImageUrl(wireIcon) ? wireIcon : null;
  const glyph = id == null ? null : GLYPHS[String(id)]?.icon;
  return resolveAsset(wire ?? itemMeta(id)?.icon ?? glyph ?? null);
}
