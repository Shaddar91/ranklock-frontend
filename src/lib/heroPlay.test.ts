//Rules of the hero-play model: the role anchors come off the rendered heading, matchups merge
//before they rank, both minimum-sample floors are inclusive, and the guide's own picks lead.
import { expect, it } from 'vitest';
import {
  abilityTrack,
  buildHeroPlay,
  counterFloor,
  hardCounters,
  itemFloor,
  itemsThatGoWell,
  orderBuilds,
  roleHeadingText,
  roleNav,
  type GuideHeading,
  type GuideMeta,
  type HeroPlayInput,
  type PlayBuildRow,
} from './heroPlay';
import type { HeroAbility, HeroItemWinRate, HeroSummary, MatchupEntry, Patch } from '../types/api';

const hero = (hero_id: number, hero_name: string): HeroSummary => ({
  hero_id, hero_name, icon_url: null, picks: 120000, win_rate: 51, avg_kills: 7, avg_deaths: 6,
  avg_assists: 9, avg_net_worth: 40000, avg_duration_s: 2100,
});
const matchup = (hero_b_id: number, matches: number, hero_a_wins: number): MatchupEntry =>
  ({ hero_b_id, matches, hero_a_wins, win_rate: hero_a_wins / matches });
const ability = (ability_id: number, name: string, order: number, description?: HeroAbility['description']): HeroAbility =>
  ({ ability_id, class_name: `ability_${ability_id}`, slot: `signature${order}`, order, name, ability_type: 'signature', description });
const build = (hero_build_id: number, author_name?: string, ability_order?: unknown): PlayBuildRow => ({
  hero_id: 4, hero_build_id, name: `Build ${hero_build_id}`, author_account_id: 400 + hero_build_id,
  version: 1, num_favorites: 40, num_weekly_favorites: 9, last_updated_timestamp: 1756000000,
  author_name, ability_order, categories: [],
});
const item = (item_id: number, item_name: string, games: number, wilson_lower: number, win_rate = 0.55): HeroItemWinRate =>
  ({ item_id, item_name, icon_url: null, win_rate, games, wins: Math.round(games * win_rate), wilson_lower });
//The wire shape of ability_order: one currency_changes entry per level-up, so ids repeat.
const levelUps = (ids: number[]): unknown => ({
  currency_changes: ids.map((ability_id, i) => ({ ability_id, annotation: '', currency_type: 1, delta: i + 1 })),
});

const patch: Patch = {
  patch_id: 'p-1-2', version_label: '1.2', released_at: '2026-08-20T00:00:00Z', ended_at: null,
  notes_url: null, notes_summary: null, is_current: true,
};
const guide = (over: Partial<GuideMeta> = {}): GuideMeta => ({
  hero: 'Haze', roles: ['damage'], counters: [], synergyItems: [], buildIds: [], patchLabel: '1.2',
  sources: [], draft: false, pubDate: new Date('2026-08-01T00:00:00Z'), updatedDate: null, ...over,
});

const ABILITIES = [
  ability(70, 'Sleep Dagger', 1, { desc: '<span>Puts an enemy to sleep.</span>' }),
  ability(71, 'Smoke Bomb', 2),
  ability(72, 'Fixation', 3),
  ability(73, 'Bullet Dance', 4),
];
const ITEMS = [item(10, 'Boundless Spirit', 60000, 0.61, 0.63), item(11, 'Extra Health', 40000, 0.58)];
const MATCHUPS = [matchup(20, 1000, 400), matchup(21, 900, 470), matchup(4, 800, 500)];

const input = (over: Partial<HeroPlayInput> = {}): HeroPlayInput => ({
  hero: hero(4, 'Haze'),
  abilities: ABILITIES,
  builds: [build(501), build(502)],
  matchups: MATCHUPS,
  counters: [],
  synergies: [],
  items: ITEMS,
  horizon: { max_match_start_time: '2026-08-23T00:00:00Z', datasets: [] },
  currentPatch: patch,
  ...over,
});

it('leaves a guide-less hero without a role nav or a roles line, and still serves the spine', () => {
  const play = buildHeroPlay(input());
  expect(play.roleNav).toEqual([]);
  expect(play.rolesLine).toBeNull();
  expect(play.builds.map((b) => b.build.hero_build_id)).toEqual([501, 502]);
  expect(play.abilities.map((a) => a.name)).toEqual(['Sleep Dagger', 'Smoke Bomb', 'Fixation', 'Bullet Dance']);
  expect(play.hardCounters.map((c) => c.enemy)).toEqual([20, 21]);
  expect(play.items.map((i) => i.id)).toEqual([10, 11]);
  expect(play.window).toContain('1.2 patch');
});

it('drops a role nav entry when the guide has no rendered headings to anchor on', () => {
  expect(roleNav(guide(), undefined)).toEqual([]);
  expect(roleNav(null, [{ depth: 2, slug: 'how-to-play-haze-as-a-damage-carry', text: 'How to play Haze as a Damage carry' }])).toEqual([]);
});

it('anchors a role on the rendered heading slug, never on a slug recomputed from the hero', () => {
  const headings: GuideHeading[] = [
    { depth: 3, slug: 'decoy-wrong-depth', text: 'How to play Mo & Krill as a Tank' },
    { depth: 2, slug: 'how-to-play-mo--krill-as-a-tank', text: 'How to play Mo & Krill as a Tank' },
  ];
  const nav = roleNav(guide({ hero: 'Mo & Krill', roles: ['tank', 'support'] }), headings);
  expect(nav).toEqual([{ token: 'tank', label: 'Tank', anchor: 'how-to-play-mo--krill-as-a-tank' }]);
  expect(nav[0]?.anchor).not.toBe('how-to-play-mo-krill-as-a-tank');
  expect(roleHeadingText('Mo & Krill', 'offensive')).toBe('How to play Mo & Krill as an Offensive initiator');
});

