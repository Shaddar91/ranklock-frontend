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
  effect: string;
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
    return { label: `T${t.tier}`, effect: described || fromUpgrades };
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
      type: a.ability_type ?? spec?.ability_type ?? '',
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
//(crit/proc/tech multipliers sitting at 1) that read as noise on a hero page.
const BASE_STAT_KEYS = [
  'max_health',
  'base_health_regen',
  'max_move_speed',
  'sprint_speed',
  'stamina',
  'light_melee_damage',
  'heavy_melee_damage',
] as const;

export function baseStatRows(stats: Record<string, unknown> | null | undefined): StatRow[] {
  if (!stats) return [];
  return BASE_STAT_KEYS.flatMap((key) => {
    const entry = stats[key] as { value?: unknown; display_stat_name?: string } | number | undefined;
    const value = typeof entry === 'object' && entry != null ? entry.value : entry;
    const n = numeric(value);
    if (n == null) return [];
    const display = typeof entry === 'object' && entry != null ? entry.display_stat_name : undefined;
    return [{ k: statLabel(key, display), v: trimNumber(n) }];
  });
}

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
  return Object.entries(upgrades as Record<string, unknown>).flatMap(([key, value]) => {
    const n = numeric(value);
    if (n == null || n === 0) return [];
    return [{ k: PER_LEVEL_LABELS[key] ?? statLabel(key.replace(/^MODIFIER_VALUE_/, '')), v: `+${trimNumber(n)}` }];
  });
}
