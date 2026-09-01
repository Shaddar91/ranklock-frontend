//Per-hero prose for the prerendered hero pages, derived from the build-time stats
//so every page reads differently in substance (named matchups, partners, items,
//rank pattern), not only in the numbers.
import { count, fixed, pct } from './format';
import { joinSegs, link, mean, ordinal, quarter, rankDesc, toPct, type Para, type Section, type Seg } from './narrative';
import type { HeroBracket, HeroItemWinRate, HeroSummary, MatchupEntry } from '../types/api';

export interface HeroSynergy {
  partnerId: number;
  matches: number;
  winRate: number;
}

export interface HeroBracketRoster {
  key: HeroBracket;
  label: string;
  roster: HeroSummary[];
}

export interface HeroNarrativeInput {
  hero: HeroSummary;
  roster: HeroSummary[];
  matchups: MatchupEntry[];
  synergies: HeroSynergy[];
  items: HeroItemWinRate[];
  brackets: HeroBracketRoster[];
  heroName: (id: number) => string;
  statsThrough: string;
  window: { lo: string; hi: string } | null;
  patchesInWindow: number | null;
  currentPatch: { label: string; since: string } | null;
}

const heroHref = (id: number) => `/heroes/${id}/`;
const itemHref = (id: number) => `/items/${id}/`;

function performance(input: HeroNarrativeInput): Section | null {
  const { hero, roster } = input;
  if (hero.win_rate == null || hero.picks <= 0) return null;
  const name = hero.hero_name;
  const rated = roster.filter((h) => h.win_rate != null && h.picks > 0);
  const n = rated.length;
  if (n < 2) return null;
  const wrs = rated.map((h) => h.win_rate as number);
  const avg = mean(wrs) as number;
  const wrRank = rankDesc(wrs, hero.win_rate);
  const totalPicks = rated.reduce((s, h) => s + h.picks, 0);
  const share = (hero.picks / totalPicks) * 100;
  const pickRank = rankDesc(rated.map((h) => h.picks), hero.picks);
  const diff = hero.win_rate - avg;
  const diffText =
    Math.abs(diff) < 0.3
      ? 'level with'
      : `${fixed(Math.abs(diff), 1)} points ${diff > 0 ? 'above' : 'below'}`;
  const p1: Para = [
    `${name} wins ${pct(hero.win_rate)} of its ${count(hero.picks)} ranked games, ${ordinal(wrRank)} of ${n} heroes by win rate and ${diffText} the roster average of ${pct(avg)}. `,
    `Players pick it in ${pct(share)} of hero slots, the ${ordinal(pickRank)} most played hero.`,
  ];

  const q = quarter(n);
  const strong = wrRank <= q;
  const weak = wrRank > n - q;
  const popular = pickRank <= q;
  const rare = pickRank > n - q;
  let verdict: string;
  if (strong && popular)
    verdict = `A high win rate on a large pick base is the mark of a meta pick: the number is not inflated by a small pool of specialists.`;
  else if (strong && rare)
    verdict = `A high win rate on a small pick base usually means a specialist pool: the players who pick ${name} know it well, so expect the figure to settle as more players try it.`;
  else if (weak && popular)
    verdict = `Popular but losing more than it wins: ${name} is picked for reasons the results do not back up, or its value depends on team follow-up that solo queue rarely gives.`;
  else if (weak && rare)
    verdict = `Both figures sit near the bottom of the roster, which normally reads as a hero the current patch has left behind.`;
  else if (strong) verdict = `Its win rate is top-quarter on an ordinary pick rate, a solid pick without being a bandwagon.`;
  else if (weak) verdict = `Its win rate sits in the bottom quarter despite an ordinary pick rate.`;
  else verdict = `Neither figure is extreme: ${name} sits in the middle of the roster on both counts.`;

  const style: string[] = [];
  const rankOf = (pick: (h: HeroSummary) => number | null | undefined, v: number | null | undefined) => {
    if (v == null) return null;
    const vals = rated.map(pick).filter((x): x is number => x != null);
    return vals.length === n ? rankDesc(vals, v) : null;
  };
  const kr = rankOf((h) => h.avg_kills, hero.avg_kills);
  const dr = rankOf((h) => h.avg_deaths, hero.avg_deaths);
  const ar = rankOf((h) => h.avg_assists, hero.avg_assists);
  const sr = rankOf((h) => h.avg_net_worth, hero.avg_net_worth);
  if (kr != null && kr <= q) style.push(`It is one of the roster's heavier killers at ${fixed(hero.avg_kills, 1)} kills a game (${ordinal(kr)} of ${n}).`);
  if (ar != null && ar <= q) style.push(`Much of its impact arrives as assists, ${fixed(hero.avg_assists, 1)} a game (${ordinal(ar)} highest).`);
  if (sr != null && sr <= q) style.push(`It farms: ${count(hero.avg_net_worth)} average souls is ${ordinal(sr)} on the roster.`);
  if (dr != null && dr <= q) style.push(`It also dies more than most, ${fixed(hero.avg_deaths, 1)} deaths a game (${ordinal(dr)} highest).`);
  if (dr != null && dr > n - q) style.push(`It dies rarely, ${fixed(hero.avg_deaths, 1)} deaths a game (${ordinal(n - dr + 1)} lowest).`);
  if (sr != null && sr > n - q) style.push(`Its ${count(hero.avg_net_worth)} average souls is ${ordinal(n - sr + 1)} lowest, so it does not win by out-farming.`);
  if (style.length === 0) style.push(`Its kills, deaths, assists and souls all sit in the roster's middle band.`);

  return { heading: `How ${name} performs`, paras: [p1, [verdict, ' ', style.join(' ')]] };
}

