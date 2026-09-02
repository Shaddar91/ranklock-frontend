//Per-hero build-page prose, derived from that hero's own item sets, buy order,
//community builds and matchup residuals so no two pages share a sentence shape.
//Pure: stats in, Section[] out, rendered by Narrative.astro.
import { count, fixed, pct } from './format';
import { joinSegs, link, ordinal, rankDesc, toPct, type Para, type Section, type Seg } from './narrative';
import { heroPath } from './heroSlugs';
import type {
  BuildStatsBuyOrderRow,
  BuildStatsItem,
  BuildStatsItemSet,
  HeroItemWinRate,
  HeroSummary,
  MatchupEntry,
  ScoredBuild,
} from '../types/api';

export interface SetItem extends BuildStatsItem {
  //An ability taken twice inside one six-slot set is one row with n=2, never two rows.
  n: number;
}

export interface BuyPosition {
  pos: number;
  rows: BuildStatsBuyOrderRow[];
}

export interface BuildNarrativeInput {
  hero: HeroSummary;
  roster: HeroSummary[];
  itemSets: BuildStatsItemSet[];
  buyOrder: BuildStatsBuyOrderRow[];
  itemWinRates: HeroItemWinRate[];
  builds: ScoredBuild[];
  //Already summed across badge buckets 1-5 by sumMatchupBrackets.
  matchups: MatchupEntry[];
  heroName: (id: number) => string;
}

export const itemName = (it: { item_id: number; item_name?: string | null }): string =>
  it.item_name ?? `Item ${it.item_id}`;

export function dedupeSetItems(items: BuildStatsItem[]): SetItem[] {
  const out: SetItem[] = [];
  for (const it of items) {
    const seen = out.find((o) => o.item_id === it.item_id);
    if (seen) seen.n += 1;
    else out.push({ ...it, n: 1 });
  }
  return out;
}

export const setLabel = (items: BuildStatsItem[]): string =>
  dedupeSetItems(items)
    .map((i) => (i.n > 1 ? `${itemName(i)} x${i.n}` : itemName(i)))
    .join(', ');

/** Sets with games, ordered by Wilson lower bound — the honest order at a 200-to-5,900 game spread. */
export const rankedSets = (sets: BuildStatsItemSet[]): BuildStatsItemSet[] =>
  [...sets].filter((s) => s.games > 0).sort((a, b) => b.wilson_lower - a.wilson_lower);

//"an 8.1x" / "an 11.3x" / "a 29.6x" — the leading digit decides, not the letter.
const article = (n: string): string => (/^(8|11|18)/.test(n) ? 'an' : 'a');

/** Total buys and buy-weighted win rate per item across every slot it appears at. */
export function itemTotals(rows: BuildStatsBuyOrderRow[]): Map<number, { buys: number; winRate: number }> {
  const acc = new Map<number, { buys: number; wins: number }>();
  for (const r of rows) {
    const c = acc.get(r.item_id) ?? { buys: 0, wins: 0 };
    c.buys += r.games;
    c.wins += r.wins;
    acc.set(r.item_id, c);
  }
  return new Map(
    [...acc].map(([id, c]) => [id, { buys: c.buys, winRate: c.buys > 0 ? (c.wins / c.buys) * 100 : 0 }]),
  );
}

export function buyOrderByPos(rows: BuildStatsBuyOrderRow[]): BuyPosition[] {
  const byPos = new Map<number, BuildStatsBuyOrderRow[]>();
  for (const r of rows) {
    const list = byPos.get(r.pos) ?? [];
    list.push(r);
    byPos.set(r.pos, list);
  }
  return [...byPos.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([pos, list]) => ({ pos, rows: [...list].sort((a, b) => b.wilson_lower - a.wilson_lower) }));
}

//Bracket 0 returns one row per match_mode with no way to pin which is which, so the
//only unambiguous read is badge buckets 1-5 summed (spec §1.8). A self-matchup row
//ships on three heroes and is dropped.
export function sumMatchupBrackets(perBracket: MatchupEntry[][], heroId: number): MatchupEntry[] {
  const acc = new Map<number, { matches: number; wins: number }>();
  for (const rows of perBracket) {
    for (const r of rows) {
      if (r.hero_b_id === heroId) continue;
      const c = acc.get(r.hero_b_id) ?? { matches: 0, wins: 0 };
      c.matches += r.matches;
      c.wins += r.hero_a_wins;
      acc.set(r.hero_b_id, c);
    }
  }
  return [...acc.entries()].map(([hero_b_id, c]) => ({
    hero_b_id,
    matches: c.matches,
    hero_a_wins: c.wins,
    win_rate: c.matches > 0 ? c.wins / c.matches : 0,
  }));
}

