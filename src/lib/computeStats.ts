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
  //The investment step already folded into the panels above — a disclosure row, not an extra.
  investment: Investment | null;
  levelScaling: LevelScaling | null;
  weaponDps: WeaponDps | null;
}

//The slim `/heroes/:id/assets` keys this calculator reads; typed `unknown` on the wire
//(C10 serves a key only when upstream has it) and parsed defensively here.
export interface HeroAssetsLike {
  cost_bonuses?: unknown;
  purchase_bonuses?: unknown;
  standard_level_up_upgrades?: unknown;
}

export const MAX_LEVEL = 36;

export interface ComputeOptions {
  assets?: HeroAssetsLike | null;
  level?: number;
  weapon?: WeaponBaseline | null;
}

export interface InvestmentStep {
  index: number;
  threshold: number;
  bonus: number;
}
export interface InvestmentRow {
  category: Category;
  //the modifier this category's bonus is paid in (weapon damage %, base-health %, flat spirit).
  prop: string;
  spend: number;
  steps: InvestmentStep[];
  applied: InvestmentStep | null;
  next: InvestmentStep | null;
  toNext: number | null;
}
export type Investment = Record<Category, InvestmentRow>;

export interface LevelScalingRow {
  prop: string;
  //the STAT_DEF this row fed, or null when nothing on the panels consumes it.
  statKey: string | null;
  perLevel: number;
  applied: number;
}
export interface LevelScaling {
  level: number;
  rows: LevelScalingRow[];
}

//Per-shot weapon numbers the served routes do not carry (03 gap G9) — supplied by the caller
//or the derivation is omitted whole.
export interface WeaponBaseline {
  bulletDamage: number;
  cycleTime: number;
  clipSize: number;
  reloadTime: number;
  bulletsPerShot?: number;
}
export interface DerivedRow {
  key: string;
  label: string;
  unit: 'flat' | 'seconds' | 'per_second' | 'dps';
  base: number;
  value: number;
}
export interface WeaponDps {
  rows: DerivedRow[];
  burstDps: number;
  sustainedDps: number;
}

//One display stat. `baseKey` reads the hero base value (absent ⇒ base 0). `addProps` sum as
//flat adders; `pctProps` sum as a base scaler; `bonusProps` sum as a standalone percent line
//(no base). `sign` flips reductions negative (cooldown reduction shows as −25 %). `scope:
//'ability'` routes an imbued item's contribution to the ability line instead of the panel.
//`levelProp` names this stat's row in `standard_level_up_upgrades`; the per-level growth joins
//the BASE term (so a base-percent item scales it too), never the flat-add term.
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
  levelProp?: string;
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
  { key: 'max_health', label: 'Max Health', category: 'vitality', unit: 'flat', scope: 'global', baseKey: 'max_health', addProps: [`${M}HEALTH_MAX`], pctProps: [`${M}HEALTH_MAX_PERCENT`, `${M}BASE_HEALTH_PERCENT`], levelProp: `${M}BASE_HEALTH_FROM_LEVEL` },
  { key: 'health_regen', label: 'Health Regen', category: 'vitality', unit: 'flat', scope: 'global', baseKey: 'base_health_regen', addProps: [`${M}HEALTH_REGEN_PER_SECOND`] },
  { key: 'bullet_resist', label: 'Bullet Resist', category: 'vitality', unit: 'percent', scope: 'global', bonusProps: [`${M}BULLET_ARMOR_DAMAGE_RESIST`], levelProp: `${M}BULLET_ARMOR_DAMAGE_RESIST` },
  { key: 'spirit_resist', label: 'Spirit Resist', category: 'vitality', unit: 'percent', scope: 'global', bonusProps: [`${M}TECH_RESIST`], levelProp: `${M}TECH_RESIST` },
  { key: 'melee_resist', label: 'Melee Resist', category: 'vitality', unit: 'percent', scope: 'global', bonusProps: [`${M}MELEE_RESIST`] },
  { key: 'debuff_resist', label: 'Debuff Resist', category: 'vitality', unit: 'percent', scope: 'global', bonusProps: [`${M}STATUS_RESISTANCE`] },
  { key: 'barrier', label: 'Barrier', category: 'vitality', unit: 'flat', scope: 'global', addProps: [`${M}BARRIER_HEALTH`] },
  { key: 'stamina', label: 'Stamina', category: 'vitality', unit: 'flat', scope: 'global', baseKey: 'stamina', addProps: [`${M}STAMINA`] },
  //Spirit
  { key: 'spirit_power', label: 'Spirit Power', category: 'spirit', unit: 'flat', scope: 'global', addProps: [`${M}TECH_POWER`], pctProps: [`${M}TECH_POWER_PERCENT`], levelProp: `${M}TECH_POWER` },
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

//---- investment track + per-level scaling readers ----------------------------