function matchups(input: HeroNarrativeInput): Section | null {
  const { hero, heroName } = input;
  const rows = input.matchups.filter((m) => m.matches > 0);
  if (rows.length === 0) return null;
  const maxMatches = Math.max(...rows.map((m) => m.matches));
  const min = Math.max(200, 0.02 * maxMatches);
  const qualified = rows
    .filter((m) => m.matches >= min)
    .map((m) => ({ id: m.hero_b_id, wr: toPct(m.win_rate), matches: m.matches }))
    .sort((a, b) => b.wr - a.wr);
  if (qualified.length < 2) return null;
  const name = hero.hero_name;
  const winning = qualified.filter((m) => m.wr > 50).length;
  const bestN = qualified.length >= 6 ? 3 : Math.max(1, Math.floor(qualified.length / 2));
  const best = qualified.slice(0, bestN);
  const worst = qualified.slice(bestN).slice(-3).reverse();
  const first = qualified[0];
  const last = qualified[qualified.length - 1];
  if (!first || !last) return null;
  const spread = first.wr - last.wr;
  const spreadText =
    spread >= 10
      ? `The spread between its best and worst matchup is ${fixed(spread, 1)} points, so the draft matters more for ${name} than for most heroes.`
      : spread < 5
        ? `Its results barely move with the opponent, a ${fixed(spread, 1)} point spread, so it is a safe blind pick.`
        : `The matchup spread is ${fixed(spread, 1)} points: enough to matter in a coordinated draft, not enough to avoid the hero.`;
  const seg = (m: { id: number; wr: number; matches: number }): Seg[] => [
    link(heroName(m.id), heroHref(m.id)),
    ` (${pct(m.wr)} over ${count(m.matches)} games)`,
  ];
  const p1: Para = [`${name} has a winning record against ${winning} of its ${qualified.length} common opponents. ${spreadText}`];
  const p2: Para = [`Its best matchups are against `, ...joinSegs(best.map(seg)), `.`];
  const losing = worst.filter((m) => m.wr < 50);
  if (losing.length === worst.length && worst.length > 0) p2.push(` It struggles most against `, ...joinSegs(worst.map(seg)), `.`);
  else if (losing.length > 0) p2.push(` It loses more than it wins against `, ...joinSegs(losing.map(seg)), `.`);
  else if (worst.length > 0) p2.push(` Even its weakest matchups are winning ones: `, ...joinSegs(worst.map(seg)), `.`);
  return { heading: 'Matchups', paras: [p1, p2] };
}

function partners(input: HeroNarrativeInput): Section | null {
  const rows = input.synergies.filter((s) => s.matches > 0);
  if (rows.length === 0) return null;
  const maxMatches = Math.max(...rows.map((s) => s.matches));
  const min = Math.max(100, 0.02 * maxMatches);
  const qualified = rows.filter((s) => s.matches >= min).sort((a, b) => b.winRate - a.winRate);
  if (qualified.length < 2) return null;
  const top = qualified.slice(0, 3);
  const common = [...qualified].sort((a, b) => b.matches - a.matches)[0];
  if (!common) return null;
  const name = input.hero.hero_name;
  const seg = (s: HeroSynergy): Seg[] => [link(input.heroName(s.partnerId), heroHref(s.partnerId)), ` (${pct(s.winRate)})`];
  const p: Para = [`On the same team, ${name} wins most often alongside `, ...joinSegs(top.map(seg)), `. `];
  if (top.includes(common)) {
    p.push(`${input.heroName(common.partnerId)} is also its most common partner, at ${count(common.matches)} games together.`);
  } else {
    p.push(
      `Its most common partner is `,
      link(input.heroName(common.partnerId), heroHref(common.partnerId)),
      ` (${count(common.matches)} games together, ${pct(common.winRate)}), a pairing chosen more for comfort than for its results.`,
    );
  }
  return { heading: 'Duo partners', paras: [p] };
}