const heroSeg = (roster: HeroSummary[], id: number, text: string): Seg => {
  const h = roster.find((r) => r.hero_id === id);
  return h ? link(text, heroPath(h.hero_name)) : text;
};
const itemHref = (id: number) => `/items/${id}/`;
const itemSeg = (it: { item_id: number; item_name?: string | null }): Seg => link(itemName(it), itemHref(it.item_id));

const setItemSegs = (i: SetItem): Seg[] => (i.n > 1 ? [itemSeg(i), ` x${i.n}`] : [itemSeg(i)]);

function opening(input: BuildNarrativeInput): Section | null {
  const { hero, roster } = input;
  if (hero.win_rate == null || hero.picks <= 0) return null;
  const name = hero.hero_name;
  const rated = roster.filter((h) => h.win_rate != null && h.picks > 0);
  if (rated.length < 2) return null;
  const wrRank = rankDesc(
    rated.map((h) => h.win_rate as number),
    hero.win_rate,
  );
  const totalPicks = rated.reduce((s, h) => s + h.picks, 0);
  const share = (hero.picks / totalPicks) * 100;
  const sets = rankedSets(input.itemSets);
  const p1: Para = [
    `${name} wins ${pct(hero.win_rate)} of its ranked games, ${ordinal(wrRank)} of ${rated.length} heroes, on ${pct(share)} of hero slots. `,
  ];
  if (sets.length === 0) {
    p1.push(
      `RankLock has not folded a finished ${name} set past the game floor yet, so what follows is per-item rather than per-build.`,
    );
    return { heading: `What wins on ${name}`, paras: [p1] };
  }
  const top = sets[0] as BuildStatsItemSet;
  const topWr = toPct(top.win_rate);
  const lift = topWr - (hero.win_rate as number);
  p1.push(`Its strongest measured six-slot set is `, ...joinSegs(dedupeSetItems(top.items).map(setItemSegs)), `. `);
  p1.push(`That set won ${pct(topWr)} of ${count(top.games)} games.`);

  const p2: Para = [];
  if (lift >= 0.5)
    p2.push(
      `It sits ${fixed(lift, 1)} points above ${name}'s own ${pct(hero.win_rate)} baseline, so the items are adding something the hero does not bring by itself. `,
    );
  else if (lift <= -0.5)
    p2.push(
      `It sits ${fixed(-lift, 1)} points below ${name}'s own ${pct(hero.win_rate)} baseline, so ${name} is carrying its common builds rather than the other way round. `,
    );
  else
    p2.push(
      `It lands within half a point of ${name}'s own ${pct(hero.win_rate)} baseline, so on this hero the item set moves the result less than the draft does. `,
    );
  const games = sets.map((s) => s.games);
  const lo = Math.min(...games);
  const hi = Math.max(...games);
  p2.push(
    `${sets.length} ${name} set${sets.length === 1 ? '' : 's'} cleared the floor, from ${count(lo)} games up to ${count(hi)}`,
  );
  const mult = fixed(hi / lo, 1);
  p2.push(
    hi >= 2 * lo
      ? `, ${article(mult)} ${mult}x spread, which is why the table below is ordered by Wilson lower bound and not by raw win rate.`
      : `, a narrow enough spread that the Wilson ordering below barely differs from the raw one.`,
  );
  return { heading: `What wins on ${name}`, paras: [p1, p2] };
}


