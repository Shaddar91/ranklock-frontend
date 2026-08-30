//Per-item prose for the prerendered item pages: performance against every other
//item and its slot/tier peers, purchase timing, and which heroes build it.
import { count, duration, pct } from './format';
import { joinSegs, link, mean, ordinal, rankDesc, toPct, type Para, type Section, type Seg } from './narrative';

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
}

export interface ItemHeroRow {
  hero_id: number;
  name: string;
  games: number;
  win_rate: number;
}

export interface ItemNarrativeInput {
  item: ItemFacts;
  all: { item_id: number; win_rate: number | null; matches: number | null }[];
  peers: ItemPeer[];
  heroes: ItemHeroRow[];
}

const heroHref = (id: number) => `/heroes/${id}/`;
const itemHref = (id: number) => `/items/${id}/`;

function performance(input: ItemNarrativeInput): Section | null {
  const { item, all, peers } = input;
  if (item.win_rate == null || !item.matches) return null;
  const wr = toPct(item.win_rate);
  const rated = all.filter((r) => r.win_rate != null && (r.matches ?? 0) > 0);
  const n = rated.length;
  if (n < 2) return null;
  const wrs = rated.map((r) => toPct(r.win_rate as number));
  const avg = mean(wrs) as number;
  const wrRank = rankDesc(wrs, wr);
  const volRank = rankDesc(rated.map((r) => r.matches as number), item.matches);
  const diff = wr - avg;
  const diffText =
    Math.abs(diff) < 0.3 ? 'level with' : `${Math.abs(diff).toFixed(1)} points ${diff > 0 ? 'above' : 'below'}`;
  const p1: Para = [
    `Players who buy ${item.name} win ${pct(wr)} of their games, ${ordinal(wrRank)} of ${n} items by win rate and ${diffText} the all-item average of ${pct(avg)}. `,
    `It was bought in ${count(item.matches)} ranked games${item.players ? ` by ${count(item.players)} different players` : ''}, the ${ordinal(volRank)} most bought item.`,
  ];

  const p2: Para = [];
  const peerRated = peers.filter((p) => p.win_rate != null && (p.matches ?? 0) > 0);
  if (item.tier != null && item.slot && peerRated.length >= 2) {
    const peerRank = rankDesc(peerRated.map((p) => toPct(p.win_rate as number)), wr);
    const best = [...peerRated].sort((a, b) => toPct(b.win_rate as number) - toPct(a.win_rate as number))[0];
    p2.push(`Among the ${peerRated.length} tier ${item.tier} ${item.slot} items it ranks ${ordinal(peerRank)} by win rate`);
    if (best && best.item_id !== item.item_id) {
      p2.push(`, behind `, link(best.name, itemHref(best.item_id)), ` at ${pct(toPct(best.win_rate as number))}`);
    } else if (best) {
      p2.push(`, the best of that group`);
    }
    p2.push('. ');
  }
  const buy = item.avg_buy_time_s;
  const rel = item.avg_buy_time_relative;
  if (buy != null && rel != null) {
    if (rel >= 60)
      p2.push(
        `It is bought late, at ${duration(buy)} on average (${pct(rel, 0)} of the way through a match), so part of its win rate is the late-game bias every item shares: players buy it in games that are already going well.`,
      );
    else if (rel < 25)
      p2.push(
        `It is an early buy, ${duration(buy)} into the match on average (${pct(rel, 0)} of the way through), so its win rate reflects lane and early-fight outcomes rather than snowballing.`,
      );
    else
      p2.push(
        `It is bought around ${duration(buy)} on average (${pct(rel, 0)} of the way through a match), the mid-game window where most builds branch.`,
      );
    const sell = item.avg_sell_time_s;
    const sellRel = item.avg_sell_time_relative;
    if (sell != null && sellRel != null && sellRel < 90) {
      p2.push(
        ` Players sell it again at ${duration(sell)} on average (${pct(sellRel, 0)} of the match), the mark of a stepping-stone item that gets replaced.`,
      );
    }
  }
  const paras = p2.length > 0 ? [p1, p2] : [p1];
  return { heading: `How ${item.name} performs`, paras };
}

function builders(input: ItemNarrativeInput): Section | null {
  const rows = input.heroes.filter((h) => h.games > 0);
  if (rows.length === 0) return null;
  const maxGames = Math.max(...rows.map((h) => h.games));
  const min = Math.max(200, 0.02 * maxGames);
  const qualified = rows.map((h) => ({ ...h, wr: toPct(h.win_rate) })).filter((h) => h.games >= min);
  if (qualified.length < 2) return null;
  const byWr = [...qualified].sort((a, b) => b.wr - a.wr).slice(0, 3);
  const byGames = [...qualified].sort((a, b) => b.games - a.games).slice(0, 3);
  const seg = (h: { hero_id: number; name: string; wr: number }): Seg[] => [link(h.name, heroHref(h.hero_id)), ` (${pct(h.wr)})`];
  const segName = (h: { hero_id: number; name: string }): Seg[] => [link(h.name, heroHref(h.hero_id))];
  const p: Para = [`${input.item.name} wins most often on `, ...joinSegs(byWr.map(seg)), `. `];
  p.push(`The heroes who buy it most are `, ...joinSegs(byGames.map(segName)), `.`);
  const both = byGames.find((h) => byWr.includes(h));
  if (both) p.push(` ${both.name} is both a frequent and a winning buyer, the clearest sign the item belongs in its build.`);
  else p.push(` None of the heaviest buyers is among the heroes that win most with it: the popular home for the item is not the best one.`);
  return { heading: 'Who builds it', paras: [p] };
}

function about(input: ItemNarrativeInput): Section {
  const { item } = input;
  const p: Para = [];
  if (item.tier != null && item.slot) {
    p.push(
      `${item.name} is a tier ${item.tier} ${item.slot} item${item.cost ? ` costing ${count(item.cost)} souls` : ''}${item.active ? ' with an active ability' : ', working passively once bought'}. `,
    );
  }
  p.push(
    `Its win rate is the share of ranked games won by players who bought it${item.matches ? `, out of ${count(item.matches)} purchases` : ''}, across all rank bands. The per-hero rows come from the upstream deadlock-api.com item feed rather than RankLock's own match database, so their game counts are not comparable with hero pick totals. Buying an item does not cause the win; late items in particular inherit the lead of the games they are bought in. The `,
    link('methodology', '/methodology/'),
    ` page covers how the tables are built.`,
  );
  return { heading: 'About these numbers', paras: [p] };
}

export function itemNarrative(input: ItemNarrativeInput): Section[] {
  return [performance(input), builders(input), about(input)].filter((s): s is Section => s != null);
}