//Fallback pay-out modifier per category when `purchase_bonuses` is absent — the three the live
//payload uses (probed 2026-09-12): weapon damage %, % of BASE health, flat spirit power.
const INVESTMENT_PROP: Record<Category, string> = {
  weapon: `${M}WEAPON_DAMAGE_INCREASE`,
  vitality: `${M}BASE_HEALTH_PERCENT`,
  spirit: `${M}TECH_POWER`,
};

function numberOf(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : null;
}

function categoryArray(raw: unknown, cat: Category): Record<string, unknown>[] {
  const byCat = raw as Record<string, unknown> | null | undefined;
  const arr = byCat == null ? undefined : byCat[cat];
  return Array.isArray(arr) ? (arr as Record<string, unknown>[]) : [];
}

function investmentSteps(costBonuses: unknown, cat: Category): InvestmentStep[] {
  return categoryArray(costBonuses, cat)
    .flatMap((row) => {
      const threshold = numberOf(row.gold_threshold);
      const bonus = numberOf(row.bonus);
      return threshold == null || bonus == null ? [] : [{ index: 0, threshold, bonus }];
    })
    .sort((a, b) => a.threshold - b.threshold)
    .map((step, i) => ({ ...step, index: i + 1 }));
}

function investmentProp(purchaseBonuses: unknown, cat: Category): string {
  const first = categoryArray(purchaseBonuses, cat)[0];
  const declared = typeof first?.value_type === 'string' ? first.value_type : '';
  return PROP_TO_DEFS.has(declared) ? declared : INVESTMENT_PROP[cat];
}

/** The 11-step track: the HIGHEST threshold at or below the category's spend pays out. */
export function investmentTrack(assets: HeroAssetsLike | null | undefined, spend: Spend): Investment | null {
  if (assets?.cost_bonuses == null) return null;
  const rows = {} as Investment;
  let populated = false;
  for (const category of ['weapon', 'vitality', 'spirit'] as Category[]) {
    const steps = investmentSteps(assets.cost_bonuses, category);
    if (steps.length > 0) populated = true;
    const spent = spend[category];
    let applied: InvestmentStep | null = null;
    for (const step of steps) if (spent >= step.threshold) applied = step;
    const next = steps.find((step) => step.threshold > spent) ?? null;
    rows[category] = {
      category,
      prop: investmentProp(assets.purchase_bonuses, category),
      spend: spent,
      steps,
      applied,
      next,
      toNext: next == null ? null : next.threshold - spent,
    };
  }
  return populated ? rows : null;
}

export function clampLevel(level: number | undefined): number {
  if (level == null || !Number.isFinite(level)) return 1;
  return Math.min(MAX_LEVEL, Math.max(1, Math.trunc(level)));
}

const LEVEL_PROP_TO_STAT = new Map<string, string>();
for (const def of STAT_DEFS) if (def.levelProp) LEVEL_PROP_TO_STAT.set(def.levelProp, def.key);

