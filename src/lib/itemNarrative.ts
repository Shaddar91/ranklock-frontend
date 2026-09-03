//Per-item prose for the prerendered item pages, generated from that item's own rows:
//the buy window and how it moves up the ladder, its standing against every other item
//and its tier peers, the win-rate curve by badge tier, and which heroes actually build it.
import { count, duration, fixed, pct } from './format';
import {
  BADGE_TIER_LABELS,
  joinSegs,
  link,
  mean,
  ordinal,
  rankDesc,
  toPct,
  type Para,
  type Section,
  type Seg,
} from './narrative';
import { heroPath } from './heroSlugs';

export interface ItemFacts {
  item_id: number;
  name: string;
  cost: number | null;
  tier: number | null;
  slot: string | null;
  active: boolean | null;
  win_rate: number | null;
  matches: number | null;
  players: number | null;
  avg_buy_time_s: number | null;
  avg_buy_time_relative: number | null;
  avg_sell_time_s: number | null;
  avg_sell_time_relative: number | null;
}

export interface ItemPeer {
  item_id: number;
  name: string;
  win_rate: number | null;
  matches: number | null;
  avg_buy_time_s?: number | null;
  active?: boolean | null;
}

export interface ItemHeroRow {
  hero_id: number;
  name: string;
  games: number;
  win_rate: number;
  //That hero's own game count in the same upstream item feed, so a share is a share of
  //comparable games; absent falls the section back to the item's own game split.
  hero_games?: number | null;
}

//One /items/stats?bracket=N row, with the rank the caller measured inside that bracket.
export interface ItemBracketRow {
  bracket: number;
  win_rate: number | null;
  matches: number | null;
  avg_buy_time_s: number | null;
  rank: number | null;
  of: number | null;
}

export interface ItemNarrativeInput {
  item: ItemFacts;
  all: { item_id: number; win_rate: number | null; matches: number | null }[];
  peers: ItemPeer[];
  heroes: ItemHeroRow[];
  brackets?: ItemBracketRow[];
}

//Tier 5 and cost 9999 are the upstream sentinels for unreleased/test entries, the same
//pair src/pages/items/[id].astro hides its tier and cost chips on.
const shopTier = (t: number | null): number | null => (t != null && t >= 1 && t <= 4 ? t : null);
const shopCost = (c: number | null): number | null => (c != null && c > 0 && c < 9999 ? c : null);
const itemHref = (id: number) => `/items/${id}/`;
//A badge bucket thinner than this reads as noise on a per-item row, not a rank signal.
const MIN_BRACKET_MATCHES = 1000;

function groupName(item: ItemFacts): string | null {
  const tier = shopTier(item.tier);
  return tier != null && item.slot ? `tier ${tier} ${item.slot}` : null;
}

interface RatedPeer {
  item_id: number;
  name: string;
  wr: number;
  matches: number;
  buy: number | null;
}

function ratedPeers(input: ItemNarrativeInput): RatedPeer[] {
  return input.peers
    .filter((p) => p.win_rate != null && (p.matches ?? 0) > 0)
    .map((p) => ({
      item_id: p.item_id,
      name: p.name,
      wr: toPct(p.win_rate as number),
      matches: p.matches as number,
      buy: p.avg_buy_time_s ?? null,
    }));
}

interface BandRow {
  label: string;
  wr: number;
  matches: number;
  buy: number | null;
  rank: number | null;
  of: number | null;
}

function bands(input: ItemNarrativeInput): BandRow[] {
  return (input.brackets ?? [])
    .filter((b) => b.win_rate != null && (b.matches ?? 0) >= MIN_BRACKET_MATCHES && BADGE_TIER_LABELS[b.bracket])
    .sort((a, b) => a.bracket - b.bracket)
    .map((b) => ({
      label: BADGE_TIER_LABELS[b.bracket] as string,
      wr: toPct(b.win_rate as number),
      matches: b.matches as number,
      buy: b.avg_buy_time_s,
      rank: b.rank,
      of: b.of,
    }));
}

function trend(values: number[], flat: number): 'flat' | 'up' | 'down' | 'peak' | 'dip' {
  const swing = Math.max(...values) - Math.min(...values);
  if (swing < flat) return 'flat';
  const end = (values[values.length - 1] as number) - (values[0] as number);
  const hi = values.indexOf(Math.max(...values));
  const lo = values.indexOf(Math.min(...values));
  if (hi === values.length - 1 && lo === 0) return 'up';
  if (lo === values.length - 1 && hi === 0) return 'down';
  if (hi > 0 && hi < values.length - 1) return 'peak';
  if (lo > 0 && lo < values.length - 1) return 'dip';
  return end >= 0 ? 'up' : 'down';
}

