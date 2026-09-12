//Hero Build arithmetic: the phase split and its core/situational rule, the buy-order track
//with cumulative cost and the minute a median-farming lobby affords it, the four modifier
//families behind the situational picks, and the folded purchase sets.
import { PHASE_BANDS } from './heroOverview';
import { getRank } from './ranks';
import { SOULS_AT_ZERO } from './laneCurve';
import { toModifierRows, formatModifier } from './itemOverlay';
import { itemTierNumeral } from './itemTiers';
import type {
  BuildStatsItemSet,
  HeroItemWinRate,
  ItemModifier,
  ItemStat,
  LaneCurvePoint,
  RankedBracketKey,
} from '../types/api';

export interface RankedBracketOption {
  key: RankedBracketKey;
  tiers: readonly [number, number];
}

//The four brackets the ranked route serves; the badge bounds stay server-side, so a bracket
//is named here only by the pinned ladder tiers its key spells out.
export const RANKED_BRACKETS: readonly RankedBracketOption[] = [
  { key: 'initiate-sentinel', tiers: [1, 4] },
  { key: 'mystic-emissary', tiers: [5, 7] },
  { key: 'oracle-phantom', tiers: [8, 9] },
  { key: 'ascendant-eternus', tiers: [10, 11] },
];

export function rankedBracketLabel(option: RankedBracketOption): string {
  return `${getRank(option.tiers[0]).name} – ${getRank(option.tiers[1]).name}`;
}

export interface CatalogEntry {
  itemId: number;
  name: string;
  icon: string | null;
  slot: string | null;
  tier: number | null;
  cost: number | null;
  slotTier: string;
}

export function slotTierLabel(slot: string | null, tier: number | null): string {
  const s = slot ? slot[0]!.toUpperCase() + slot.slice(1) : '';
  return [s, itemTierNumeral(tier)].filter(Boolean).join(' · ');
}

export function catalogIndex(rows: readonly ItemModifier[]): Map<number, CatalogEntry> {
  const out = new Map<number, CatalogEntry>();
  for (const r of rows) {
    if (r.item_id == null) continue;
    out.set(r.item_id, {
      itemId: r.item_id,
      name: r.item_name ?? `Item ${r.item_id}`,
      icon: r.shop_image_webp,
      slot: r.item_slot_type,
      tier: r.item_tier,
      cost: r.cost,
      slotTier: slotTierLabel(r.item_slot_type, r.item_tier),
    });
  }
  return out;
}

//A purchase counted in at least this share of the hero's most-bought item's games reads as
//Core. RankLock editorial, stated as such wherever the pill renders.
export const CORE_SHARE = 0.6;

export interface BuildPhaseItem {
  itemId: number;
  name: string;
  iconUrl: string | null;
  slotTier: string;
  minute: number;
  winRate: number;
  games: number;
  cost: number | null;
  core: boolean;
}

export interface BuildPhaseCard {
  name: string;
  range: string;
  souls: number | null;
  items: BuildPhaseItem[];
}

/** The hero's most-bought items per editorial band, banded on the same average buy minute
 *  the row renders, with the core/situational pill measured against the most-bought item. */
export function buildByPhase(
  rows: readonly ItemStat[],
  catalog: ReadonlyMap<number, CatalogEntry>,
  perPhase = 6,
): BuildPhaseCard[] {
  const peak = rows.reduce((max, r) => Math.max(max, r.matches ?? 0), 0);
  return PHASE_BANDS.map((band) => {
    const items = rows
      .flatMap((r) => {
        const minute = (r.avg_buy_time_s ?? 0) / 60;
        return r.avg_buy_time_s != null && minute >= band.from && minute < band.to ? [{ r, minute }] : [];
      })
      .sort((a, b) => (b.r.matches ?? 0) - (a.r.matches ?? 0))
      .slice(0, perPhase)
      .map(({ r, minute }) => {
        const meta = catalog.get(r.item_id);
        return {
          itemId: r.item_id,
          name: r.item_name ?? meta?.name ?? `Item ${r.item_id}`,
          iconUrl: r.icon_url ?? meta?.icon ?? null,
          slotTier: meta?.slotTier ?? '',
          minute,
          winRate: r.win_rate ?? 0,
          games: r.matches ?? 0,
          cost: meta?.cost ?? null,
          core: peak > 0 && (r.matches ?? 0) >= CORE_SHARE * peak,
        };
      });
    const costed = items.filter((i) => i.cost != null);
    return {
      name: band.name,
      range: band.range,
      souls: costed.length === 0 ? null : costed.reduce((sum, i) => sum + (i.cost as number), 0),
      items,
    };
  });
}

