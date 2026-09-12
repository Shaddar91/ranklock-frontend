//Analyze-tab model: the import-reference parser, the purchase order with its upgrade-difference
//arithmetic, the phase split, the ability-point progression, the served-order lookup and the
//per-tier ability baselines. Pure — no React, no I/O; renderers add no arithmetic of their own.
import { decodeBuild } from '../../../lib/buildShare';
import { affordableAtMinute, slotTierLabel } from '../../../lib/heroBuild';
import { PHASE_BANDS } from '../../../lib/heroOverview';
import { statLabel } from '../../../lib/statLabel';
import { upgradesFor } from '../../../lib/itemOverlay';
import { spiritScaleOf, type AbilityBaseline, type BuildModifiers } from '../../../lib/labCalc';
import { INVENTORY_SLOTS, TOTAL_SLOTS, type CatalogItem } from '../creator/buildModel';
import type { BuildInput, ComputedStats, InvestmentRow } from '../../../lib/computeStats';
import type {
  AbilityOrder,
  HeroAbilityNumerics,
  HeroAbilityProperty,
  LaneCurvePoint,
  TrimmedBuild,
} from '../../../types/api';

//---- §3 import reference ------------------------------------------------------

export type ImportRef =
  | { kind: 'id'; buildId: number }
  | { kind: 'board'; build: BuildInput }
  | { kind: 'error'; message: string };

export const IMPORT_PLACEHOLDER = 'Paste a build id or a RankLock share link';

//02 could not verify the in-game Build Browser code format and the repo carries no decoder,
//so the field says what it cannot read rather than failing silently on a pasted code.
export const IMPORT_CODE_NOTE =
  'In-game Build Browser codes cannot be read here — their format is undocumented. Paste the build id (the number in the build’s link) or a RankLock share link.';

const SHARE_MARK = 'b1:';
const ID_PATTERNS = [/\/builds?\/(\d+)/i, /[?&]build(?:_id)?=(\d+)/i];

export function parseImport(raw: string): ImportRef {
  const input = raw.trim();
  if (!input) return { kind: 'error', message: 'Paste a build id or a RankLock share link.' };

  const share = input.indexOf(SHARE_MARK);
  if (share >= 0) {
    const build = decodeBuild(input.slice(share));
    return build
      ? { kind: 'board', build }
      : { kind: 'error', message: 'That RankLock link is malformed — copy it again from the Share button.' };
  }
  if (/^\d+$/.test(input)) return { kind: 'id', buildId: Number(input) };
  for (const re of ID_PATTERNS) {
    const m = re.exec(input);
    if (m) return { kind: 'id', buildId: Number(m[1]) };
  }
  const trailing = /(\d{3,})\D*$/.exec(input);
  if (trailing) return { kind: 'id', buildId: Number(trailing[1]) };
  return { kind: 'error', message: IMPORT_CODE_NOTE };
}

//---- build contents -----------------------------------------------------------

export interface BuildEntry {
  itemId: number;
  category: string;
  //the author's own per-item note, when the build carries one.
  annotation?: string;
}

export interface BuildContents {
  entries: BuildEntry[];
  categories: number;
  items: number;
  points: number;
}

/** Items in category order, first occurrence wins — the board cannot hold the same item twice. */
export function buildContents(build: Pick<TrimmedBuild, 'categories' | 'ability_order'>): BuildContents {
  const entries: BuildEntry[] = [];
  const seen = new Set<number>();
  let categories = 0;
  for (const cat of build.categories ?? []) {
    let counted = false;
    for (const item of cat.items ?? []) {
      if (item.item_id == null || seen.has(item.item_id)) continue;
      seen.add(item.item_id);
      entries.push({
        itemId: item.item_id,
        category: cat.name?.trim() || 'Uncategorised',
        annotation: item.annotation?.trim() || undefined,
      });
      counted = true;
    }
    if (counted) categories += 1;
  }
  return { entries, categories, items: entries.length, points: abilitySteps(build.ability_order).length };
}