function buyWindow(input: ItemNarrativeInput): Section | null {
  const { item } = input;
  const buy = item.avg_buy_time_s;
  if (buy == null) return null;
  const rel = item.avg_buy_time_relative;
  const cost = shopCost(item.cost);
  const group = groupName(item);

  const p1: Para = [];
  if (cost != null && group != null) {
    p1.push(
      `${count(cost)} souls buys ${item.name}, a ${group} ${item.active ? 'active' : 'passive'}, and players reach it ${duration(buy)} into a match on average`,
    );
  } else if (cost != null) {
    p1.push(`${count(cost)} souls buys ${item.name}, and players reach it ${duration(buy)} into a match on average`);
  } else {
    p1.push(`Players reach ${item.name} ${duration(buy)} into a match on average`);
  }
  p1.push(rel != null ? `, ${pct(rel, 0)} of the way through.` : '.');

  const peerBuys = ratedPeers(input).filter((p) => p.item_id !== item.item_id && p.buy != null);
  if (group != null && peerBuys.length >= 2) {
    const avg = mean(peerBuys.map((p) => p.buy as number)) as number;
    const gap = buy - avg;
    const earlier = peerBuys.filter((p) => (p.buy as number) < buy).length;
    if (Math.abs(gap) < 45) {
      p1.push(` That is the pace of the ${peerBuys.length} other ${group} items, which average ${duration(avg)}.`);
    } else if (earlier === 0) {
      p1.push(` No other ${group} item is bought sooner; the group averages ${duration(avg)}.`);
    } else if (earlier === peerBuys.length) {
      p1.push(` Every other ${group} item is bought sooner; the group averages ${duration(avg)}.`);
    } else {
      p1.push(
        ` It is the ${ordinal(earlier + 1)} earliest of the ${peerBuys.length + 1} ${group} items, ${duration(Math.abs(gap))} ${gap < 0 ? 'ahead of' : 'behind'} their ${duration(avg)} average.`,
      );
    }
  }

  const p2: Para = [];
  const rows = bands(input).filter((b) => b.buy != null);
  if (rows.length >= 3) {
    const first = rows[0] as BandRow;
    const last = rows[rows.length - 1] as BandRow;
    const times = rows.map((b) => b.buy as number);
    const shift = (last.buy as number) - (first.buy as number);
    const shape = trend(times, 60);
    const ends = `${duration(first.buy)} at ${first.label} against ${duration(last.buy)} at ${last.label}`;
    if (shape === 'flat') {
      p2.push(`The window holds across the ladder: ${ends}.`);
    } else if (shift > 0) {
      p2.push(`Higher bands take ${duration(shift)} longer to get there, ${ends}.`);
    } else if (shift < 0) {
      p2.push(`Higher bands get there ${duration(-shift)} sooner, ${ends}.`);
    } else {
      p2.push(`The two ends of the ladder land together: ${ends}.`);
    }
    if (shape === 'peak' || shape === 'dip') {
      const pick = shape === 'peak' ? Math.max(...times) : Math.min(...times);
      const at = rows[times.indexOf(pick)] as BandRow;
      p2.push(` ${at.label} is the outlier at ${duration(pick)}.`);
    }
  }

  const sell = item.avg_sell_time_s;
  const sellRel = item.avg_sell_time_relative;
  if (sell != null && sell > buy) {
    const held = sell - buy;
    const at = sellRel != null ? `${duration(sell)}, ${pct(sellRel, 0)} of the match` : duration(sell);
    if (sellRel != null && sellRel < 60) {
      p2.push(` It holds the slot ${duration(held)} and is sold again at ${at}, a step on the way to something else.`);
    } else if (held < 480) {
      p2.push(` It is sold again only ${duration(held)} later, at ${at}, so most of a build never carries it long.`);
    } else {
      p2.push(` It keeps the slot ${duration(held)} and is sold at ${at}, late enough to be an endgame swap rather than a build-up step.`);
    }
  }

  const paras = p2.length > 0 ? [p1, p2] : [p1];
  return { heading: `When players buy ${item.name}`, paras };
}

