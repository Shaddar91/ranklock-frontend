//The hero-play model: one pure transform from the served hero data plus an optional guide into
//the per-hero spine the /heroes/<slug>/guide/ page renders (builds, abilities, hard counters,
//items) and the role anchor nav. No fetch, no DOM — the caller passes what it loaded.
import { abilityOrderSequence, authorLabel } from './buildMeta';
import { statsThroughDate } from './dataHorizon';
import { toPct } from './narrative';
import type {
  DataHorizonResponse,
  HeroAbility,
  HeroCounterRow,
  HeroItemWinRate,
  HeroSummary,
  HeroSynergyRow,
  MatchupEntry,
  Patch,
  TrimmedBuild,
} from '../types/api';

export type HeroRole = 'support' | 'damage' | 'tank' | 'offensive' | 'jungle';

export const ROLE_LABEL: Record<HeroRole, string> = {
  support: 'Support',
  damage: 'Damage carry',
  tank: 'Tank',
  offensive: 'Offensive initiator',
  jungle: 'Jungler',
};

//The article rides with the token, never inferred from the first letter of the label.
export const ROLE_ARTICLE: Record<HeroRole, string> = {
  support: 'a',
  damage: 'a',
  tank: 'a',
  offensive: 'an',
  jungle: 'a',
};

export function roleHeadingText(hero: string, token: HeroRole): string {
  return `How to play ${hero} as ${ROLE_ARTICLE[token]} ${ROLE_LABEL[token]}`;
}

//The guide front matter this model reads; `hero` supplies the H2 text roleNav matches against.
export interface GuideMeta {
  hero: string;
  roles: HeroRole[];
  counters: string[];
  synergyItems: string[];
  buildIds: number[];
  patchLabel: string;
  sources: string[];
  draft: boolean;
  pubDate: Date;
  updatedDate?: Date | null;
}

//Structurally Astro's MarkdownHeading, redeclared so the model stays framework-free.
export interface GuideHeading {
  depth: number;
  slug: string;
  text: string;
}

export interface RoleNavEntry {
  token: HeroRole;
  label: string;
  anchor: string;
}

//`enemy` is the opponent's hero_id; `winRate` is this hero's win rate against it, in percent.
export interface HardCounter {
  enemy: number;
  matches: number;
  winRate: number;
}

export interface PlayItem {
  id: number;
  name: string;
  iconUrl: string | null;
  winRate: number;
  games: number;
  wilsonLower: number;
  cited: boolean;
}

//`/heroes/:id/builds` serves TrimmedBuild; the scored variant adds author_name.
export type PlayBuildRow = TrimmedBuild & { author_name?: string | null };

export interface PlayBuild {
  build: PlayBuildRow;
  /** The published name when §1.7 allows printing it, else null. */
  name: string | null;
  author: string;
  cited: boolean;
}

//C3 widens /heroes/:id/abilities with this object; absent on every response until it lands.
export interface AbilityDescription {
  desc?: string | null;
  t1_desc?: string | null;
  t2_desc?: string | null;
  t3_desc?: string | null;
}

export interface PlayAbility {
  id: number;
  name: string;
  slot: string;
  order: number;
  iconUrl: string | null;
  type: string | null;
  description: AbilityDescription | null;
}

export interface HeroPlayInput {
  hero: HeroSummary;
  abilities: HeroAbility[];
  builds: PlayBuildRow[];
  matchups: MatchupEntry[];
  counters: HeroCounterRow[];
  synergies: HeroSynergyRow[];
  items: HeroItemWinRate[];
  horizon: DataHorizonResponse | null;
  currentPatch: Patch | null;
  guide?: GuideMeta | null;
  headings?: GuideHeading[];
}

export interface HeroPlay {
  roleNav: RoleNavEntry[];
  rolesLine: string | null;
  builds: PlayBuild[];
  abilities: PlayAbility[];
  hardCounters: HardCounter[];
  items: PlayItem[];
  window: string | null;
}

const BUILDS_SHOWN = 3;
const COUNTERS_SHOWN = 5;
const ITEMS_SHOWN = 6;

const norm = (s: string): string => s.trim().toLowerCase();