function coreItems(input: BuildNarrativeInput): Section | null {
  const sets = rankedSets(input.itemSets);
  if (sets.length < 2) return null;
  const freq = new Map<number, { item: BuildStatsItem; sets: number }>();
  for (const s of sets) {
    for (const it of dedupeSetItems(s.items)) {
      const e = freq.get(it.item_id) ?? { item: it, sets: 0 };
      e.sets += 1;
      freq.set(it.item_id, e);
    }
  }
  const core = [...freq.values()].sort((a, b) => b.sets - a.sets).slice(0, 3).filter((r) => r.sets >= 2);
  if (core.length === 0) return null;
  const name = input.hero.hero_name;
  //Abilities carry no /item-win-rates row (27 of 38 heroes have none of their top three there),
  //so the per-item figure comes from buy_order: the same fold and window as the sets.
  const totals = itemTotals(input.buyOrder);
  const seg = (r: { item: BuildStatsItem; sets: number }): Seg[] => {
    const t = totals.get(r.item.item_id);
    return [
      itemSeg(r.item),
      t
        ? ` (${r.sets} of ${sets.length} sets, ${pct(t.winRate)} across ${count(t.buys)} buys)`
        : ` (${r.sets} of ${sets.length} sets)`,
    ];
  };
  const p: Para = [`The items ${name} keeps buying are `, ...joinSegs(core.map(seg)), `. `];

  const withTotals = core
    .map((r) => ({ r, t: totals.get(r.item.item_id) }))
    .filter((x): x is { r: { item: BuildStatsItem; sets: number }; t: { buys: number; winRate: number } } => x.t != null);
  const mostCommon = core[0] as { item: BuildStatsItem; sets: number };
  const bestOfCore = [...withTotals].sort((a, b) => b.t.winRate - a.t.winRate)[0];
  if (bestOfCore && bestOfCore.r.item.item_id !== mostCommon.item.item_id) {
    p.push(
      `The most bought of them is not the best of them: `,
      itemSeg(mostCommon.item),
      ` appears in the most sets, while `,
      itemSeg(bestOfCore.r.item),
      ` carries the higher win rate at ${pct(bestOfCore.t.winRate)}. `,
    );
  } else if (bestOfCore) {
    p.push(
      itemSeg(mostCommon.item),
      ` is both the most common of the three and the highest-winning, at ${pct(bestOfCore.t.winRate)}. `,
    );
  }
  const wrRows = input.itemWinRates.filter((r) => r.win_rate != null && (r.games ?? 0) > 0);

  const inSets = new Set(freq.keys());
  const maxGames = Math.max(...wrRows.map((r) => r.games as number), 0);
  const floor = Math.max(200, 0.01 * maxGames);
  const outside = wrRows
    .filter((r) => !inSets.has(r.item_id) && (r.games as number) >= floor)
    .sort((a, b) => toPct(b.win_rate as number) - toPct(a.win_rate as number))[0];
  if (outside) {
    p.push(
      `Widening to every ${name} game rather than the finished sets, the highest-winning item that reaches none of them is `,
      itemSeg(outside),
      ` at ${pct(toPct(outside.win_rate as number))} over ${count(outside.games)} games: the underused buy on this hero.`,
    );
  }
  return { heading: `${name}'s core items`, paras: [p] };
}

function buyOrder(input: BuildNarrativeInput): Section | null {
  const positions = buyOrderByPos(input.buyOrder);
  const first3 = positions.slice(0, 3);
  if (first3.length < 3) return null;
  const name = input.hero.hero_name;
  const leadOf = (p: BuyPosition) => p.rows[0] as BuildStatsBuyOrderRow;
  const seg = (p: BuyPosition): Seg[] => {
    const r = leadOf(p);
    return [itemSeg(r), ` at slot ${p.pos} (${pct(toPct(r.win_rate))} over ${count(r.games)} games)`];
  };
  const p: Para = [
    `Ordered by Wilson lower bound at each slot, ${name} opens with `,
    ...joinSegs(first3.map(seg)),
    `. `,
  ];
  const one = first3[0] as BuyPosition;
  const lead = leadOf(one);
  const runner = one.rows[1];
  if (!runner) {
    p.push(
      `Slot 1 is settled: `,
      itemSeg(lead),
      ` is the only first buy RankLock has enough ${name} games for, so there is nothing to weigh it against.`,
    );
  } else {
    const gap = toPct(lead.win_rate) - toPct(runner.win_rate);
    if (Math.abs(gap) < 1) {
      p.push(
        `Slot 1 is contested: `,
        itemSeg(runner),
        ` wins ${pct(toPct(runner.win_rate))} over ${count(runner.games)} games against ${pct(toPct(lead.win_rate))} over ${count(lead.games)}, ${fixed(Math.abs(gap), 1)} points apart, which is inside the noise at these counts.`,
      );
    } else {
      p.push(
        `Slot 1 is not close: `,
        itemSeg(lead),
        ` beats `,
        itemSeg(runner),
        ` by ${fixed(Math.abs(gap), 1)} points over ${count(lead.games)} and ${count(runner.games)} games.`,
      );
    }
  }
  return { heading: 'What gets bought first', paras: [p] };
}