function performance(input: ItemNarrativeInput): Section | null {
  const { item, all } = input;
  if (item.win_rate == null || !item.matches) return null;
  const wr = toPct(item.win_rate);
  const rated = all.filter((r) => r.win_rate != null && (r.matches ?? 0) > 0);
  const n = rated.length;
  if (n < 2) return null;
  const wrs = rated.map((r) => toPct(r.win_rate as number));
  const avg = mean(wrs) as number;
  const wrRank = rankDesc(wrs, wr);
  const volRank = rankDesc(
    rated.map((r) => r.matches as number),
    item.matches,
  );
  const gap = wr - avg;

  const p1: Para = [
    `${item.name} wins ${pct(wr)} of the ${count(item.matches)} ranked games it was bought in, ${ordinal(wrRank)} of ${n} items and ${
      Math.abs(gap) < 0.3 ? `level with` : `${fixed(Math.abs(gap), 1)} points ${gap > 0 ? 'above' : 'below'}`
    } the ${pct(avg)} all-item average.`,
  ];
  //What players choose read against what the choice returns: the two ranks in thirds.
  const third = Math.ceil(n / 3);
  const band = (r: number) => (r <= third ? 0 : r <= third * 2 ? 1 : 2);
  const buyers = item.players ? `, over ${count(item.players)} players` : '';
  const FRAMES: string[][] = [
    [
      ` It is a staple that also wins, ${ordinal(volRank)} most bought${buyers}.`,
      ` It wins near the top of the field on ordinary volume, ${ordinal(volRank)} of ${n} bought${buyers}.`,
      ` Few players reach for it, ${ordinal(volRank)} of ${n} by volume, and those who do beat the field.`,
    ],
    [
      ` It is a default buy that returns the middle of the field, ${ordinal(volRank)} most bought${buyers}.`,
      ` It sits mid-table on both counts, ${ordinal(volRank)} of ${n} by volume and ${ordinal(wrRank)} by rate.`,
      ` It is a rare buy for a middling return, ${ordinal(volRank)} of ${n} by volume${buyers}.`,
    ],
    [
      ` It is bought far more than it returns: ${ordinal(volRank)} most bought, ${ordinal(wrRank)} by rate${buyers}.`,
      ` Ordinary volume for a rate near the bottom, ${ordinal(volRank)} of ${n} bought${buyers}.`,
      ` It is neither common nor winning, ${ordinal(volRank)} of ${n} by volume.`,
    ],
  ];
  p1.push((FRAMES[band(wrRank)] as string[])[band(volRank)] as string);

  const p2: Para = [];
  const group = groupName(item);
  const peers = ratedPeers(input);
  const sorted = [...peers].sort((a, b) => b.wr - a.wr);
  const at = sorted.findIndex((p) => p.item_id === item.item_id);
  if (group != null && peers.length >= 3 && at >= 0) {
    const above = at > 0 ? (sorted[at - 1] as RatedPeer) : null;
    const below = at < sorted.length - 1 ? (sorted[at + 1] as RatedPeer) : null;
    p2.push(`Against the ${sorted.length} ${group} items it ranks ${ordinal(at + 1)}`);
    if (above && below) {
      p2.push(
        `, between `,
        link(above.name, itemHref(above.item_id)),
        ` at ${pct(above.wr)} and `,
        link(below.name, itemHref(below.item_id)),
        ` at ${pct(below.wr)}.`,
      );
    } else if (below) {
      p2.push(`, ahead of every one of them; `, link(below.name, itemHref(below.item_id)), ` is next at ${pct(below.wr)}.`);
    } else if (above) {
      p2.push(`, last of the group, with `, link(above.name, itemHref(above.item_id)), ` one place up at ${pct(above.wr)}.`);
    } else {
      p2.push('.');
    }
    const busiest = [...peers].sort((a, b) => b.matches - a.matches)[0] as RatedPeer;
    if (busiest.item_id !== item.item_id) {
      p2.push(
        ` `,
        link(busiest.name, itemHref(busiest.item_id)),
        ` is the group's default at ${count(busiest.matches)} games against its ${count(item.matches)}.`,
      );
    }
  }

  const paras = p2.length > 0 ? [p1, p2] : [p1];
  return { heading: `How ${item.name} performs`, paras };
}