function items(input: HeroNarrativeInput): Section | null {
  const rows = input.items.filter((r) => r.win_rate != null && (r.games ?? 0) > 0);
  if (rows.length === 0) return null;
  const maxGames = Math.max(...rows.map((r) => r.games as number));
  const min = Math.max(200, 0.01 * maxGames);
  const qualified = rows
    .filter((r) => (r.games as number) >= min)
    .map((r) => ({ id: r.item_id, name: r.item_name ?? `Item ${r.item_id}`, wr: toPct(r.win_rate as number), games: r.games as number }))
    .sort((a, b) => b.wr - a.wr);
  if (qualified.length < 2) return null;
  const top = qualified.slice(0, 3);
  const most = [...qualified].sort((a, b) => b.games - a.games)[0];
  const first = top[0];
  if (!most || !first) return null;
  const name = input.hero.hero_name;
  const seg = (r: { id: number; name: string; wr: number }): Seg[] => [link(r.name, itemHref(r.id)), ` (${pct(r.wr)})`];
  const p: Para = [`The items that win most on ${name} are `, ...joinSegs(top.map(seg)), `. `];
  if (top.includes(most)) {
    p.push(`${most.name} is also the most bought item.`);
  } else {
    p.push(
      `The most bought item is `,
      link(most.name, itemHref(most.id)),
      ` (${pct(most.wr)}), so the popular buy is not the highest-winning one.`,
    );
  }
  if (first.games < 0.25 * most.games) {
    p.push(
      ` The top win rates come from lower-volume buys, which usually means situational items that win when the game calls for them.`,
    );
  }
  return { heading: 'Items', paras: [p] };
}

function byRank(input: HeroNarrativeInput): Section | null {
  const name = input.hero.hero_name;
  const rows = input.brackets
    .map((b) => {
      const me = b.roster.find((h) => h.hero_id === input.hero.hero_id);
      const rated = b.roster.filter((h) => h.win_rate != null && h.picks > 0);
      if (!me || me.win_rate == null || me.picks <= 0 || rated.length < 2) return null;
      const total = rated.reduce((s, h) => s + h.picks, 0);
      return {
        label: b.label,
        wr: me.win_rate,
        picks: me.picks,
        share: (me.picks / total) * 100,
        rank: rankDesc(rated.map((h) => h.win_rate as number), me.win_rate),
        n: rated.length,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r != null);
  if (rows.length < 2) return null;
  const p1: Para = [
    `By rank bracket, ${name} wins ` +
      rows.map((r) => `${pct(r.wr)} at ${r.label} (${ordinal(r.rank)} of ${r.n}, ${count(r.picks)} games)`).join('; ') +
      '.',
  ];
  const lo = rows[0];
  const hi = [...rows].reverse().find((r) => r.picks >= 1000) ?? rows[rows.length - 1];
  if (!lo || !hi || lo === hi) return { heading: 'By rank', paras: [p1] };
  const delta = hi.wr - lo.wr;
  let trend: string;
  if (delta >= 1.5)
    trend = `${name} gets better as the lobby gets better: ${fixed(delta, 1)} points higher at ${hi.label} than at ${lo.label}, the pattern of a hero whose ceiling needs mechanics or coordination to reach.`;
  else if (delta <= -1.5)
    trend = `${name} loses ${fixed(-delta, 1)} points between ${lo.label} and ${hi.label}, which usually means its strengths are easier to punish for coordinated teams.`;
  else trend = `Its win rate is close to flat across ranks (${pct(lo.wr)} to ${pct(hi.wr)}), so what this page says applies at your badge too.`;
  const shareDelta = hi.share - lo.share;
  if (Math.abs(shareDelta) >= 0.5) {
    trend += ` It is picked ${shareDelta > 0 ? 'more' : 'less'} often at the top, ${pct(hi.share)} of slots at ${hi.label} against ${pct(lo.share)} at ${lo.label}.`;
  }
  return { heading: 'By rank', paras: [p1, [trend]] };
}

function about(input: HeroNarrativeInput): Section {
  const { hero, window, patchesInWindow, currentPatch, statsThrough } = input;
  const name = hero.hero_name;
  if (hero.win_rate == null || hero.picks <= 0) {
    return {
      heading: 'About these numbers',
      paras: [
        [
          `${name} is marked disabled in the roster data and has no ranked matches in RankLock's dataset, so there are no win-rate, KDA, matchup or item numbers on this page.`,
        ],
      ],
    };
  }
  const p: Para = [
    `Figures on this page come from ${count(hero.picks)} ranked ${name} games in RankLock's own match database${statsThrough ? `, current through ${statsThrough}` : ''}. `,
  ];
  if (window) {
    p.push(`The matchup and item tables cover ${window.lo} to ${window.hi}, the window RankLock has processed so far`);
    if (patchesInWindow != null && currentPatch) {
      p.push(`; ${patchesInWindow} patch releases fall inside it, and the current patch is ${currentPatch.label}, live since ${currentPatch.since}`);
    }
    p.push('. ');
  }
  p.push(
    `Duo synergies come from the upstream deadlock-api.com feed rather than RankLock's database. Win rates are shares of games won, never MMR; the `,
    link('methodology', '/methodology/'),
    ` page explains each table.`,
  );
  return { heading: 'About these numbers', paras: [p] };
}

export function heroNarrative(input: HeroNarrativeInput): Section[] {
  return [performance(input), matchups(input), partners(input), items(input), byRank(input), about(input)].filter(
    (s): s is Section => s != null,
  );
}