/** The first 12 entries the 9+3 board can actually hold — what the stat panels are read over. */
export function boardItems(entries: readonly BuildEntry[], byId: ReadonlyMap<number, CatalogItem>): number[] {
  return entries.filter((e) => byId.has(e.itemId)).slice(0, TOTAL_SLOTS).map((e) => e.itemId);
}

//---- §4 purchase order --------------------------------------------------------

export interface PurchaseRow {
  pos: number;
  itemId: number;
  name: string;
  item: CatalogItem | undefined;
  slotTier: string;
  category: string;
  annotation: string | undefined;
  cost: number | null;
  //cost minus the owned component's cost on an upgrade row — assumed, the build states no route.
  paid: number | null;
  running: number;
  upgradeFrom: { id: number; name: string; cost: number } | null;
}

export function purchaseRows(
  entries: readonly BuildEntry[],
  byId: ReadonlyMap<number, CatalogItem>,
): PurchaseRow[] {
  const owned = new Set<number>();
  let running = 0;
  return entries.map((entry, i) => {
    const item = byId.get(entry.itemId);
    const cost = item?.cost ?? null;
    const component = upgradesFor(entry.itemId)
      .filter((u) => owned.has(u.id))
      .map((u) => ({ id: u.id, name: u.name, cost: byId.get(u.id)?.cost ?? 0 }))
      .sort((a, b) => b.cost - a.cost)[0];
    const upgradeFrom = component && component.cost > 0 ? component : null;
    const paid = cost == null ? null : Math.max(0, cost - (upgradeFrom?.cost ?? 0));
    running += paid ?? 0;
    owned.add(entry.itemId);
    return {
      pos: i + 1,
      itemId: entry.itemId,
      name: item?.item_name ?? `Item ${entry.itemId}`,
      item,
      slotTier: slotTierLabel(item?.item_slot_type ?? null, item?.item_tier ?? null),
      category: entry.category,
      annotation: entry.annotation,
      cost,
      paid,
      running,
      upgradeFrom,
    };
  });
}

export interface PhaseGroup {
  name: string;
  range: string;
  rows: PurchaseRow[];
  souls: number;
}

/**
 * Phase for a row = the band holding the minute a median-farming lobby affords its running total.
 * The build itself states no timing, so this is a model — its renderer prints that.
 * An empty curve collapses to one unbanded group rather than inventing minutes.
 */
export function phaseGroups(rows: readonly PurchaseRow[], curve: readonly LaneCurvePoint[]): PhaseGroup[] {
  const sumOf = (list: readonly PurchaseRow[]) => list.reduce((t, r) => t + (r.paid ?? 0), 0);
  if (curve.length === 0) {
    return rows.length === 0 ? [] : [{ name: 'Purchase order', range: 'no economy curve', rows: [...rows], souls: sumOf(rows) }];
  }
  const groups = PHASE_BANDS.map((b) => ({ name: b.name, range: b.range, rows: [] as PurchaseRow[], souls: 0 }));
  for (const row of rows) {
    const minute = affordableAtMinute(curve, row.running);
    const idx = minute == null ? groups.length - 1 : PHASE_BANDS.findIndex((b) => minute >= b.from && minute < b.to);
    groups[idx < 0 ? groups.length - 1 : idx]!.rows.push(row);
  }
  for (const g of groups) g.souls = sumOf(g.rows);
  return groups.filter((g) => g.rows.length > 0);
}

export function slotNote(owned: number): string {
  if (owned <= INVENTORY_SLOTS) return 'fits the 9 base slots';
  const flex = owned - INVENTORY_SLOTS;
  if (owned <= TOTAL_SLOTS) {
    return `needs ${flex} flex slot${flex === 1 ? '' : 's'} (${flex} enemy Walker${flex === 1 ? '' : 's'} down)`;
  }
  return `${owned} items — ${owned - TOTAL_SLOTS} past the 12-slot board, a shopping list rather than one loadout`;
}

//---- §5 ability progression ---------------------------------------------------