export interface BuyOrderSlot {
  pos: number;
  itemId: number;
  name: string;
  iconUrl: string | null;
  minute: number;
  cost: number;
  cumulative: number;
  affordMinute: number | null;
  winRate: number;
}

/** The board in the order players fill it: the most-bought costed items, sorted by their
 *  average buy minute, each carrying the running board cost. */
export function buyOrderTrack(
  rows: readonly ItemStat[],
  catalog: ReadonlyMap<number, CatalogEntry>,
  curve: readonly LaneCurvePoint[],
  slots = 12,
): BuyOrderSlot[] {
  const costed = rows.flatMap((r) => {
    const meta = catalog.get(r.item_id);
    return meta?.cost != null && r.avg_buy_time_s != null
      ? [{ r, meta, minute: r.avg_buy_time_s / 60, cost: meta.cost }]
      : [];
  });
  let cumulative = 0;
  return costed
    .sort((a, b) => (b.r.matches ?? 0) - (a.r.matches ?? 0))
    .slice(0, slots)
    .sort((a, b) => a.minute - b.minute)
    .map(({ r, meta, minute, cost }, i) => {
      cumulative += cost;
      return {
        pos: i + 1,
        itemId: r.item_id,
        name: r.item_name ?? meta.name,
        iconUrl: r.icon_url ?? meta.icon,
        minute,
        cost,
        cumulative,
        affordMinute: affordableAtMinute(curve, cumulative),
        winRate: r.win_rate ?? 0,
      };
    });
}

/** The game minute a curve of cumulative souls first reaches `souls`, interpolated between
 *  grid points; null when the curve never gets there. Curve values are thousands of souls. */
export function affordableAtMinute(curve: readonly LaneCurvePoint[], souls: number): number | null {
  const pts = [...curve]
    .filter((p) => p.p50 != null)
    .sort((a, b) => a.t_seconds - b.t_seconds)
    .map((p) => ({ minute: p.t_seconds / 60, souls: (p.p50 as number) * 1000 }));
  if (pts.length === 0) return null;
  let prev = { minute: 0, souls: SOULS_AT_ZERO };
  for (const p of pts) {
    if (p.souls >= souls) {
      const span = p.souls - prev.souls;
      const frac = span > 0 ? (souls - prev.souls) / span : 0;
      return prev.minute + (p.minute - prev.minute) * Math.max(0, Math.min(1, frac));
    }
    prev = p;
  }
  return null;
}

export interface ModifierFamily {
  key: string;
  label: string;
  effect: string;
  propertyType: string;
  negative: boolean;
  //The catalog labels a slow "Move Speed", which reads as a buff on a chip; a family may
  //rename its own modifier so the number says what the item does to the enemy.
  chipLabel?: string;
}