function community(input: BuildNarrativeInput): Section | null {
  const builds = input.builds;
  if (builds.length === 0) return null;
  const name = input.hero.hero_name;
  const top = builds[0] as ScoredBuild;
  const author = top.author_name?.trim() || `Account ${top.author_account_id}`;
  const p: Para = [];
  if (builds.length === 1) {
    p.push(
      `One published ${name} build reaches RankLock's list: "${top.name}" by ${author}. With a single entry there is no trending order to read, only that build against the measured numbers above. `,
    );
  } else {
    const named = builds.filter((b) => b.author_name?.trim()).length;
    p.push(
      `${builds.length} published ${name} builds reach RankLock's list, ordered by weekly favorites. "${top.name}" by ${author} leads them`,
      top.num_weekly_favorites != null ? ` on ${count(top.num_weekly_favorites)} weekly favorites. ` : `. `,
    );
    if (named < builds.length) {
      p.push(
        `${builds.length - named} of the ${builds.length} publish no display name upstream and are credited by account id. `,
      );
    }
  }
  const bestSet = rankedSets(input.itemSets)[0];
  if (bestSet) {
    const setIds = new Set(dedupeSetItems(bestSet.items).map((i) => i.item_id));
    const buildIds = new Set(
      top.categories.flatMap((c) => c.items.map((i) => i.item_id)).filter((id): id is number => id != null),
    );
    const overlap = [...setIds].filter((id) => buildIds.has(id));
    if (overlap.length === 0) {
      p.push(
        `It shares no item with the measured best set above, so the published build and the winning one are different builds on this hero.`,
      );
    } else if (overlap.length === setIds.size) {
      p.push(`It carries every item from the measured best set above.`);
    } else {
      const names = overlap
        .map((id) => dedupeSetItems(bestSet.items).find((i) => i.item_id === id))
        .filter((i): i is SetItem => i != null);
      p.push(
        `It shares ${overlap.length} of the ${setIds.size} items in the measured best set above: `,
        ...joinSegs(names.map((i) => [itemSeg(i)])),
        `.`,
      );
    }
  }
  const paras: Para[] = [p];
  //The label is the backend's own sentence and ships unedited, so it stands alone rather
  //than being spliced into ours (spec §7 G1: never re-labelled as the build's win rate).
  if (top.score) paras.push([`RankLock's score for it: ${top.score.label}`]);
  return { heading: 'What the community publishes', paras };
}

function matchupEdge(input: BuildNarrativeInput): Section | null {
  const { hero, roster, heroName } = input;
  if (hero.win_rate == null) return null;
  const rows = input.matchups.filter((m) => m.matches > 0);
  if (rows.length === 0) return null;
  const maxMatches = Math.max(...rows.map((m) => m.matches));
  const min = Math.max(200, 0.02 * maxMatches);
  const wrById = new Map(roster.filter((h) => h.win_rate != null).map((h) => [h.hero_id, h.win_rate as number]));
  const qualified = rows
    .filter((m) => m.matches >= min && wrById.has(m.hero_b_id))
    .map((m) => {
      const actual = toPct(m.win_rate);
      const expected = 50 + (hero.win_rate as number) - (wrById.get(m.hero_b_id) as number);
      return { id: m.hero_b_id, actual, expected, residual: actual - expected, matches: m.matches };
    })
    .sort((a, b) => b.residual - a.residual);
  if (qualified.length < 3) return null;
  const name = hero.hero_name;
  type Row = (typeof qualified)[number];
  const over = qualified.slice(0, 2);
  const under = qualified[qualified.length - 1] as Row;
  const seg = (r: Row): Seg[] => [
    heroSeg(roster, r.id, heroName(r.id)),
    ` (${pct(r.actual)} against the ${pct(r.expected)} the two heroes' overall win rates predict)`,
  ];
  const p1: Para = [
    `Against the head-to-head its own win rate predicts, ${name} does best into `,
    ...joinSegs(over.map(seg)),
    `. `,
    `Its worst return is into `,
    heroSeg(roster, under.id, heroName(under.id)),
    `, ${pct(under.actual)} where ${pct(under.expected)} was predicted. `,
  ];
  const first = over[0] as Row;
  const biggest = Math.max(Math.abs(first.residual), Math.abs(under.residual));
  p1.push(
    `Those are residuals of ${fixed(Math.abs(first.residual), 1)} and ${fixed(Math.abs(under.residual), 1)} points. `,
    biggest < 2.5
      ? `Neither is large enough to call a counter-pick; they are the lanes where the build has slightly more or less room than the two heroes' ratings alone suggest.`
      : `The larger of the two is ${fixed(biggest, 1)} points clear of prediction, which is past what the ratings explain on their own.`,
  );

  const byActual = [...qualified].sort((a, b) => b.actual - a.actual);
  const bestRow = byActual[0] as Row;
  const worstRow = byActual[byActual.length - 1] as Row;
  const spread = bestRow.actual - worstRow.actual;
  const spreadText =
    spread >= 10
      ? `Across ${qualified.length} qualified opponents the raw spread is ${fixed(spread, 1)} points, so who ${name} faces matters more than what it buys.`
      : spread < 5
        ? `Across ${qualified.length} qualified opponents the raw spread is only ${fixed(spread, 1)} points, so the item choices below matter more than the matchup does.`
        : `Across ${qualified.length} qualified opponents the raw spread is ${fixed(spread, 1)} points, enough to shade a buy without changing the build.`;
  const p2: Para = [
    spreadText,
    ` Predicted means 50% plus ${name}'s overall win rate minus the opponent's, an arithmetic baseline rather than a model; the `,
    link('methodology', '/methodology/'),
    ` page defines every number on this page.`,
  ];
  return { heading: 'Where the matchup gives room', paras: [p1, p2] };
}

export function buildNarrative(input: BuildNarrativeInput): Section[] {
  return [opening(input), coreItems(input), buyOrder(input), community(input), matchupEdge(input)].filter(
    (s): s is Section => s != null,
  );
}