function byRank(input: ItemNarrativeInput): Section | null {
  const { item } = input;
  const rows = bands(input);
  if (rows.length < 3 || item.win_rate == null) return null;
  const rates = rows.map((b) => b.wr);
  const swing = Math.max(...rates) - Math.min(...rates);
  const shape = trend(rates, 1);
  const first = rows[0] as BandRow;
  const last = rows[rows.length - 1] as BandRow;
  const peak = rows[rates.indexOf(Math.max(...rates))] as BandRow;
  const dip = rows[rates.indexOf(Math.min(...rates))] as BandRow;

  const p1: Para = [];
  if (shape === 'flat') {
    //Nothing to plot: give the two ends rather than five near-identical readings.
    p1.push(
      `${item.name} holds its rate across the badge tiers: ${pct(first.wr)} at ${first.label} and ${pct(last.wr)} at ${last.label}, with ${fixed(swing, 1)} points between its best and worst band.`,
    );
  } else {
    const lead =
      shape === 'up'
        ? `${item.name} pays off more the higher the badge tier`
        : shape === 'down'
          ? `${item.name} pays off less the higher the badge tier`
          : shape === 'peak'
            ? `${item.name} is at its best around ${peak.label}`
            : `${item.name} is at its worst around ${dip.label}`;
    const list = rows
      .map((b) => `${pct(b.wr)} at ${b.label}${b.rank != null && b.of != null ? ` (${ordinal(b.rank)} of ${b.of})` : ''}`)
      .join('; ');
    const tail =
      last.rank != null && last.rank <= 10
        ? `By ${last.label} it is the ${ordinal(last.rank)} best-returning item in the shop, on ${count(last.matches)} games.`
        : first.rank != null && first.rank <= 10
          ? `It starts as the ${ordinal(first.rank)} best-returning item in the shop and gives up ${fixed(swing, 1)} points by ${dip.label}.`
          : `That is ${fixed(swing, 1)} points between ${dip.label} and ${peak.label}, on ${count(first.matches)} games in the lowest band and ${count(last.matches)} in the highest.`;
    p1.push(`${lead}: ${list}. ${tail}`);
  }

  const p2: Para = [];
  if (first.rank != null && last.rank != null && first.of != null && last.of != null) {
    const move = first.rank - last.rank;
    const ends = `${ordinal(first.rank)} of ${first.of} at ${first.label}, ${ordinal(last.rank)} of ${last.of} at ${last.label}`;
    if (Math.abs(move) >= 5) {
      const places = `${Math.abs(move)} places ${move > 0 ? 'up' : 'down'}`;
      p2.push(
        shape === 'flat'
          ? `The rate holds but the field around it does not: ${ends}, ${places}.`
          : `Its standing follows the rate: ${ends}, ${places}.`,
      );
    } else if (shape !== 'flat') {
      p2.push(`Its place in the field barely moves for it: ${ends}.`);
    }
  }

  const paras = p2.length > 0 ? [p1, p2] : [p1];
  return { heading: `${item.name} by rank`, paras };
}

interface Builder {
  hero_id: number;
  name: string;
  games: number;
  wr: number;
  share: number;
}

function builders(input: ItemNarrativeInput): Section | null {
  const rows = input.heroes.filter((h) => h.games > 0);
  if (rows.length < 2) return null;
  const total = rows.reduce((s, h) => s + h.games, 0);
  const scaled: Builder[] = rows.map((h) => ({
    hero_id: h.hero_id,
    name: h.name,
    games: h.games,
    wr: toPct(h.win_rate),
    //Pick rate inside the same feed when the hero's own total came through, so the number
    //is "share of that hero's games", not a slice of this item's popularity.
    share: h.hero_games && h.hero_games > 0 ? (h.games / h.hero_games) * 100 : (h.games / total) * 100,
  }));
  const floor = Math.max(200, 0.02 * Math.max(...scaled.map((h) => h.games)));
  const qualified = scaled.filter((h) => h.games >= floor);
  if (qualified.length < 2) return null;
  const byShare = [...qualified].sort((a, b) => b.share - a.share);
  const top = byShare[0] as Builder;
  //Narrative.astro emits whitespace at every <a> boundary, so nothing after a hero link
  //may open with punctuation ("Sinclair 's games"); each share clause leads with the name.
  const shares = (rows: Builder[]): Seg[] =>
    joinSegs(rows.map((h) => [link(h.name, heroPath(h.name)), ` at ${pct(h.share, 0)}`]));

  const half = byShare.filter((h) => h.share >= 50).length;
  const fifth = byShare.filter((h) => h.share >= 20).length;
  const rest = byShare.length - fifth;
  const p1: Para = [];
  if (half >= Math.ceil(byShare.length * 0.6)) {
    p1.push(
      `${input.item.name} is close to a default buy: ${half} of the ${byShare.length} heroes indexed take it in more than half their games, led by `,
      ...shares(byShare.slice(0, 3)),
      ` of their own.`,
    );
  } else if (fifth <= 1) {
    p1.push(
      `${input.item.name} is a one-hero buy: `,
      link(top.name, heroPath(top.name)),
      ` takes it in ${pct(top.share, 0)} of its games, and no other hero indexed puts it in a fifth of theirs.`,
    );
  } else if (fifth <= 3) {
    p1.push(`${input.item.name} belongs to a short list: `, ...shares(byShare.slice(0, fifth)), ` of their own games`);
    p1.push(rest > 0 ? `, and the other ${rest} heroes indexed stay under a fifth.` : `, and no other hero clears the sample floor with it.`);
  } else {
    p1.push(
      `${input.item.name} spreads thin: `,
      ...shares(byShare.slice(0, 3)),
      ` of their own games, and ${fifth} of the ${byShare.length} heroes indexed pass a fifth with it.`,
    );
  }

  const p2: Para = [];
  const byWr = [...qualified].sort((a, b) => b.wr - a.wr);
  const best = byWr[0] as Builder;
  const worst = byWr[byWr.length - 1] as Builder;
  const fieldAvg = mean(qualified.map((h) => h.wr)) as number;
  if (best.wr - worst.wr >= 1) {
    p2.push(
      `It returns most on `,
      link(best.name, heroPath(best.name)),
      ` at ${pct(best.wr)} and least on `,
      link(worst.name, heroPath(worst.name)),
      ` at ${pct(worst.wr)}, ${fixed(best.wr - worst.wr, 1)} points apart.`,
    );
    if (best.hero_id === top.hero_id) {
      p2.push(` The hero that leans on it hardest is the one it works best for.`);
    } else if (worst.hero_id === top.hero_id) {
      p2.push(` The hero that leans on it hardest is the one it works worst for; the field averages ${pct(fieldAvg)} with it.`);
    } else if (Math.abs(top.wr - fieldAvg) >= 0.5) {
      p2.push(
        ` `,
        link(top.name, heroPath(top.name)),
        ` buys it most and takes ${pct(top.wr)} from it, ${fixed(Math.abs(top.wr - fieldAvg), 1)} points ${top.wr > fieldAvg ? 'over' : 'under'} the ${pct(fieldAvg)} the indexed heroes average.`,
      );
    }
  }

  const paras = p2.length > 0 ? [p1, p2] : [p1];
  return { heading: `Who builds ${input.item.name}`, paras };
}

