//Deterministic build-stat calculator (statlocker parity, scope a). Pure TS, no React:
//given a hero's base-stats snapshot + the item-modifier catalog + a build, it returns the
//Weapon/Vitality/Spirit calculated panels, per-ability imbue lines, and the souls spend.
//The application order is FIXED per owner-session-inputs §4 ("base × scale then flat adds")
//and locked by the golden tests in computeStats.test.ts — a golden failure is a spec change,
//not a silent re-tune.

export interface StatValue {
  value: number;
  display_stat_name?: string;
}
export type BaseStats = Record<string, StatValue | number | unknown>;

export interface ModifierRow {
  property_type: string;
  value: number;
  is_percent: boolean;
  label?: string | null;
}
export interface ItemMods {
  item_id: number | null;
  item_name: string | null;
  item_slot_type: string | null;
  item_tier: number | null;
  cost: number | null;
  modifiers: ModifierRow[];
}

export type Category = 'weapon' | 'vitality' | 'spirit';

//A build the calculator can score. `imbueTargets` attaches an item to ONE ability (its
//ability-scoped bonuses then land on that ability's line, not the global panel — owner §4).
//`conditionalsOn` is the set of conditional items currently counted (the global Enable-
//Conditionals toggle expands/collapses it); a conditional item NOT in the set is skipped
//whole (item-level granularity — the payload carries no per-modifier conditional flag).
//`upgradesFrom` maps an item to the component it upgrades from so the souls total deducts
//the already-owned component price.
export interface BuildInput {
  heroId: number;
  patch?: string;
  items: number[];
  imbueTargets?: Record<number, number>;
  conditionalItems?: number[];
  conditionalsOn?: number[];
  upgradesFrom?: Record<number, number>;
  abilityOrder?: number[];
}

export interface StatLine {
  key: string;
  label: string;
  category: Category;
  unit: 'flat' | 'percent';
  base: number;
  value: number;
  delta: number;
}
export interface ImbueLine {
  itemId: number;
  itemName: string;
  lines: { key: string; label: string; unit: 'flat' | 'percent'; value: number }[];
}
export interface Spend {
  weapon: number;
  vitality: number;
  spirit: number;
  flex: number;
  total: number;
  effectiveTotal: number;
}
export interface ComputedStats {
  weapon: StatLine[];
  vitality: StatLine[];
  spirit: StatLine[];
  perAbility: Record<number, ImbueLine[]>;
  spend: Spend;
}

//One display stat. `baseKey` reads the hero base value (absent ⇒ base 0). `addProps` sum as
//flat adders; `pctProps` sum as a base scaler; `bonusProps` sum as a standalone percent line
//(no base). `sign` flips reductions negative (cooldown reduction shows as −25 %). `scope:
//'ability'` routes an imbued item's contribution to the ability line instead of the panel.
interface StatDef {
  key: string;
  label: string;
  category: Category;
  unit: 'flat' | 'percent';
  scope: 'global' | 'ability';
  baseKey?: string;
  addProps?: string[];
  pctProps?: string[];
  bonusProps?: string[];
  sign?: 1 | -1;
}

