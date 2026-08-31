//Base-stats presentation grouping for the Build Lab hero tab: routes each raw
//starting_stats key to a gameplay group (Movement/Combat/Vitality/Stamina/Tech)
//or the collapsed "Raw engine values" bucket. Presentation only — nothing dropped.

export type StatGroupKey = 'movement' | 'combat' | 'vitality' | 'stamina' | 'tech';

export const STAT_GROUP_ORDER: { key: StatGroupKey; label: string }[] = [
  { key: 'movement', label: 'Movement' },
  { key: 'combat', label: 'Combat' },
  { key: 'vitality', label: 'Vitality' },
  { key: 'stamina', label: 'Stamina' },
  { key: 'tech', label: 'Tech' },
];

const STAT_GROUP: Record<string, StatGroupKey> = {
  max_move_speed: 'movement',
  sprint_speed: 'movement',
  crouch_speed: 'movement',
  move_acceleration: 'movement',
  air_dash_distance_in_meters: 'movement',
  ground_dash_distance_in_meters: 'movement',
  air_dash_duration: 'movement',
  ground_dash_duration: 'movement',
  light_melee_damage: 'combat',
  heavy_melee_damage: 'combat',
  max_health: 'vitality',
  base_health_regen: 'vitality',
  stamina: 'stamina',
  stamina_regen_per_second: 'stamina',
  ability_resource_max: 'tech',
  ability_resource_regen_per_second: 'tech',
  weapon_power: 'tech',
  tech_armor_damage_reduction: 'tech',
};

//Engine multipliers (1.0 = 100% baseline); always collapsed regardless of value.
const SCALER_STATS: ReadonlySet<string> = new Set([
  'crit_damage_received_scale',
  'proc_build_up_rate_scale',
  'weapon_power_scale',
  'reload_speed',
  'tech_range',
  'tech_duration',
]);

const STAT_UNITS: Record<string, string> = {
  max_move_speed: 'm/s',
  sprint_speed: 'm/s',
  crouch_speed: 'm/s',
  move_acceleration: 'm/s²',
  air_dash_distance_in_meters: 'm',
  ground_dash_distance_in_meters: 'm',
  air_dash_duration: 's',
  ground_dash_duration: 's',
  max_health: 'hp',
  base_health_regen: 'hp/s',
  stamina_regen_per_second: '/s',
};

export function statUnit(key: string): string | undefined {
  return STAT_UNITS[key];
}

//Engine scalers and stats sitting at their zero default carry no headline signal
//→ raw bucket; an unmapped key also falls to raw so nothing is ever dropped.
export function classifyStat(key: string, value: number): StatGroupKey | 'raw' {
  if (SCALER_STATS.has(key)) return 'raw';
  if (value === 0) return 'raw';
  return STAT_GROUP[key] ?? 'raw';
}

export interface BaseStatEntry {
  key: string;
  value: number;
}

export interface GroupedBaseStats<T extends BaseStatEntry> {
  groups: { key: StatGroupKey; label: string; stats: T[] }[];
  raw: T[];
}

//Partition into ordered non-empty gameplay groups + the raw bucket, preserving
//input order within each; Σ(grouped) + raw === input (nothing dropped).
export function groupBaseStats<T extends BaseStatEntry>(entries: T[]): GroupedBaseStats<T> {
  const buckets = new Map<StatGroupKey, T[]>();
  const raw: T[] = [];
  for (const e of entries) {
    const g = classifyStat(e.key, e.value);
    if (g === 'raw') {
      raw.push(e);
    } else {
      const arr = buckets.get(g) ?? [];
      arr.push(e);
      buckets.set(g, arr);
    }
  }
  const groups = STAT_GROUP_ORDER.filter((g) => (buckets.get(g.key)?.length ?? 0) > 0).map((g) => ({
    key: g.key,
    label: g.label,
    stats: buckets.get(g.key)!,
  }));
  return { groups, raw };
}