function joinLabels(labels: string[]): string | null {
  const last = labels[labels.length - 1];
  if (last === undefined) return null;
  if (labels.length === 1) return last;
  return `${labels.slice(0, -1).join(', ')} and ${last}`;
}

/** Role tokens whose H2 exists in the rendered guide, anchored on that heading's own slug. */
export function roleNav(
  guide: GuideMeta | null | undefined,
  headings: GuideHeading[] | undefined,
): RoleNavEntry[] {
  if (!guide || !headings) return [];
  const out: RoleNavEntry[] = [];
  for (const token of guide.roles) {
    const want = norm(roleHeadingText(guide.hero, token));
    const heading = headings.find((h) => h.depth === 2 && norm(h.text) === want);
    if (heading) out.push({ token, label: ROLE_LABEL[token], anchor: heading.slug });
  }
  return out;
}

//One /matchups row per (opponent, bracket, game mode): merge before ranking, and recompute the
//win rate from the summed totals — averaging the served win_rate weights a 200-game bracket
//like a 500,000-game one (heroNarrative.ts:80-90).
function mergeMatchups(rows: MatchupEntry[]): Map<number, { matches: number; wins: number }> {
  const merged = new Map<number, { matches: number; wins: number }>();
  for (const m of rows) {
    if (m.matches <= 0) continue;
    const acc = merged.get(m.hero_b_id) ?? { matches: 0, wins: 0 };
    acc.matches += m.matches;
    acc.wins += m.hero_a_wins;
    merged.set(m.hero_b_id, acc);
  }
  return merged;
}

/** Minimum-sample floor for a matchup, over the MERGED per-opponent totals (heroNarrative.ts:87). */
export function counterFloor(rows: MatchupEntry[]): number {
  const totals = [...mergeMatchups(rows).values()].map((v) => v.matches);
  return Math.max(200, 0.02 * Math.max(...totals));
}

/** Qualified opponents ranked ascending by this hero's win rate — the worst matchups first. */
export function hardCounters(rows: MatchupEntry[], floor: number): HardCounter[] {
  return [...mergeMatchups(rows).entries()]
    .filter(([, v]) => v.matches >= floor)
    .map(([enemy, v]) => ({ enemy, matches: v.matches, winRate: (v.wins / v.matches) * 100 }))
    .sort((a, b) => a.winRate - b.winRate);
}

interface ScoredItem {
  id: number;
  name: string | null;
  iconUrl: string | null;
  winRate: number;
  games: number;
  wilsonLower: number;
}

function scoredItems(rows: HeroItemWinRate[]): ScoredItem[] {
  return rows.flatMap((r) => {
    const games = r.games ?? 0;
    const winRate = r.win_rate;
    const wilsonLower = r.wilson_lower;
    if (games <= 0 || winRate == null || wilsonLower == null) return [];
    return [
      {
        id: r.item_id,
        name: r.item_name?.trim() || null,
        iconUrl: r.icon_url ?? null,
        winRate: toPct(winRate),
        games,
        wilsonLower,
      },
    ];
  });
}

/** Minimum-sample floor for an item row (heroNarrative.ts:368). */
export function itemFloor(rows: HeroItemWinRate[]): number {
  return Math.max(200, 0.01 * Math.max(...scoredItems(rows).map((r) => r.games)));
}

/** Qualified items by Wilson lower bound (buildNarrative.ts:59), the guide's synergyItems hoisted first. */
export function itemsThatGoWell(
  rows: HeroItemWinRate[],
  guide: GuideMeta | null | undefined,
  floor: number,
): PlayItem[] {
  const named = new Set((guide?.synergyItems ?? []).map(norm).filter((s) => s !== ''));
  const qualified = scoredItems(rows)
    .filter((r) => r.games >= floor)
    .map((r) => ({
      id: r.id,
      name: r.name ?? `Item ${r.id}`,
      iconUrl: r.iconUrl,
      winRate: r.winRate,
      games: r.games,
      wilsonLower: r.wilsonLower,
      cited: r.name != null && named.has(norm(r.name)),
    }))
    .sort((a, b) => b.wilsonLower - a.wilsonLower);
  return [...qualified.filter((i) => i.cited), ...qualified.filter((i) => !i.cited)];
}