it('names every declared role in the roles line', () => {
  const play = buildHeroPlay(input({ guide: guide({ roles: ['tank', 'support', 'jungle'] }) }));
  expect(play.rolesLine).toBe('Tank, Support and Jungler');
});

it('merges the matchup rows per opponent before ranking and recomputes the win rate', () => {
  const rows = [
    matchup(20, 1000, 400), matchup(20, 100, 90),
    matchup(21, 600, 300), matchup(21, 400, 200),
    matchup(22, 500, 200), matchup(22, 500, 210),
  ];
  const ranked = hardCounters(rows, counterFloor(rows));
  expect(ranked.map((c) => c.enemy)).toEqual([22, 20, 21]);
  expect(ranked.map((c) => c.matches)).toEqual([1000, 1100, 1000]);
  const merged = ranked[1];
  expect(merged?.winRate).toBeCloseTo(44.5455, 3);
  //averaging the two served win_rate values would read 65% off the same rows
  expect(merged?.winRate).not.toBeCloseTo(65, 1);
  for (let i = 1; i < ranked.length; i += 1) {
    expect(ranked[i]?.winRate).toBeGreaterThan(ranked[i - 1]?.winRate as number);
  }
});

it('drops a matchup under the merged-sample floor and keeps one exactly on it', () => {
  const rows = [
    matchup(30, 30000, 15000), matchup(30, 20000, 10000),
    matchup(31, 500, 250), matchup(31, 500, 260),
    matchup(32, 500, 250), matchup(32, 499, 240),
  ];
  expect(counterFloor(rows)).toBe(1000);
  expect(hardCounters(rows, counterFloor(rows)).map((c) => c.enemy)).toEqual([30, 31]);
  expect(counterFloor([matchup(30, 5000, 2500)])).toBe(200);
});

it('drops an item under the games floor, keeps one exactly on it, and ranks by wilson_lower', () => {
  const rows = [
    item(10, 'Boundless Spirit', 50000, 0.61, 0.63),
    item(11, 'Extra Health', 500, 0.58),
    item(12, 'Mystic Burst', 499, 0.99),
    item(13, 'Headshot Booster', 2000, 0.6),
  ];
  expect(itemFloor(rows)).toBe(500);
  const ranked = itemsThatGoWell(rows, null, itemFloor(rows));
  expect(ranked.map((i) => i.id)).toEqual([10, 13, 11]);
  expect(ranked[0]?.winRate).toBeCloseTo(63, 6);
  expect(ranked.some((i) => i.cited)).toBe(false);
  expect(itemFloor([item(10, 'Boundless Spirit', 5000, 0.61)])).toBe(200);
});

it('hoists the guide synergy items, then orders by wilson_lower, capped at six', () => {
  const names = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'];
  const rows = names.map((name, i) => item(40 + i, name, 1000, 0.9 - i * 0.05));
  const cited = guide({ synergyItems: ['Golf', 'hotel'] });
  expect(itemsThatGoWell(rows, cited, itemFloor(rows)).map((i) => i.id)).toEqual([46, 47, 40, 41, 42, 43, 44, 45]);
  const play = buildHeroPlay(input({ items: rows, guide: cited }));
  expect(play.items.map((i) => i.id)).toEqual([46, 47, 40, 41, 42, 43]);
  expect(play.items.filter((i) => i.cited).map((i) => i.name)).toEqual(['Golf', 'Hotel']);
});

it('hoists the guide-cited builds, then keeps the served weekly order, capped at three', () => {
  const builds = [build(501), build(502), build(503), build(504, 'Retchid'), build(505)];
  const cited = guide({ buildIds: [504] });
  expect(orderBuilds(builds, cited).map((b) => b.build.hero_build_id)).toEqual([504, 501, 502, 503, 505]);
  const play = buildHeroPlay(input({ builds, guide: cited }));
  expect(play.builds.map((b) => b.build.hero_build_id)).toEqual([504, 501, 502]);
  expect(play.builds.map((b) => b.cited)).toEqual([true, false, false]);
  expect(play.builds.map((b) => b.author)).toEqual(['Retchid', 'Steam account 901', 'Steam account 902']);
});

it('orders abilities by the de-duplicated level order in the real ability_order object', () => {
  const track = abilityTrack(ABILITIES, levelUps([72, 70, 72, 73, 70, 72]));
  expect(track.map((a) => a.id)).toEqual([72, 70, 73, 71]);
  expect(track.find((a) => a.id === 70)?.description?.desc).toBe('<span>Puts an enemy to sleep.</span>');
  expect(track.find((a) => a.id === 71)?.description).toBeNull();
  const play = buildHeroPlay(input({ builds: [build(501, undefined, levelUps([72, 70, 72, 73])), build(502)] }));
  expect(play.abilities.map((a) => a.id)).toEqual([72, 70, 73, 71]);
});

it('falls back to the served slot order when ability_order is empty or absent', () => {
  expect(abilityTrack(ABILITIES, {}).map((a) => a.id)).toEqual([70, 71, 72, 73]);
  expect(abilityTrack(ABILITIES, undefined).map((a) => a.id)).toEqual([70, 71, 72, 73]);
  expect(abilityTrack(ABILITIES, levelUps([])).map((a) => a.id)).toEqual([70, 71, 72, 73]);
  expect(abilityTrack([], undefined)).toEqual([]);
});
