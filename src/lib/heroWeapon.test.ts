import { describe, expect, it } from 'vitest';
import { primaryWeapons, weaponBaselineOf, weaponInfoOf, weaponInfoRows, type WeaponItem } from './heroWeapon';

const haze = {
  bullet_damage: 5.26,
  bullets: 1,
  shots_per_second: 9.523809523809524,
  clip_size: 25,
  reload_duration: 2.35,
  damage_per_second: 50.095238095238095,
  damage_per_second_with_reload: 25.167464114832537,
  damage_falloff_start_range: 787,
  damage_falloff_end_range: 1811,
};

const item = (class_name: string, hero: number, weapon_info: Record<string, unknown> | null = haze): WeaponItem => ({
  class_name,
  type: 'weapon',
  hero,
  weapon_info,
});

describe('weaponInfoRows — the design\'s seven Weapon rows from upstream weapon_info', () => {
  it('rounds DPS, keeps one decimal on per-shot figures, converts falloff units to metres', () => {
    expect(weaponInfoRows(haze)).toEqual([
      { k: 'DPS', v: '50' },
      { k: 'Sustained DPS', v: '25' },
      { k: 'Bullet damage', v: '5.3' },
      { k: 'Rounds per second', v: '9.5' },
      { k: 'Clip', v: '25' },
      { k: 'Reload', v: '2.4s' },
      { k: 'Falloff', v: '20-46m' },
    ]);
  });

  it('names the pellet count on a multi-bullet gun and stays empty without a baseline', () => {
    const rows = weaponInfoRows({ ...haze, bullet_damage: 3.24, bullets: 4 });
    expect(rows[2]).toEqual({ k: 'Bullet damage', v: '3.2 ×4' });
    expect(weaponInfoRows(null)).toEqual([]);
  });
});

describe('primaryWeapons — one gun per hero out of the items catalog', () => {
  it('prefers the _set entry over _alt and _set_2, and skips non-weapons and broken rows', () => {
    const alt = { ...haze, clip_size: 8 };
    const table = primaryWeapons([
      item('citadel_weapon_shiv_alt', 19, alt),
      item('citadel_weapon_shiv_set', 19),
      item('citadel_weapon_viscous_set_2', 35, alt),
      item('citadel_weapon_viscous_set', 35),
      item('citadel_weapon_lonely_alt', 7, alt),
      { class_name: 'upgrade_clip_size', type: 'upgrade', hero: null, weapon_info: null },
      item('citadel_weapon_broken_set', 9, { bullet_damage: 'x' }),
    ]);
    expect(table.get(19)?.clip_size).toBe(25);
    expect(table.get(35)?.clip_size).toBe(25);
    expect(table.get(7)?.clip_size).toBe(8);
    expect(table.has(9)).toBe(false);
    expect(table.size).toBe(3);
  });

  it('turns weapon_info into the calculator baseline, cycle time as the inverse fire rate', () => {
    const b = weaponBaselineOf(haze);
    expect(b?.bulletDamage).toBe(5.26);
    expect(b?.cycleTime).toBeCloseTo(0.105, 3);
    expect(b?.clipSize).toBe(25);
    expect(b?.reloadTime).toBe(2.35);
    expect(b?.bulletsPerShot).toBe(1);
    expect(weaponBaselineOf({ ...haze, shots_per_second: 0 })).toBeNull();
    expect(weaponBaselineOf(null)).toBeNull();
  });

  it('rejects a weapon_info with a missing or non-numeric field', () => {
    expect(weaponInfoOf(item('x_set', 1, { ...haze, clip_size: undefined }))).toBeNull();
    expect(weaponInfoOf(item('x_set', 1, null))).toBeNull();
    expect(weaponInfoOf(item('x_set', 1))).not.toBeNull();
  });
});