const M = 'MODIFIER_VALUE_';
export const STAT_DEFS: StatDef[] = [
  //Weapon
  { key: 'weapon_damage', label: 'Weapon Damage', category: 'weapon', unit: 'percent', scope: 'global', bonusProps: [`${M}WEAPON_DAMAGE_INCREASE`] },
  { key: 'fire_rate', label: 'Fire Rate', category: 'weapon', unit: 'percent', scope: 'global', bonusProps: [`${M}FIRE_RATE`] },
  { key: 'bullet_velocity', label: 'Bullet Velocity', category: 'weapon', unit: 'percent', scope: 'global', bonusProps: [`${M}BONUS_BULLET_SPEED_PERCENT`] },
  { key: 'ammo', label: 'Ammo', category: 'weapon', unit: 'flat', scope: 'global', addProps: [`${M}AMMO_CLIP_SIZE`], pctProps: [`${M}AMMO_CLIP_SIZE_PERCENT`] },
  { key: 'bullet_lifesteal', label: 'Bullet Lifesteal', category: 'weapon', unit: 'percent', scope: 'global', bonusProps: [`${M}BULLET_LIFESTEAL`] },
  { key: 'reload_speed', label: 'Reload Time', category: 'weapon', unit: 'percent', scope: 'global', bonusProps: [`${M}RELOAD_SPEED`] },
  //Vitality
  { key: 'max_health', label: 'Max Health', category: 'vitality', unit: 'flat', scope: 'global', baseKey: 'max_health', addProps: [`${M}HEALTH_MAX`], pctProps: [`${M}HEALTH_MAX_PERCENT`, `${M}BASE_HEALTH_PERCENT`] },
  { key: 'health_regen', label: 'Health Regen', category: 'vitality', unit: 'flat', scope: 'global', baseKey: 'base_health_regen', addProps: [`${M}HEALTH_REGEN_PER_SECOND`] },
  { key: 'bullet_resist', label: 'Bullet Resist', category: 'vitality', unit: 'percent', scope: 'global', bonusProps: [`${M}BULLET_ARMOR_DAMAGE_RESIST`] },
  { key: 'spirit_resist', label: 'Spirit Resist', category: 'vitality', unit: 'percent', scope: 'global', bonusProps: [`${M}TECH_RESIST`] },
  { key: 'melee_resist', label: 'Melee Resist', category: 'vitality', unit: 'percent', scope: 'global', bonusProps: [`${M}MELEE_RESIST`] },
  { key: 'debuff_resist', label: 'Debuff Resist', category: 'vitality', unit: 'percent', scope: 'global', bonusProps: [`${M}STATUS_RESISTANCE`] },
  { key: 'barrier', label: 'Barrier', category: 'vitality', unit: 'flat', scope: 'global', addProps: [`${M}BARRIER_HEALTH`] },
  { key: 'stamina', label: 'Stamina', category: 'vitality', unit: 'flat', scope: 'global', baseKey: 'stamina', addProps: [`${M}STAMINA`] },
  //Spirit
  { key: 'spirit_power', label: 'Spirit Power', category: 'spirit', unit: 'flat', scope: 'global', addProps: [`${M}TECH_POWER`], pctProps: [`${M}TECH_POWER_PERCENT`] },
  { key: 'cooldown', label: 'Cooldown Reduction', category: 'spirit', unit: 'percent', scope: 'ability', sign: -1, bonusProps: [`${M}COOLDOWN_REDUCTION_PERCENTAGE`] },
  { key: 'ability_range', label: 'Ability Range', category: 'spirit', unit: 'percent', scope: 'ability', bonusProps: [`${M}TECH_RANGE_PERCENT`] },
  { key: 'ability_radius', label: 'Ability Radius', category: 'spirit', unit: 'percent', scope: 'ability', bonusProps: [`${M}TECH_RADIUS_PERCENT`] },
  { key: 'ability_duration', label: 'Ability Duration', category: 'spirit', unit: 'percent', scope: 'ability', bonusProps: [`${M}BONUS_ABILITY_DURATION_PERCENTAGE`] },
  { key: 'spirit_lifesteal', label: 'Spirit Lifesteal', category: 'spirit', unit: 'percent', scope: 'global', bonusProps: [`${M}TECH_LIFESTEAL`] },
  { key: 'spirit_resist_reduction', label: 'Spirit Resist Reduction', category: 'spirit', unit: 'percent', scope: 'global', bonusProps: [`${M}TECH_RESIST_REDUCTION`] },
];

//property_type → the defs consuming it (a property can feed only one def here, but the map
//keeps lookup O(1) and tolerant of a future many-to-one).
const PROP_TO_DEFS = new Map<string, StatDef[]>();
for (const def of STAT_DEFS) {
  for (const p of [...(def.addProps ?? []), ...(def.pctProps ?? []), ...(def.bonusProps ?? [])]) {
    const arr = PROP_TO_DEFS.get(p) ?? [];
    arr.push(def);
    PROP_TO_DEFS.set(p, arr);
  }
}

function baseNum(base: BaseStats, key?: string): number {
  if (!key) return 0;
  const v = base[key];
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object' && typeof (v as StatValue).value === 'number') return (v as StatValue).value;
  return 0;
}

function slotCategory(slot: string | null): Category | 'flex' {
  if (slot === 'weapon' || slot === 'vitality' || slot === 'spirit') return slot;
  return 'flex';
}

//A per-def accumulator: flat adds, base-scaling percents, standalone bonus percents.
interface Acc {
  add: number;
  pct: number;
  bonus: number;
}
function emptyAcc(): Acc {
  return { add: 0, pct: 0, bonus: 0 };
}

function foldRow(acc: Acc, def: StatDef, row: ModifierRow): void {
  if (def.addProps?.includes(row.property_type)) acc.add += row.value;
  else if (def.pctProps?.includes(row.property_type)) acc.pct += row.value;
  else if (def.bonusProps?.includes(row.property_type)) acc.bonus += row.value;
}