//Rows with no STAT_DEF home (bullet/melee damage from level, boon count) still come back with a
//null `statKey` — the weapon derivation reads bullet damage, and the UI discloses the rest.
export function levelScaling(assets: HeroAssetsLike | null | undefined, level: number): LevelScaling | null {
  const upgrades = assets?.standard_level_up_upgrades as Record<string, unknown> | null | undefined;
  if (upgrades == null || typeof upgrades !== 'object') return null;
  const levels = clampLevel(level) - 1;
  const rows: LevelScalingRow[] = [];
  for (const [prop, raw] of Object.entries(upgrades)) {
    const value = numberOf(raw);
    if (value == null || value === 0) continue;
    rows.push({ prop, statKey: LEVEL_PROP_TO_STAT.get(prop) ?? null, perLevel: value, applied: value * levels });
  }
  return { level: clampLevel(level), rows };
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

function isStandalonePercent(def: StatDef): boolean {
  return def.unit === 'percent' && !def.baseKey && !def.addProps;
}

function resolveLine(b: number, def: StatDef, acc: Acc): StatLine {
  let value: number;
  if (isStandalonePercent(def)) {
    //standalone percent bonus (no base): statlocker sums like-kind percents.
    value = (def.sign ?? 1) * acc.bonus;
  } else {
    //absolute stat: base × scale THEN flat adds (owner §4). base 0 ⇒ percent scaler is inert.
    value = b * (1 + acc.pct / 100) + acc.add;
  }
  return { key: def.key, label: def.label, category: def.category, unit: def.unit, base: b, value, delta: value - b };
}

//Per-shot rows the panels do not carry: the build's weapon percents applied to a caller-supplied
//baseline. Sustained folds the reload in; burst is one clip at cycle rate.
function weaponDerivation(baseline: WeaponBaseline, accOf: (key: string) => Acc, bulletFromLevel: number): WeaponDps | null {
  const { cycleTime, clipSize, reloadTime } = baseline;
  if (!(cycleTime > 0) || !(clipSize > 0)) return null;
  const shots = baseline.bulletsPerShot ?? 1;
  const ammo = accOf('ammo');

  const damage = (baseline.bulletDamage + bulletFromLevel) * (1 + accOf('weapon_damage').bonus / 100);
  const cycle = cycleTime / (1 + accOf('fire_rate').bonus / 100);
  const clip = clipSize * (1 + ammo.pct / 100) + ammo.add;
  const reload = reloadTime / (1 + accOf('reload_speed').bonus / 100);
  if (!(cycle > 0) || !(clip > 0)) return null;

  const burstOf = (d: number, c: number) => (d * shots) / c;
  const sustainedOf = (d: number, c: number, n: number, r: number) => (n * d * shots) / (n * c + r);
  const burstDps = burstOf(damage, cycle);
  const sustainedDps = sustainedOf(damage, cycle, clip, reload);

  return {
    burstDps,
    sustainedDps,
    rows: [
      { key: 'bullet_damage', label: 'Bullet Damage', unit: 'flat', base: baseline.bulletDamage, value: damage },
      { key: 'fire_rate_shots', label: 'Shots / sec', unit: 'per_second', base: 1 / cycleTime, value: 1 / cycle },
      { key: 'clip_size', label: 'Clip Size', unit: 'flat', base: clipSize, value: clip },
      { key: 'reload_time', label: 'Reload Time', unit: 'seconds', base: reloadTime, value: reload },
      { key: 'weapon_dps_burst', label: 'DPS (one clip)', unit: 'dps', base: burstOf(baseline.bulletDamage, cycleTime), value: burstDps },
      { key: 'weapon_dps_sustained', label: 'DPS (with reload)', unit: 'dps', base: sustainedOf(baseline.bulletDamage, cycleTime, clipSize, reloadTime), value: sustainedDps },
    ],
  };
}

export function computeStats(base: BaseStats, catalog: ItemMods[], build: BuildInput, options: ComputeOptions = {}): ComputedStats {
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

  //The extensions fold into the SAME accumulators the items feed, so the locked application
  //order (base × (1+Σpct) + Σflat) resolves them — nothing here re-orders it.
  const investment = investmentTrack(options.assets, spend);
  if (investment) {
    for (const row of Object.values(investment)) {
      if (!row.applied) continue;
      for (const def of PROP_TO_DEFS.get(row.prop) ?? []) {
        const acc = global.get(def.key) ?? emptyAcc();
        foldRow(acc, def, { property_type: row.prop, value: row.applied.bonus, is_percent: def.unit === 'percent' });
        global.set(def.key, acc);
      }
    }
  }

  const level = clampLevel(options.level);
  const scaling = levelScaling(options.assets, level);
  const levelAdds = new Map<string, number>();
  for (const row of scaling?.rows ?? []) if (row.statKey) levelAdds.set(row.statKey, row.applied);

  const baseFor = (def: StatDef): number => {
    const b = baseNum(base, def.baseKey);
    return isStandalonePercent(def) ? b : b + (levelAdds.get(def.key) ?? 0);
  };
  //A resist grows as a standalone percent line, not as a base — it has no base term to scale.
  for (const def of STAT_DEFS) {
    if (!isStandalonePercent(def)) continue;
    const grown = levelAdds.get(def.key) ?? 0;
    if (grown === 0) continue;
    const acc = global.get(def.key) ?? emptyAcc();
    acc.bonus += grown;
    global.set(def.key, acc);
  }

  const byCategory: Record<Category, StatLine[]> = { weapon: [], vitality: [], spirit: [] };
  for (const def of STAT_DEFS) {
    const grown = levelAdds.get(def.key) ?? 0;
    const acc = global.get(def.key) ?? (grown === 0 ? undefined : emptyAcc());
    if (!acc) continue;
    const line = resolveLine(baseFor(def), def, acc);
    if (grown === 0 && line.delta === 0 && line.value === line.base) continue;
    byCategory[def.category].push(line);
  }

  const perAbility: Record<number, ImbueLine[]> = {};
  for (const [abilityId, defMap] of perAbilityAcc) {
    for (const [defKey, acc] of defMap) {
      const def = STAT_DEFS.find((d) => d.key === defKey)!;
      const line = resolveLine(baseNum(base, def.baseKey), def, acc);
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

  const bulletFromLevel = (scaling?.rows ?? []).find((r) => r.prop === `${M}BASE_BULLET_DAMAGE_FROM_LEVEL`)?.applied ?? 0;
  const weaponDps = options.weapon
    ? weaponDerivation(options.weapon, (key) => global.get(key) ?? emptyAcc(), bulletFromLevel)
    : null;

  return {
    weapon: byCategory.weapon,
    vitality: byCategory.vitality,
    spirit: byCategory.spirit,
    perAbility,
    spend,
    investment,
    levelScaling: scaling,
    weaponDps,
  };
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
