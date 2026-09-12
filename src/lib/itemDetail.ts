//Item detail (design 01 §Item) pure logic: purchase-minute folding, catalog-derived
//tags, the assumed upgrade discount, peer ranking and the patch-note name match.
import { MODIFIER_FAMILIES } from './heroBuild';
import { toModifierRows, type ItemOverlayData, type UpgradeRef } from './itemOverlay';
import { itemTierNumeral } from './itemTiers';
import type { ItemDetailResponse, ItemEdge, ItemTimingBucket, Patch } from '../types/api';

//Mirrors scripts/gen-item-catalog.mjs plainText: Valve's item text carries light HTML
//(<span class="highlight">, <br>, entities), flattened for an injection-safe page.
export function plainItemText(html: string | null | undefined): string | null {
  if (typeof html !== 'string' || !html) return null;
  const text = html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text || null;
}

/** "vitality" -> "Vitality"; null for an item the catalog gives no slot. */
export function slotName(slot: string | null | undefined): string | null {
  return slot ? slot.charAt(0).toUpperCase() + slot.slice(1) : null;
}

/** "Vitality · III" — the design's sub-line under every item tile. */
export function slotTierLabel(slot: string | null | undefined, tier: number | null | undefined): string {
  return [slotName(slot), itemTierNumeral(tier)].filter(Boolean).join(' · ');
}

export interface TimingBand {
  label: string;
  from: number;
  to: number;
}

//`from` inclusive, `to` exclusive, over the buy minute the timing route buckets by.
export const BUY_HISTOGRAM: readonly TimingBand[] = [
  { label: '<12', from: 0, to: 12 },
  { label: '12', from: 12, to: 14 },
  { label: '14', from: 14, to: 16 },
  { label: '16', from: 16, to: 18 },
  { label: '18', from: 18, to: 20 },
  { label: '20', from: 20, to: 22 },
  { label: '22', from: 22, to: 24 },
  { label: '24', from: 24, to: 26 },
  { label: '26', from: 26, to: 28 },
  { label: '28', from: 28, to: 30 },
  { label: '30+', from: 30, to: Infinity },
];

export const BUY_WR_BANDS: readonly TimingBand[] = [
  { label: 'Before 12', from: 0, to: 12 },
  { label: '12 to 15', from: 12, to: 16 },
  { label: '16 to 19', from: 16, to: 20 },
  { label: '20 to 23', from: 20, to: 24 },
  { label: '24 to 29', from: 24, to: 30 },
  { label: '30 and later', from: 30, to: Infinity },
];

export interface TimingWindow {
  label: string;
  matches: number;
  wins: number;
  //Percent of the folded purchases, 0-100.
  share: number;
  //Percent, 0-100; null when the window recorded no purchase.
  winRate: number | null;
}

export function foldTiming(
  buckets: readonly ItemTimingBucket[],
  bands: readonly TimingBand[] = BUY_HISTOGRAM,
): TimingWindow[] {
  const total = buckets.reduce((n, b) => n + b.matches, 0);
  return bands.map((band) => {
    let matches = 0;
    let wins = 0;
    for (const b of buckets) {
      if (b.bucket >= band.from && b.bucket < band.to) {
        matches += b.matches;
        wins += b.wins;
      }
    }
    return {
      label: band.label,
      matches,
      wins,
      share: total > 0 ? (matches / total) * 100 : 0,
      winRate: matches > 0 ? (wins / matches) * 100 : null,
    };
  });
}

/** The catalog families this item's modifiers put it in — the only tag source the feed carries. */
export function itemTags(modifiers: readonly unknown[] | null | undefined): string[] {
  const rows = toModifierRows(modifiers as unknown[] | null | undefined);
  return MODIFIER_FAMILIES.filter((f) =>
    rows.some((m) => m.property_type === f.propertyType && (f.negative ? m.value < 0 : m.value > 0)),
  ).map((f) => f.label);
}

/** Shop price minus the components already owned. Null when no component carries a price. */
export function upgradeDiscount(
  cost: number | null | undefined,
  componentCosts: readonly (number | null | undefined)[],
): number | null {
  if (cost == null) return null;
  const owned = componentCosts.reduce<number>((n, c) => n + (c ?? 0), 0);
  return owned > 0 ? cost - owned : null;
}

export interface PeerRow {
  itemId: number;
  name: string;
  icon: string | null;
  winRate: number | null;
  matches: number | null;
}

/** Same slot + tier, best measured win rate first; rateless peers keep their place at the end. */
export function rankPeers(peers: readonly PeerRow[], selfId: number, limit = 7): PeerRow[] {
  return peers
    .filter((p) => p.itemId !== selfId)
    .sort((a, b) => {
      if (a.winRate == null && b.winRate == null) return a.name.localeCompare(b.name);
      if (a.winRate == null) return 1;
      if (b.winRate == null) return -1;
      return b.winRate - a.winRate;
    })
    .slice(0, limit);
}

/** Patches whose served summary text names the item. Empty when no summary mentions it. */
export function patchesNamingItem(patches: readonly Patch[], itemName: string | null | undefined): Patch[] {
  const needle = (itemName ?? '').trim().toLowerCase();
  if (needle.length === 0) return [];
  return patches.filter((p) => (p.notes_summary ?? '').toLowerCase().includes(needle));
}

function edgeRefs(edges: readonly ItemEdge[] | undefined): UpgradeRef[] {
  return (edges ?? []).map((e) => ({ id: e.item_id, name: e.item_name, icon: e.icon_url }));
}

/**
 * Fold GET /items/:id/detail over the bundled card model: live component-tree edges,
 * cooldown and Valve's split text win; bundled values stay wherever the route is silent.
 */
export function mergeItemDetail(base: ItemOverlayData, detail: ItemDetailResponse | undefined): ItemOverlayData {
  if (!detail) return base;
  const active = plainItemText(detail.text.active);
  const passive = plainItemText(detail.text.passive);
  const desc = plainItemText(detail.text.desc);
  const from = edgeRefs(detail.components);
  const into = edgeRefs(detail.builds_into);
  return {
    ...base,
    name: detail.item_name || base.name,
    icon: base.icon ?? detail.shop_image_webp,
    slot: base.slot ?? detail.item_slot_type,
    tier: base.tier ?? detail.item_tier,
    cost: base.cost ?? detail.cost,
    modifiers: base.modifiers.length > 0 ? base.modifiers : toModifierRows(detail.modifiers),
    upgradesFrom: from.length > 0 ? from : base.upgradesFrom,
    upgradesInto: into,
    cooldown: detail.cooldown ?? null,
    ability: {
      active: detail.is_active_item,
      imbue: base.ability?.imbue ?? false,
      desc: active ?? desc ?? base.ability?.desc ?? null,
      passive: passive ?? (active != null ? desc : null) ?? base.ability?.passive ?? null,
    },
  };
}