function resolveLine(base: BaseStats, def: StatDef, acc: Acc): StatLine {
  const b = baseNum(base, def.baseKey);
  let value: number;
  if (def.unit === 'percent' && !def.baseKey && !def.addProps) {
    //standalone percent bonus (no base): statlocker sums like-kind percents.
    value = (def.sign ?? 1) * acc.bonus;
  } else {
    //absolute stat: base × scale THEN flat adds (owner §4). base 0 ⇒ percent scaler is inert.
    value = b * (1 + acc.pct / 100) + acc.add;
  }
  return { key: def.key, label: def.label, category: def.category, unit: def.unit, base: b, value, delta: value - b };
}

export function computeStats(base: BaseStats, catalog: ItemMods[], build: BuildInput): ComputedStats {
  const byId = new Map<number, ItemMods>();
  for (const it of catalog) if (it.item_id != null) byId.set(it.item_id, it);

  const imbue = build.imbueTargets ?? {};
  const conditionalItems = new Set(build.conditionalItems ?? []);
  const conditionalsOn = new Set(build.conditionalsOn ?? []);
  const upgradesFrom = build.upgradesFrom ?? {};

  const global = new Map<string, Acc>();
  const perAbilityAcc = new Map<number, Map<string, Acc>>();
  const perAbilityItems = new Map<number, Map<number, ImbueLine>>();
  const spend: Spend = { weapon: 0, vitality: 0, spirit: 0, flex: 0, total: 0, effectiveTotal: 0 };

  for (const itemId of build.items) {
    const it = byId.get(itemId);
    if (!it) continue;
    //conditional-but-disabled items contribute nothing (global toggle, item granularity).
    if (conditionalItems.has(itemId) && !conditionalsOn.has(itemId)) {
      accrueSpend(spend, it, upgradesFrom[itemId], byId);
      continue;
    }
    const targetAbility = imbue[itemId];
    for (const row of it.modifiers) {
      const defs = PROP_TO_DEFS.get(row.property_type);
      if (!defs) continue;
      for (const def of defs) {
        const routeToAbility = def.scope === 'ability' && targetAbility != null;
        if (routeToAbility) {
          const abMap = perAbilityAcc.get(targetAbility) ?? new Map<string, Acc>();
          const acc = abMap.get(def.key) ?? emptyAcc();
          foldRow(acc, def, row);
          abMap.set(def.key, acc);
          perAbilityAcc.set(targetAbility, abMap);
        } else {
          const acc = global.get(def.key) ?? emptyAcc();
          foldRow(acc, def, row);
          global.set(def.key, acc);
        }
      }
    }
    accrueSpend(spend, it, upgradesFrom[itemId], byId);
  }

  const byCategory: Record<Category, StatLine[]> = { weapon: [], vitality: [], spirit: [] };
  for (const def of STAT_DEFS) {
    const acc = global.get(def.key);
    if (!acc) continue;
    const line = resolveLine(base, def, acc);
    if (line.delta === 0 && line.value === line.base) continue;
    byCategory[def.category].push(line);
  }

  const perAbility: Record<number, ImbueLine[]> = {};
  for (const [abilityId, defMap] of perAbilityAcc) {
    for (const [defKey, acc] of defMap) {
      const def = STAT_DEFS.find((d) => d.key === defKey)!;
      const line = resolveLine(base, def, acc);
      if (line.value === 0) continue;
      //group the ability's lines under each imbued item that fed them.
      for (const itemId of build.items) {
        if (imbue[itemId] !== abilityId) continue;
        const it = byId.get(itemId);
        if (!it || !it.modifiers.some((r) => defFeeds(def, r.property_type))) continue;
        const items = perAbilityItems.get(abilityId) ?? new Map<number, ImbueLine>();
        const entry = items.get(itemId) ?? { itemId, itemName: it.item_name ?? `Item ${itemId}`, lines: [] };
        entry.lines.push({ key: def.key, label: def.label, unit: def.unit, value: line.value });
        items.set(itemId, entry);
        perAbilityItems.set(abilityId, items);
      }
    }
  }
  for (const [abilityId, items] of perAbilityItems) perAbility[abilityId] = [...items.values()];

  return { weapon: byCategory.weapon, vitality: byCategory.vitality, spirit: byCategory.spirit, perAbility, spend };
}

function defFeeds(def: StatDef, prop: string): boolean {
  return !!(def.addProps?.includes(prop) || def.pctProps?.includes(prop) || def.bonusProps?.includes(prop));
}

function accrueSpend(spend: Spend, it: ItemMods, componentId: number | undefined, byId: Map<number, ItemMods>): void {
  const cost = it.cost ?? 0;
  const cat = slotCategory(it.item_slot_type);
  spend[cat] += cost;
  spend.total += cost;
  const componentCost = componentId != null ? byId.get(componentId)?.cost ?? 0 : 0;
  spend.effectiveTotal += cost - componentCost;
}
