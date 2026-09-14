//Hero gun baseline from the upstream items catalog (type "weapon", one primary per hero): the
//Weapon panel rows the design draws. Fetched once per build; the panel's cold state stands when
//the catalog is unreachable.
import type { WeaponBaseline } from './computeStats';
import type { StatRow } from './heroKit';

//hero_id (as a string key, it crosses an island prop) -> the primary gun.
export type WeaponTable = Record<string, WeaponInfo>;

const ITEMS_URL = 'https://assets.deadlock-api.com/v2/items';
//Ranges arrive in Source units (inches); the client shows metres.
const UNITS_PER_METRE = 39.37;

export interface WeaponInfo {
  bullet_damage: number;
  bullets: number;
  shots_per_second: number;
  clip_size: number;
  reload_duration: number;
  damage_per_second: number;
  damage_per_second_with_reload: number;
  damage_falloff_start_range: number;
  damage_falloff_end_range: number;
}

const WEAPON_KEYS: readonly (keyof WeaponInfo)[] = [
  'bullet_damage',
  'bullets',
  'shots_per_second',
  'clip_size',
  'reload_duration',
  'damage_per_second',
  'damage_per_second_with_reload',
  'damage_falloff_start_range',
  'damage_falloff_end_range',
];

export interface WeaponItem {
  class_name?: string;
  type?: string;
  hero?: number | null;
  weapon_info?: Record<string, unknown> | null;
}

export function weaponInfoOf(item: WeaponItem): WeaponInfo | null {
  const info = item.weapon_info;
  if (!info) return null;
  const out: Partial<WeaponInfo> = {};
  for (const k of WEAPON_KEYS) {
    const v = info[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    out[k] = v;
  }
  return out as WeaponInfo;
}

//The primary gun's class name ends in `_set`; `_alt` and `_set_2` are the hero's other fire modes.
export function primaryWeapons(items: readonly WeaponItem[]): Map<number, WeaponInfo> {
  const out = new Map<number, WeaponInfo>();
  const alternate = new Map<number, WeaponInfo>();
  for (const item of items) {
    if (item.type !== 'weapon' || typeof item.hero !== 'number') continue;
    const info = weaponInfoOf(item);
    if (!info) continue;
    if (item.class_name?.endsWith('_set')) out.set(item.hero, info);
    else if (!alternate.has(item.hero)) alternate.set(item.hero, info);
  }
  for (const [hero, info] of alternate) if (!out.has(hero)) out.set(hero, info);
  return out;
}

const one = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const metres = (units: number): number => Math.round(units / UNITS_PER_METRE);

export function weaponInfoRows(w: WeaponInfo | null | undefined): StatRow[] {
  if (!w) return [];
  const perBullet = w.bullets > 1 ? `${one(w.bullet_damage)} ×${w.bullets}` : one(w.bullet_damage);
  return [
    { k: 'DPS', v: String(Math.round(w.damage_per_second)) },
    { k: 'Sustained DPS', v: String(Math.round(w.damage_per_second_with_reload)) },
    { k: 'Bullet damage', v: perBullet },
    { k: 'Rounds per second', v: one(w.shots_per_second) },
    { k: 'Clip', v: String(w.clip_size) },
    { k: 'Reload', v: `${one(w.reload_duration)}s` },
    { k: 'Falloff', v: `${metres(w.damage_falloff_start_range)}–${metres(w.damage_falloff_end_range)}m` },
  ];
}

//The calculator's per-shot baseline: cycle time is the inverse fire rate.
export function weaponBaselineOf(w: WeaponInfo | null | undefined): WeaponBaseline | null {
  if (!w || !(w.shots_per_second > 0)) return null;
  return {
    bulletDamage: w.bullet_damage,
    cycleTime: 1 / w.shots_per_second,
    clipSize: w.clip_size,
    reloadTime: w.reload_duration,
    bulletsPerShot: w.bullets,
  };
}

let table: Promise<Map<number, WeaponInfo>> | null = null;

export function fetchHeroWeapons(fetchImpl: typeof fetch = fetch): Promise<Map<number, WeaponInfo>> {
  table ??= fetchImpl(ITEMS_URL)
    .then(async (r) => {
      if (!r.ok) throw new Error(`items catalog ${r.status}`);
      return primaryWeapons((await r.json()) as WeaponItem[]);
    })
    .catch(() => new Map<number, WeaponInfo>());
  return table;
}