//Upstream spends one entry per point: currency_type 2 / delta 0 is the unlock, currency_type 1
//is a tier upgrade (probed live 2026-09-12), so a tier is the ordinal of that ability's upgrades.
export interface AbilityStep {
  pos: number;
  abilityId: number;
  tier: number | null;
  points: number;
}

export function abilitySteps(abilityOrder: unknown): AbilityStep[] {
  const changes = (abilityOrder as { currency_changes?: unknown })?.currency_changes;
  if (!Array.isArray(changes)) return [];
  const upgrades = new Map<number, number>();
  const steps: AbilityStep[] = [];
  for (const raw of changes) {
    const c = raw as { ability_id?: unknown; currency_type?: unknown; delta?: unknown };
    if (typeof c?.ability_id !== 'number') continue;
    const unlock = c.currency_type === 2;
    const nth = unlock ? null : (upgrades.get(c.ability_id) ?? 0) + 1;
    if (nth != null) upgrades.set(c.ability_id, nth);
    steps.push({
      pos: steps.length + 1,
      abilityId: c.ability_id,
      tier: nth,
      points: typeof c.delta === 'number' ? Math.abs(c.delta) : 0,
    });
  }
  return steps;
}

export interface AbilitySummary {
  abilityId: number;
  unlockAt: number | null;
  tiers: { tier: number; at: number }[];
}

export function abilitySummaries(steps: readonly AbilityStep[]): AbilitySummary[] {
  const out = new Map<number, AbilitySummary>();
  for (const s of steps) {
    const row = out.get(s.abilityId) ?? { abilityId: s.abilityId, unlockAt: null, tiers: [] };
    if (s.tier == null) row.unlockAt ??= s.pos;
    else row.tiers.push({ tier: s.tier, at: s.pos });
    out.set(s.abilityId, row);
  }
  return [...out.values()];
}

export interface OrderMatch {
  order: AbilityOrder;
  //set when the served order is shorter than the build's and matched on its own length.
  prefix: number | null;
}

/** Exact match first; then a served order that equals the sequence's opening run (served lengths vary 14–16). */
export function matchOrderSequence(
  seq: readonly number[],
  orders: readonly AbilityOrder[] | undefined,
): OrderMatch | null {
  if (seq.length === 0) return null;
  const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((v, i) => v === b[i]);
  const exact = (orders ?? []).find((o) => same(o.abilities, seq));
  if (exact) return { order: exact, prefix: null };
  const partial = (orders ?? []).find(
    (o) => o.abilities.length > 0 && o.abilities.length < seq.length && same(o.abilities, seq.slice(0, o.abilities.length)),
  );
  return partial ? { order: partial, prefix: partial.abilities.length } : null;
}

export function matchServedOrder(
  steps: readonly AbilityStep[],
  orders: readonly AbilityOrder[] | undefined,
): OrderMatch | null {
  return matchOrderSequence(steps.map((s) => s.abilityId), orders);
}

//---- §6 ability baselines at a tier -------------------------------------------

function numeric(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : null;
}

const FIELD_KINDS: Record<'damage' | 'cooldown' | 'duration' | 'range', string[]> = {
  damage: ['tech_damage', 'damage'],
  cooldown: ['cooldown'],
  duration: ['duration'],
  range: ['range'],
};

function pickProp(props: readonly HeroAbilityProperty[], kinds: string[]): HeroAbilityProperty | undefined {
  return props.find((p) => kinds.includes(p.kind ?? '') && (numeric(p.value) ?? 0) > 0);
}

export interface TierAbility {
  baseline: AbilityBaseline;
  labels: { damage: string; cooldown: string; duration: string; range: string };
  //ambiguities upstream does not resolve, rendered beside C24's standing note.
  notes: string[];
}