//§1.7 build-name gate: a streaming handle, a URL or an obscenity suppresses the name.
const BUILD_NAME_HANDLE = /\b[\w-]+\.(?:tv|gg|com)\b|\bttv\b|https?:\/\/|www\./i;
const BUILD_NAME_OBSCENE =
  /\b(?:fuck\w*|shit\w*|bitch\w*|cunt\w*|whore\w*|slut\w*|pussy\w*|nigg\w*|fag\w*|porn\w*|hentai\w*)\b|ебак|жоп|хуй|ху[ёе]|пизд|бляд|блят|мудак|сука/i;

/** True when a player-authored build name is plain enough to print on a page under ad review. */
export function printableBuildName(name: string): boolean {
  const n = name.trim();
  return n !== '' && !BUILD_NAME_HANDLE.test(n) && !BUILD_NAME_OBSCENE.test(n);
}

/** Served builds in weekly order, the ones the guide cites by hero_build_id hoisted first. */
export function orderBuilds(builds: PlayBuildRow[], guide: GuideMeta | null | undefined): PlayBuild[] {
  const cited = new Set(guide?.buildIds ?? []);
  const rows = builds.map((build) => ({
    build,
    name: printableBuildName(build.name) ? build.name : null,
    author: authorLabel(build),
    cited: cited.has(build.hero_build_id),
  }));
  return [...rows.filter((b) => b.cited), ...rows.filter((b) => !b.cited)];
}

const abilityDescription = (a: HeroAbility): AbilityDescription | null => {
  const d = (a as { description?: unknown }).description;
  return d != null && typeof d === 'object' ? (d as AbilityDescription) : null;
};

/** A served ability name that prints: non-empty and not a raw citadel_ engine token. */
export function printableAbilityName(name: string): boolean {
  const n = name.trim();
  return n !== '' && !n.startsWith('citadel_');
}

/** Every served ability, the levelled ones in learn order first, the rest in served slot order. */
export function abilityTrack(abilities: HeroAbility[], abilityOrder: unknown): PlayAbility[] {
  const rank = new Map(abilityOrderSequence(abilityOrder).map((id, i) => [id, i]));
  const at = (a: HeroAbility): number => rank.get(a.ability_id) ?? Number.MAX_SAFE_INTEGER;
  return [...abilities]
    .filter((a) => printableAbilityName(a.name))
    .sort((a, b) => at(a) - at(b) || a.order - b.order)
    .map((a) => ({
      id: a.ability_id,
      name: a.name,
      slot: a.slot,
      order: a.order,
      iconUrl: a.icon_url ?? null,
      type: a.ability_type ?? null,
      description: abilityDescription(a),
    }));
}

/** The provenance line every served number is labelled with ([slug].astro:134,:139). */
export function windowLabel(
  horizon: DataHorizonResponse | null | undefined,
  currentPatch: Patch | null | undefined,
): string | null {
  const through = statsThroughDate(horizon);
  const patch = currentPatch?.version_label?.trim() || null;
  if (through && patch) return `Numbers through ${through} · ${patch} patch`;
  if (through) return `Numbers through ${through}`;
  return patch ? `${patch} patch` : null;
}

/** The whole model: one spine for every hero, plus the role nav a guide adds on top. */
export function buildHeroPlay(input: HeroPlayInput): HeroPlay {
  const guide = input.guide ?? null;
  const matchups = input.matchups.filter((m) => m.hero_b_id !== input.hero.hero_id);
  const builds = orderBuilds(input.builds, guide).slice(0, BUILDS_SHOWN);
  return {
    roleNav: roleNav(guide, input.headings),
    rolesLine: guide ? joinLabels(guide.roles.map((t) => ROLE_LABEL[t])) : null,
    builds,
    abilities: abilityTrack(input.abilities, builds[0]?.build.ability_order),
    hardCounters: hardCounters(matchups, counterFloor(matchups)).slice(0, COUNTERS_SHOWN),
    items: itemsThatGoWell(input.items, guide, itemFloor(input.items)).slice(0, ITEMS_SHOWN),
    window: windowLabel(input.horizon, input.currentPatch),
  };
}