//No stats row for this item: say what the catalog knows and what is missing, nothing else.
function catalogOnly(input: ItemNarrativeInput): Section {
  const { item } = input;
  const tier = shopTier(item.tier);
  const cost = shopCost(item.cost);
  const p: Para = [];
  if (tier != null && cost != null && item.slot) {
    p.push(`${item.name} is a tier ${tier} ${item.slot} item costing ${count(cost)} souls, ${item.active ? 'used from the slot' : 'passive once bought'}.`);
  } else if (item.slot) {
    p.push(`${item.name} sits in the ${item.slot} tree with no shop tier or price in the catalog, the shape of an entry Valve has not released.`);
  } else {
    p.push(`The catalog carries ${item.name} with no tier, price or slot.`);
  }
  p.push(` RankLock's item fold recorded no ranked purchases of it, so there is no win rate, buy time or hero table on this page.`);
  const peers = ratedPeers(input).filter((x) => x.item_id !== item.item_id);
  const group = groupName(item);
  if (group != null && peers.length >= 2) {
    const avg = mean(peers.map((x) => x.wr)) as number;
    const buys = peers.filter((x) => x.buy != null).map((x) => x.buy as number);
    p.push(
      ` The ${peers.length} ${group} items that do have rows win ${pct(avg)} on average${buys.length >= 2 ? ` and are bought around ${duration(mean(buys) as number)}` : ''}.`,
    );
  }
  return { heading: `What the catalog has on ${item.name}`, paras: [p] };
}

function about(input: ItemNarrativeInput, rendered: string[]): Section {
  const { item } = input;
  const p: Para = [];
  if (rendered.includes('performance')) {
    p.push(`Buying ${item.name} does not cause the win: a late item inherits the lead of the games it lands in.`);
  }
  if (rendered.includes('builders')) {
    p.push(
      ` The per-hero rows come from the upstream deadlock-api.com item feed rather than RankLock's own match database, so their game counts are not comparable with hero pick totals.`,
    );
  }
  p.push(` The `, link('methodology', '/methodology/'), ` page covers how the tables are built.`);
  return { heading: 'About these numbers', paras: [p] };
}

export function itemNarrative(input: ItemNarrativeInput): Section[] {
  if (input.item.win_rate == null || !input.item.matches) {
    return [catalogOnly(input)];
  }
  const parts: [string, Section | null][] = [
    ['buy', buyWindow(input)],
    ['performance', performance(input)],
    ['rank', byRank(input)],
    ['builders', builders(input)],
  ];
  const sections = parts.filter((e): e is [string, Section] => e[1] != null);
  if (sections.length === 0) return [catalogOnly(input)];
  return [...sections.map((e) => e[1]), about(input, sections.map((e) => e[0]))];
}
