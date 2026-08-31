import { describe, it, expect } from 'vitest';
import { classifyStat, statUnit, groupBaseStats, STAT_GROUP_ORDER } from './baseStatGroups';

describe('classifyStat — gameplay groups', () => {
  it('routes known gameplay keys to their group', () => {
    expect(classifyStat('max_move_speed', 6.4)).toBe('movement');
    expect(classifyStat('ground_dash_distance_in_meters', 10)).toBe('movement');
    expect(classifyStat('air_dash_duration', 0.51)).toBe('movement');
    expect(classifyStat('light_melee_damage', 50)).toBe('combat');
    expect(classifyStat('heavy_melee_damage', 116)).toBe('combat');
    expect(classifyStat('max_health', 800)).toBe('vitality');
    expect(classifyStat('base_health_regen', 1.5)).toBe('vitality');
    expect(classifyStat('stamina', 3)).toBe('stamina');
    expect(classifyStat('stamina_regen_per_second', 0.22)).toBe('stamina');
    expect(classifyStat('tech_armor_damage_reduction', 10)).toBe('tech');
  });
});

describe('classifyStat — raw bucket', () => {
  it('routes engine scalers to raw regardless of value', () => {
    for (const k of [
      'crit_damage_received_scale',
      'proc_build_up_rate_scale',
      'weapon_power_scale',
      'reload_speed',
      'tech_range',
      'tech_duration',
    ]) {
      expect(classifyStat(k, 1)).toBe('raw');
    }
    //crit_damage_received_scale varies (0.45–1.0) but is still an engine scaler.
    expect(classifyStat('crit_damage_received_scale', 0.45)).toBe('raw');
  });

  it('routes always-zero defaults to raw', () => {
    expect(classifyStat('ability_resource_max', 0)).toBe('raw');
    expect(classifyStat('ability_resource_regen_per_second', 0)).toBe('raw');
    expect(classifyStat('weapon_power', 0)).toBe('raw');
  });

  it('lets a zero value override a gameplay-group mapping', () => {
    expect(classifyStat('tech_armor_damage_reduction', 0)).toBe('raw');
    expect(classifyStat('max_health', 0)).toBe('raw');
  });

  it('routes unmapped keys to raw so nothing is dropped', () => {
    expect(classifyStat('some_future_stat', 42)).toBe('raw');
  });
});

describe('statUnit', () => {
  it('returns the core units (m, m/s, s, hp)', () => {
    expect(statUnit('max_move_speed')).toBe('m/s');
    expect(statUnit('sprint_speed')).toBe('m/s');
    expect(statUnit('crouch_speed')).toBe('m/s');
    expect(statUnit('air_dash_distance_in_meters')).toBe('m');
    expect(statUnit('ground_dash_distance_in_meters')).toBe('m');
    expect(statUnit('air_dash_duration')).toBe('s');
    expect(statUnit('ground_dash_duration')).toBe('s');
    expect(statUnit('max_health')).toBe('hp');
  });

  it('is undefined for unit-less stats', () => {
    expect(statUnit('light_melee_damage')).toBeUndefined();
    expect(statUnit('stamina')).toBeUndefined();
    expect(statUnit('reload_speed')).toBeUndefined();
  });
});

describe('groupBaseStats', () => {
  //The full 24-key upstream starting_stats universe (real keys, alpha-ordered).
  const entries = [
    { key: 'ability_resource_max', value: 0 },
    { key: 'ability_resource_regen_per_second', value: 0 },
    { key: 'air_dash_distance_in_meters', value: 8 },
    { key: 'air_dash_duration', value: 0.51 },
    { key: 'base_health_regen', value: 1.5 },
    { key: 'crit_damage_received_scale', value: 1 },
    { key: 'crouch_speed', value: 4.75 },
    { key: 'ground_dash_distance_in_meters', value: 10 },
    { key: 'ground_dash_duration', value: 0.72 },
    { key: 'heavy_melee_damage', value: 116 },
    { key: 'light_melee_damage', value: 50 },
    { key: 'max_health', value: 800 },
    { key: 'max_move_speed', value: 6.4 },
    { key: 'move_acceleration', value: 4 },
    { key: 'proc_build_up_rate_scale', value: 1 },
    { key: 'reload_speed', value: 1 },
    { key: 'sprint_speed', value: 1.6 },
    { key: 'stamina', value: 3 },
    { key: 'stamina_regen_per_second', value: 0.222 },
    { key: 'tech_armor_damage_reduction', value: 10 },
    { key: 'tech_duration', value: 1 },
    { key: 'tech_range', value: 1 },
    { key: 'weapon_power', value: 0 },
    { key: 'weapon_power_scale', value: 1 },
  ];

  it('drops nothing — Σ(grouped) + raw === input', () => {
    const { groups, raw } = groupBaseStats(entries);
    const total = groups.reduce((n, g) => n + g.stats.length, 0) + raw.length;
    expect(total).toBe(entries.length);
  });

  it('emits only non-empty groups in canonical order', () => {
    const { groups } = groupBaseStats(entries);
    const order = groups.map((g) => g.key);
    const canon = STAT_GROUP_ORDER.map((g) => g.key).filter((k) => order.includes(k));
    expect(order).toEqual(canon);
    expect(groups.map((g) => g.key)).toEqual(['movement', 'combat', 'vitality', 'stamina', 'tech']);
  });

  it('puts every scaler and zero-default in raw, gameplay stats out of it', () => {
    const { raw } = groupBaseStats(entries);
    expect(raw.map((r) => r.key).sort()).toEqual([
      'ability_resource_max',
      'ability_resource_regen_per_second',
      'crit_damage_received_scale',
      'proc_build_up_rate_scale',
      'reload_speed',
      'tech_duration',
      'tech_range',
      'weapon_power',
      'weapon_power_scale',
    ]);
  });

  it('keeps input order within a group', () => {
    const movement = groupBaseStats(entries).groups.find((g) => g.key === 'movement')!;
    const keys = movement.stats.map((s) => s.key);
    expect(keys).toEqual([...keys].sort());
    expect(keys).toContain('max_move_speed');
  });

  it('preserves caller-supplied fields on each entry', () => {
    const labeled = [{ key: 'max_health', value: 800, label: 'Max Health' }];
    const vitality = groupBaseStats(labeled).groups.find((g) => g.key === 'vitality');
    expect(vitality?.stats[0]?.label).toBe('Max Health');
  });
});