//The design's four swap-in groups, each pinned to the catalog property that defines it.
export const MODIFIER_FAMILIES: readonly ModifierFamily[] = [
  {
    key: 'healing',
    label: 'Against healing',
    effect: 'Cuts the healing an enemy receives',
    propertyType: 'MODIFIER_VALUE_HEAL_AMP_RECEIVE_PERCENT',
    negative: true,
  },
  {
    key: 'guns',
    label: 'Against gun burst',
    effect: 'Bullet resist',
    propertyType: 'MODIFIER_VALUE_BULLET_ARMOR_DAMAGE_RESIST',
    negative: false,
  },
  {
    key: 'cc',
    label: 'Against crowd control',
    effect: 'Debuff resist',
    propertyType: 'MODIFIER_VALUE_STATUS_RESISTANCE',
    negative: false,
  },
  {
    key: 'escapes',
    label: 'Against escapes',
    effect: 'Applies a move-speed slow',
    propertyType: 'MODIFIER_VALUE_MOVEMENT_SPEED_SLOW_PERCENT',
    negative: false,
    chipLabel: 'move-speed slow',
  },
];

export interface SituationalPick {
  itemId: number;
  name: string;
  iconUrl: string | null;
  slotTier: string;
  modifier: string;
  winRate: number;
  games: number;
}

export interface SituationalGroup {
  key: string;
  label: string;
  effect: string;
  picks: SituationalPick[];
}

/** Per family, the catalog items carrying that property ranked by their Wilson lower bound
 *  ON THIS HERO. An item the hero fold has no row for is dropped, never shown rateless. */
export function situationalGroups(
  catalog: readonly ItemModifier[],
  heroWinRates: readonly HeroItemWinRate[],
  perGroup = 2,
): SituationalGroup[] {
  const byId = new Map(heroWinRates.filter((r) => (r.games ?? 0) > 0).map((r) => [r.item_id, r]));
  return MODIFIER_FAMILIES.flatMap((family) => {
    const picks = catalog
      .flatMap((row) => {
        if (row.item_id == null) return [];
        const stat = byId.get(row.item_id);
        if (!stat) return [];
        const mod = toModifierRows(row.modifiers).find(
          (m) => m.property_type === family.propertyType && (family.negative ? m.value < 0 : m.value > 0),
        );
        return mod
          ? [
              {
                itemId: row.item_id,
                name: row.item_name ?? `Item ${row.item_id}`,
                iconUrl: row.shop_image_webp,
                slotTier: slotTierLabel(row.item_slot_type, row.item_tier),
                modifier: formatModifier(family.chipLabel ? { ...mod, label: family.chipLabel } : mod),
                winRate: (stat.win_rate ?? 0) * 100,
                games: stat.games ?? 0,
                wilson: stat.wilson_lower ?? 0,
              },
            ]
          : [];
      })
      .sort((a, b) => b.wilson - a.wilson)
      .slice(0, perGroup)
      .map(({ wilson: _wilson, ...pick }) => pick);
    return picks.length === 0 ? [] : [{ key: family.key, label: family.label, effect: family.effect, picks }];
  });
}

export interface SetEntry {
  itemId: number;
  name: string;
  iconUrl: string | null;
  shopItem: boolean;
  count: number;
}

export interface SetRow {
  entries: SetEntry[];
  games: number;
  winRate: number;
  wilson: number;
}

/** The folded sets in Wilson order. An entry is flagged `shopItem: false` when it is an
 *  ability upgrade — the fold counts both, and the block says so rather than filtering. */
export function winningSets(
  sets: readonly BuildStatsItemSet[],
  catalog: ReadonlyMap<number, CatalogEntry>,
  limit = 5,
): SetRow[] {
  return [...sets]
    .filter((s) => s.games > 0)
    .sort((a, b) => b.wilson_lower - a.wilson_lower)
    .slice(0, limit)
    .map((s) => {
      const entries: SetEntry[] = [];
      for (const item of s.items) {
        const seen = entries.find((e) => e.itemId === item.item_id);
        if (seen) {
          seen.count += 1;
          continue;
        }
        entries.push({
          itemId: item.item_id,
          name: item.item_name ?? `Item ${item.item_id}`,
          iconUrl: item.icon_url ?? null,
          shopItem: catalog.has(item.item_id),
          count: 1,
        });
      }
      return { entries, games: s.games, winRate: s.win_rate * 100, wilson: s.wilson_lower * 100 };
    });
}
