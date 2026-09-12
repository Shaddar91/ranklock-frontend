//Kit section data: ability cards (name/slot from the abilities route, text and numerics
//from the assets slim), plus the Base stats and Per level panels. Upstream ability text is
//HTML with inline <svg>/<span>, so it is stripped to text rather than trusted into the DOM.
import { statLabel } from './statLabel';
import type { HeroAbility, HeroAbilityNumerics, HeroAbilityProperty, HeroAssetsResponse } from '../types/api';

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

export function plainText(html: string | null | undefined): string {
  return (html ?? '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#?\w+);/g, (m, e: string) => ENTITIES[e.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

function numeric(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : null;
}

function trimNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

//The client ships every property on every ability, most of them zeroed placeholders;
//a chip is only honest for a labelled property that carries a real value.
const CHIP_ORDER = ['cooldown', 'tech_damage', 'damage', 'duration', 'range', 'charge_cooldown'];

export interface StatChip {
  k: string;
  v: string;
}

export function statChips(properties: readonly HeroAbilityProperty[], max = 5): StatChip[] {
  const usable = properties.filter((p) => {
    const n = numeric(p.value);
    return p.label != null && p.label !== '' && n != null && n > 0;
  });
  const rank = (p: HeroAbilityProperty) => {
    const i = CHIP_ORDER.indexOf(p.kind ?? '');
    return i < 0 ? CHIP_ORDER.length : i;
  };
  return usable
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, max)
    .map((p) => {
      const raw = String(p.value ?? '');
      //Some values arrive unit-suffixed already ("1.3m") — pass those through rather
      //than re-parsing and re-appending, which would drop or double the unit.
      const v = /[a-z%]$/i.test(raw) ? raw : `${trimNumber(numeric(p.value) as number)}${p.unit ?? ''}`;
      return { k: p.label as string, v };
    });
}

export interface AbilityTierRow {
  label: string;
  ap: string;
  effect: string;
}

//Game constant: an ability point costs 1 / 2 / 5 AP at T1 / T2 / T3. Not served
//anywhere in the ability payload, so the column is rendered from the rule.
const TIER_AP = [1, 2, 5];

//Upstream serves only `signature` / `ultimate`. A signature ability with no cooldown
//is the kit's passive — the only signal the payload carries for the design's label.
function abilityTypeLabel(type: string, ability: HeroAbilityNumerics | undefined): string {
  if (type === 'ultimate') return 'Ultimate';
  if (type !== 'signature') return type ? statLabel(type) : '';
  const cooldown = (ability?.properties ?? []).find((p) => p.name === 'AbilityCooldown');
  return (numeric(cooldown?.value) ?? 0) > 0 ? 'Active' : 'Passive';
}

//Upgrade keys are the raw client property names ("AbilityCooldown"); upstream's own
//chip labels drop that prefix, and an all-caps acronym stays as it is ("DPS").
function upgradeLabel(name: string): string {
  return /^[A-Z0-9]+$/.test(name) ? name : statLabel(name.replace(/^Ability/, ''));
}

function tierRows(ability: HeroAbilityNumerics | undefined): AbilityTierRow[] {
  return (ability?.tiers ?? []).map((t) => {
    const described = plainText(t.description);
    const fromUpgrades = t.upgrades
      .map((u) => {
        const n = numeric(u.bonus);
        const raw = String(u.bonus ?? '');
        const shown = n == null ? raw : `${n > 0 ? '+' : ''}${trimNumber(n)}${/[a-z%]$/i.test(raw) ? raw.replace(/^[-+\d.]*/, '') : ''}`;
        return `${shown} ${upgradeLabel(u.name)}`.trim();
      })
      .join(' · ');
    const ap = TIER_AP[t.tier - 1];
    return { label: `T${t.tier}`, ap: ap == null ? '' : `${ap} AP`, effect: described || fromUpgrades };
  });
}

export interface AbilityCard {
  key: number;
  name: string;
  type: string;
  chips: StatChip[];
  description: string;
  tiers: AbilityTierRow[];
  iconUrl: string | null;
}

export type AbilityTextSource = 'abilities-route' | 'assets-localization' | 'none';

export interface KitAbilities {
  cards: AbilityCard[];
  textSource: AbilityTextSource;
}

/** The four signature slots, in slot order. Text prefers the abilities route, then the assets join. */
export function abilityCards(
  abilities: readonly HeroAbility[],
  assets: HeroAssetsResponse | null,
): KitAbilities {
  const numerics = new Map((assets?.abilities ?? []).map((a) => [a.slot, a]));
  const signature = abilities.filter((a) => a.slot.startsWith('signature')).sort((a, b) => a.order - b.order);
  let fromRoute = 0;
  let fromAssets = 0;

  const cards = signature.map((a, i) => {
    const spec = numerics.get(a.slot);
    const routeText = plainText(a.description?.desc);
    const assetText = plainText(spec?.description);
    if (routeText) fromRoute += 1;
    else if (assetText) fromAssets += 1;
    return {
      key: i + 1,
      name: a.name || plainText(spec?.name) || `Ability ${i + 1}`,
      type: abilityTypeLabel(a.ability_type ?? spec?.ability_type ?? '', spec),
      chips: statChips(spec?.properties ?? []),
      description: routeText || assetText,
      tiers: tierRows(spec),
      iconUrl: a.icon_url ?? spec?.icon_url ?? null,
    };
  });

  const textSource: AbilityTextSource =
    fromRoute > 0 ? 'abilities-route' : fromAssets > 0 ? 'assets-localization' : 'none';
  return { cards, textSource };
}

export interface StatRow {
  k: string;
  v: string;
}

//Curated, ordered subset of the client's starting_stats — the rest are scale factors
//(crit/proc/tech multipliers sitting at 1) that read as noise on a hero page. Each
//carries the design's short label and the unit the client value is measured in.
const BASE_STAT_KEYS = [
  { key: 'max_health', label: 'Max health', unit: '', signed: false },
  { key: 'base_health_regen', label: 'Health regen', unit: ' /s', signed: false, dp: 1 },
  { key: 'max_move_speed', label: 'Move speed', unit: ' m/s', signed: false, dp: 1 },
  { key: 'sprint_speed', label: 'Sprint speed', unit: ' m/s', signed: true, dp: 1 },
  { key: 'stamina', label: 'Stamina', unit: '', signed: false },
  { key: 'light_melee_damage', label: 'Light melee', unit: '', signed: false },
  { key: 'heavy_melee_damage', label: 'Heavy melee', unit: '', signed: false },
] as const;

export function baseStatRows(stats: Record<string, unknown> | null | undefined): StatRow[] {
  if (!stats) return [];
  return BASE_STAT_KEYS.flatMap((spec) => {
    const entry = stats[spec.key] as { value?: unknown } | number | undefined;
    const value = typeof entry === 'object' && entry != null ? entry.value : entry;
    const n = numeric(value);
    if (n == null) return [];
    const dp = 'dp' in spec ? (spec.dp as number) : null;
    const shown = dp == null ? trimNumber(n) : n.toFixed(dp);
    return [{ k: spec.label, v: `${spec.signed && n > 0 ? '+' : ''}${shown}${spec.unit}` }];
  });
}

//The design's Weapon panel. No served route carries a weapon baseline today
//(`starting_stats` has only the weapon_power multipliers), so this returns no rows and
//the panel renders its cold state; it fills itself the day the keys appear.
const WEAPON_STAT_KEYS = [
  { key: 'dps', label: 'DPS', unit: '' },
  { key: 'sustained_dps', label: 'Sustained DPS', unit: '' },
  { key: 'bullet_damage', label: 'Bullet damage', unit: '' },
  { key: 'rounds_per_second', label: 'Rounds per second', unit: '' },
  { key: 'clip_size', label: 'Clip', unit: '' },
  { key: 'reload_time', label: 'Reload', unit: 's' },
  { key: 'falloff_start', label: 'Falloff', unit: 'm' },
] as const;

export function weaponRows(stats: Record<string, unknown> | null | undefined): StatRow[] {
  if (!stats) return [];
  return WEAPON_STAT_KEYS.flatMap((spec) => {
    const entry = stats[spec.key] as { value?: unknown } | number | undefined;
    const value = typeof entry === 'object' && entry != null ? entry.value : entry;
    const n = numeric(value);
    return n == null ? [] : [{ k: spec.label, v: `${trimNumber(n)}${spec.unit}` }];
  });
}

//The design reads the scaling rows in this order; served keys outside it keep their
//payload order behind them.
const PER_LEVEL_ORDER = [
  'MODIFIER_VALUE_BASE_BULLET_DAMAGE_FROM_LEVEL',
  'MODIFIER_VALUE_BASE_HEALTH_FROM_LEVEL',
  'MODIFIER_VALUE_TECH_POWER',
  'MODIFIER_VALUE_BULLET_ARMOR_DAMAGE_RESIST',
  'MODIFIER_VALUE_TECH_RESIST',
];

const PER_LEVEL_LABELS: Record<string, string> = {
  MODIFIER_VALUE_BASE_HEALTH_FROM_LEVEL: 'Max health',
  MODIFIER_VALUE_TECH_POWER: 'Spirit power',
  MODIFIER_VALUE_BASE_BULLET_DAMAGE_FROM_LEVEL: 'Bullet damage',
  MODIFIER_VALUE_BASE_MELEE_DAMAGE_FROM_LEVEL: 'Melee damage',
  MODIFIER_VALUE_BOON_COUNT: 'Boons',
  MODIFIER_VALUE_TECH_RESIST: 'Spirit resist',
  MODIFIER_VALUE_BULLET_ARMOR_DAMAGE_RESIST: 'Bullet resist',
  MODIFIER_VALUE_BONUS_ATTACK_RANGE: 'Attack range',
};

export function perLevelRows(upgrades: unknown): StatRow[] {
  if (typeof upgrades !== 'object' || upgrades == null) return [];
  const rank = (key: string) => {
    const i = PER_LEVEL_ORDER.indexOf(key);
    return i < 0 ? PER_LEVEL_ORDER.length : i;
  };
  return Object.entries(upgrades as Record<string, unknown>)
    .filter(([, value]) => {
      const n = numeric(value);
      return n != null && n !== 0;
    })
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([key, value]) => ({
      k: PER_LEVEL_LABELS[key] ?? statLabel(key.replace(/^MODIFIER_VALUE_/, '')),
      v: `+${trimNumber(numeric(value) as number)}`,
    }));
}