/** Apply every upgrade from tier 1..`tier` — a '%' bonus scales, anything else adds. */
function applyUpgrades(
  ability: HeroAbilityNumerics,
  tier: number,
  values: Map<string, number>,
): string[] {
  const notes: string[] = [];
  for (const t of ability.tiers ?? []) {
    if (t.tier > tier) continue;
    const hitsThisTier = new Map<string, number>();
    for (const up of t.upgrades ?? []) {
      const current = values.get(up.name);
      if (current == null) continue;
      const raw = String(up.bonus ?? '');
      const n = numeric(up.bonus);
      if (n == null) continue;
      values.set(up.name, raw.trim().endsWith('%') ? current * (1 + n / 100) : current + n);
      const hits = (hitsThisTier.get(up.name) ?? 0) + 1;
      hitsThisTier.set(up.name, hits);
      if (hits === 2) {
        notes.push(`T${t.tier} lists two upgrades on ${up.name} and upstream does not say which is the scaling one — both are added.`);
      }
    }
  }
  return notes;
}

export function tierAbilities(abilities: readonly HeroAbilityNumerics[] | undefined, tier: number): TierAbility[] {
  return (abilities ?? [])
    .filter((a) => a.slot?.startsWith('signature'))
    .sort((a, b) => a.order - b.order)
    .map((a) => {
      const props = a.properties ?? [];
      const picked = {
        damage: pickProp(props, FIELD_KINDS.damage),
        cooldown: pickProp(props, FIELD_KINDS.cooldown),
        duration: pickProp(props, FIELD_KINDS.duration),
        range: pickProp(props, FIELD_KINDS.range),
      };
      const values = new Map<string, number>();
      for (const p of Object.values(picked)) {
        if (p) values.set(p.name, numeric(p.value) as number);
      }
      const notes = applyUpgrades(a, tier, values);
      const valueOf = (p: HeroAbilityProperty | undefined) => (p ? (values.get(p.name) ?? null) : null);
      return {
        baseline: {
          abilityId: a.ability_id,
          name: a.name ?? a.class_name,
          damage: valueOf(picked.damage),
          spiritScaling: spiritScaleOf(picked.damage?.scaling),
          cooldown: valueOf(picked.cooldown),
          duration: valueOf(picked.duration),
          range: valueOf(picked.range),
        },
        labels: {
          damage: picked.damage?.label ?? 'Damage',
          cooldown: picked.cooldown?.label ?? 'Cooldown',
          duration: picked.duration?.label ?? 'Duration',
          range: picked.range?.label ?? 'Range',
        },
        notes,
      };
    });
}

const CDR_PROP = 'MODIFIER_VALUE_COOLDOWN_REDUCTION_PERCENTAGE';

/** The build's side of C24's fold: spirit power off the panels, CDR per item so it compounds. */
export function buildModifiers(
  stats: ComputedStats,
  items: readonly number[],
  byId: ReadonlyMap<number, CatalogItem>,
): BuildModifiers {
  const lineValue = (key: string) => stats.spirit.find((l) => l.key === key)?.value ?? 0;
  const cdr: number[] = [];
  for (const id of items) {
    for (const row of byId.get(id)?.modifiers ?? []) {
      if (row.property_type === CDR_PROP && row.value !== 0) cdr.push(Math.abs(row.value) / 100);
    }
  }
  return {
    spiritPower: lineValue('spirit_power'),
    cdr,
    durationPct: lineValue('ability_duration'),
    rangePct: lineValue('ability_range'),
  };
}

//The three payout modifiers the live track uses, in the design's wording; anything else falls
//back to the humanised key rather than inventing a phrase.
const INVESTMENT_LABEL: Record<string, string> = {
  MODIFIER_VALUE_WEAPON_DAMAGE_INCREASE: 'weapon damage',
  MODIFIER_VALUE_BASE_HEALTH_PERCENT: 'max health',
  MODIFIER_VALUE_TECH_POWER: 'spirit power',
};

export function investmentBonusText(row: InvestmentRow): string | null {
  if (!row.applied) return null;
  const percent = /PERCENT$|INCREASE$/.test(row.prop);
  const label = INVESTMENT_LABEL[row.prop] ?? statLabel(row.prop.replace(/^MODIFIER_VALUE_/, '')).toLowerCase();
  return `+${row.applied.bonus}${percent ? '%' : ''} ${label}`;
}
