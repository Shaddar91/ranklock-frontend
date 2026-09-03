//Per-hero prose for the prerendered hero pages, derived from the build-time stats so
//every page reads about that hero: its own kit, its named matchups read across the
//ladder, its head-to-head stat lines, partners, items and rank pattern.
import { count, duration, fixed, pct } from './format';
import { joinSegs, link, mean, ordinal, quarter, rankDesc, toPct, type Para, type Section, type Seg } from './narrative';
import { heroPath } from './heroSlugs';
import type { HeroAbility, HeroBracket, HeroItemWinRate, HeroSummary, MatchupEntry } from '../types/api';

export interface HeroSynergy {
  partnerId: number;
  matches: number;
  winRate: number;
}

//Per-game stat line against one opponent, averaged by the page from /heroes/:id/counters.
export interface HeroCounter {
  enemyId: number;
  matches: number;
  souls: number;
  deaths: number;
  kills: number;
  objDamage: number;
  enemySouls: number;
  enemyDeaths: number;
  enemyKills: number;
  enemyObjDamage: number;
}

export interface HeroTierMatchups {
  tier: number;
  rows: MatchupEntry[];
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
  tierMatchups: HeroTierMatchups[];
  counters: HeroCounter[];
  abilities: HeroAbility[];
  synergies: HeroSynergy[];
  items: HeroItemWinRate[];
  brackets: HeroBracketRoster[];
  heroName: (id: number) => string;
  statsThrough: string;
  window: { lo: string; hi: string } | null;
  patchesInWindow: number | null;
  currentPatch: { label: string; since: string } | null;
}

//analytics.hero_matchup_rates badge buckets 1-5 (deadlock-analytics hero_matchups.rs BRACKET_RANGES).
const TIER_LABELS: Record<number, string> = {
  1: 'Initiate to Alchemist',
  2: 'Arcanist to Ritualist',
  3: 'Emissary to Archon',
  4: 'Oracle to Phantom',
  5: 'Ascendant to Eternus',
};

//A hero page exists only for a roster hero, so an off-roster id is named in prose but not linked.
const heroSeg = (roster: HeroSummary[], id: number, text: string): Seg => {
  const h = roster.find((r) => r.hero_id === id);
  return h ? link(text, heroPath(h.hero_name)) : text;
};
const itemHref = (id: number) => `/items/${id}/`;

const joinNames = (names: string[]): string =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

interface Opponent {
  id: number;
  wr: number;
  matches: number;
}

//One qualified-opponent list, shared by every section that names a matchup so the
//matchup, ladder and head-to-head sentences always talk about the same heroes.
//The unbracketed read emits one row per match_mode with no field to tell them apart
//(deadlock-backend analytics.rs MATCHUP_SQL), so rows are merged per opponent first.
function rankedOpponents(input: HeroNarrativeInput): Opponent[] | null {
  const merged = new Map<number, { matches: number; wins: number }>();
  for (const m of input.matchups) {
    if (m.matches <= 0 || m.hero_b_id === input.hero.hero_id) continue;
    const acc = merged.get(m.hero_b_id) ?? { matches: 0, wins: 0 };
    acc.matches += m.matches;
    acc.wins += m.hero_a_wins;
    merged.set(m.hero_b_id, acc);
  }
  if (merged.size === 0) return null;
  const min = Math.max(200, 0.02 * Math.max(...[...merged.values()].map((v) => v.matches)));
  const qualified = [...merged.entries()]
    .filter(([, v]) => v.matches >= min)
    .map(([id, v]) => ({ id, wr: (v.wins / v.matches) * 100, matches: v.matches }))
    .sort((a, b) => b.wr - a.wr);
  return qualified.length < 2 ? null : qualified;
}

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

  //Match length is flat across the roster, so it only earns a sentence half a minute off the mean.
  const durations = rated.map((h) => h.avg_duration_s).filter((d): d is number => d != null);
  const avgDuration = durations.length === n ? (mean(durations) as number) : null;
  if (avgDuration != null && hero.avg_duration_s != null) {
    const gap = hero.avg_duration_s - avgDuration;
    if (gap >= 30) style.push(`Its games run long, ${duration(hero.avg_duration_s)} against the roster's ${duration(avgDuration)}.`);
    else if (gap <= -30) style.push(`Its games end early, ${duration(hero.avg_duration_s)} against the roster's ${duration(avgDuration)}.`);
  }
  if (style.length === 0) {
    const middle = (n + 1) / 2;
    const nearest = [
      { label: 'kills', text: `${fixed(hero.avg_kills, 1)} a game`, rank: kr },
      { label: 'deaths', text: `${fixed(hero.avg_deaths, 1)} a game`, rank: dr },
      { label: 'assists', text: `${fixed(hero.avg_assists, 1)} a game`, rank: ar },
      { label: 'souls', text: `${count(hero.avg_net_worth)} a game`, rank: sr },
    ]
      .filter((c): c is { label: string; text: string; rank: number } => c.rank != null)
      .sort((a, b) => Math.abs(b.rank - middle) - Math.abs(a.rank - middle))[0];
    style.push(
      nearest
        ? `The closest it comes to an outlier is ${nearest.label}, ${nearest.text}, ${ordinal(nearest.rank)} of ${n}.`
        : `Its kills, deaths, assists and souls all sit in the roster's middle band.`,
    );
  }

  return { heading: `How ${name} performs`, paras: [p1, [verdict, ' ', style.join(' ')]] };
}

function kit(input: HeroNarrativeInput): Section | null {
  const named = input.abilities.filter((a) => a.name != null && a.name.trim() !== '' && !a.name.startsWith('citadel_'));
  const signatures = named
    .filter((a) => a.ability_type === 'signature')
    .sort((a, b) => a.order - b.order)
    .map((a) => a.name);
  const ultimate = named.find((a) => a.ability_type === 'ultimate')?.name ?? null;
  if (signatures.length === 0 && ultimate == null) return null;
  const name = input.hero.hero_name;
  let sentence: string;
  if (signatures.length > 0 && ultimate != null)
    sentence = `${name} plays through ${joinNames(signatures)}, with ${ultimate} as its ultimate.`;
  else if (signatures.length > 0) sentence = `${name} plays through ${joinNames(signatures)}.`;
  else sentence = `${name} plays around its ultimate, ${ultimate}.`;
  return { heading: `${name}'s kit`, paras: [[sentence]] };
}

//Whether the named matchup holds across the badge buckets, and how far it moves.
function ladderLine(input: HeroNarrativeInput, opponent: Opponent): string | null {
  const perTier = input.tierMatchups
    .map((t) => {
      const label = TIER_LABELS[t.tier];
      const row = t.rows.find((r) => r.hero_b_id === opponent.id && r.matches > 0);
      return label && row ? { tier: t.tier, label, wr: toPct(row.win_rate) } : null;
    })
    .filter((r): r is NonNullable<typeof r> => r != null)
    .sort((a, b) => a.tier - b.tier);
  if (perTier.length < 3) return null;
  const lo = perTier[0] as NonNullable<(typeof perTier)[number]>;
  const hi = perTier[perTier.length - 1] as NonNullable<(typeof perTier)[number]>;
  const rates = perTier.map((r) => r.wr);
  const swing = Math.max(...rates) - Math.min(...rates);
  const winning = perTier.filter((r) => r.wr > 50);
  const name = input.heroName(opponent.id);
  const ends = `${pct(lo.wr)} at ${lo.label} and ${pct(hi.wr)} at ${hi.label}`;
  let sentence: string;
  if (winning.length === perTier.length) sentence = `The ${name} matchup holds at every tier, ${ends}.`;
  else if (winning.length === 0) sentence = `It loses to ${name} at every tier, ${ends}.`;
  else if (lo.wr <= 50)
    sentence = `Against ${name} it only turns favourable at ${(winning[0] as NonNullable<(typeof perTier)[number]>).label}, ${ends}.`;
  else {
    const firstLoss = perTier.find((r) => r.wr <= 50) as NonNullable<(typeof perTier)[number]>;
    sentence = `Its edge over ${name} runs out at ${firstLoss.label}, ${ends}.`;
  }
  if (swing >= 4) sentence += ` That is a ${fixed(swing, 1)} point swing across the ladder.`;
  else if (swing < 1) sentence += ` The number moves less than a point across the ladder.`;
  return sentence;
}

function matchups(input: HeroNarrativeInput): Section | null {
  const qualified = rankedOpponents(input);
  if (!qualified) return null;
  const { hero, heroName } = input;
  const name = hero.hero_name;
  const winning = qualified.filter((m) => m.wr > 50).length;
  const bestN = qualified.length >= 6 ? 3 : Math.max(1, Math.floor(qualified.length / 2));
  const best = qualified.slice(0, bestN);
  const worst = qualified.slice(bestN).slice(-3).reverse();
  const first = qualified[0] as Opponent;
  const last = qualified[qualified.length - 1] as Opponent;
  const spread = first.wr - last.wr;
  const top = heroName(first.id);
  const bottom = heroName(last.id);
  const spreadText =
    spread >= 10
      ? `Its results swing ${fixed(spread, 1)} points from ${top} down to ${bottom}, so the draft matters more for ${name} than for most heroes.`
      : spread < 5
        ? `Its results barely move with the opponent, ${fixed(spread, 1)} points between ${top} and ${bottom}, so it is a safe blind pick.`
        : `The ${top} to ${bottom} spread is ${fixed(spread, 1)} points: enough to matter in a coordinated draft, not enough to avoid the hero.`;
  const seg = (m: Opponent): Seg[] => [
    heroSeg(input.roster, m.id, heroName(m.id)),
    ` (${pct(m.wr)} over ${count(m.matches)} games)`,
  ];
  const p1: Para = [`${name} has a winning record against ${winning} of its ${qualified.length} common opponents. ${spreadText}`];
  const p2: Para = [`Its best matchups are against `, ...joinSegs(best.map(seg)), `.`];
  const losing = worst.filter((m) => m.wr < 50);
  if (losing.length === worst.length && worst.length > 0) p2.push(` It struggles most against `, ...joinSegs(worst.map(seg)), `.`);
  else if (losing.length > 0) p2.push(` It loses more than it wins against `, ...joinSegs(losing.map(seg)), `.`);
  else if (worst.length > 0) p2.push(` Even its weakest matchups are winning ones: `, ...joinSegs(worst.map(seg)), `.`);
  const paras: Para[] = [p1, p2];
  const ladder = [first, last]
    .filter((o, i, arr) => arr.indexOf(o) === i)
    .map((o) => ladderLine(input, o))
    .filter((s): s is string => s != null);
  if (ladder.length > 0) paras.push([ladder.join(' ')]);
  return { heading: 'Matchups', paras };
}

//Souls, deaths and objective damage the two named matchups actually end on.
function counterLine(input: HeroNarrativeInput, opponent: Opponent, row: HeroCounter): string {
  const name = input.heroName(opponent.id);
  const souls = row.souls - row.enemySouls;
  const deaths = row.deaths - row.enemyDeaths;
  const soulsLevel = Math.abs(souls) < 500;
  const deathsLevel = Math.abs(deaths) < 0.2;
  let sentence: string;
  if (soulsLevel && deathsLevel) sentence = `Against ${name} both souls and deaths come out level.`;
  else if (soulsLevel)
    sentence =
      deaths < 0
        ? `Souls come out level against ${name}, but it dies ${fixed(-deaths, 1)} fewer times a game.`
        : `Souls come out level against ${name} while it dies ${fixed(deaths, 1)} more times a game.`;
  else if (souls > 0)
    sentence = deathsLevel
      ? `Against ${name} it ends ${count(souls)} souls up on level deaths.`
      : deaths < 0
        ? `Against ${name} it ends ${count(souls)} souls up and dies ${fixed(-deaths, 1)} fewer times a game.`
        : `Against ${name} it out-farms by ${count(souls)} souls a game and pays for it with ${fixed(deaths, 1)} more deaths.`;
  else
    sentence = deathsLevel
      ? `Against ${name} it finishes ${count(-souls)} souls down on level deaths.`
      : deaths < 0
        ? `Against ${name} it finishes ${count(-souls)} souls down and still dies ${fixed(-deaths, 1)} fewer times a game.`
        : `${name} finishes ${count(-souls)} souls ahead of it and dies ${fixed(deaths, 1)} fewer times a game.`;
  const obj = row.objDamage - row.enemyObjDamage;
  if (row.objDamage > 0 && Math.abs(obj) >= 0.05 * row.objDamage) {
    sentence +=
      obj > 0
        ? ` It also puts ${count(obj)} more damage into objectives in that matchup.`
        : ` It puts ${count(-obj)} less damage into objectives than ${name} does.`;
  }
  return sentence;
}

function headToHead(input: HeroNarrativeInput): Section | null {
  const qualified = rankedOpponents(input);
  if (!qualified) return null;
  const byEnemy = new Map(input.counters.filter((c) => c.matches > 0).map((c) => [c.enemyId, c]));
  if (byEnemy.size === 0) return null;
  const first = qualified[0] as Opponent;
  const last = qualified[qualified.length - 1] as Opponent;
  const busiest = [...qualified].sort((a, b) => b.matches - a.matches)[0] as Opponent;
  const lines = [first, last]
    .filter((o, i, arr) => arr.indexOf(o) === i)
    .map((o) => {
      const row = byEnemy.get(o.id);
      return row ? counterLine(input, o, row) : null;
    })
    .filter((s): s is string => s != null);
  const busiestRow = busiest === first || busiest === last ? null : byEnemy.get(busiest.id);
  if (busiestRow) {
    lines.push(
      `${input.heroName(busiest.id)} is the opponent it meets most, ${count(busiest.matches)} games at ${pct(busiest.wr)}. ` +
        counterLine(input, busiest, busiestRow),
    );
  }
  if (lines.length === 0) return null;
  return { heading: 'Head to head', paras: [[lines.join(' ')]] };
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
  const seg = (s: HeroSynergy): Seg[] => [heroSeg(input.roster, s.partnerId, input.heroName(s.partnerId)), ` (${pct(s.winRate)})`];
  const p: Para = [`On the same team, ${name} wins most often alongside `, ...joinSegs(top.map(seg)), `. `];
  if (top.includes(common)) {
    p.push(`${input.heroName(common.partnerId)} is also its most common partner, at ${count(common.matches)} games together.`);
  } else {
    p.push(
      `Its most common partner is `,
      heroSeg(input.roster, common.partnerId, input.heroName(common.partnerId)),
      ` (${count(common.matches)} games together, ${pct(common.winRate)}), a pairing chosen more for comfort than for its results.`,
    );
  }
  const weakest = qualified[qualified.length - 1];
  if (weakest && weakest !== common && !top.includes(weakest) && weakest.winRate < 50) {
    p.push(
      ` The duo to avoid is `,
      heroSeg(input.roster, weakest.partnerId, input.heroName(weakest.partnerId)),
      `, ${pct(weakest.winRate)} over ${count(weakest.matches)} games together.`,
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
  const list = rows.map((r) => `${pct(r.wr)} at ${r.label} (${ordinal(r.rank)} of ${r.n}, ${count(r.picks)} games)`).join('; ');
  const rates = rows.map((r) => r.wr);
  const peak = rows[rates.indexOf(Math.max(...rates))] as NonNullable<(typeof rows)[number]>;
  const dip = rows[rates.indexOf(Math.min(...rates))] as NonNullable<(typeof rows)[number]>;
  const rising = rates.every((v, i) => i === 0 || v >= (rates[i - 1] as number));
  const falling = rates.every((v, i) => i === 0 || v <= (rates[i - 1] as number));
  const swing = Math.max(...rates) - Math.min(...rates);
  let lead: string;
  //Same 1.5-point threshold the trend sentence below uses, so the two never disagree.
  if (swing < 1.5) lead = `${name} holds its rate across the ladder`;
  else if (rising) lead = `${name} wins more the higher the bracket goes`;
  else if (falling) lead = `${name} wins less the higher the bracket goes`;
  else if (peak !== rows[0] && peak !== rows[rows.length - 1]) lead = `${name} peaks at ${peak.label}`;
  else lead = `${name} bottoms out at ${dip.label}`;
  const p1: Para = [`${lead}: ${list}.`];

  const overall = input.hero.win_rate;
  if (overall != null) {
    const best = rows.reduce((a, b) => (b.wr - overall > a.wr - overall ? b : a));
    const worst = rows.reduce((a, b) => (b.wr - overall < a.wr - overall ? b : a));
    const up = best.wr - overall;
    const down = worst.wr - overall;
    if (Math.max(Math.abs(up), Math.abs(down)) >= 0.5 && best !== worst) {
      if (up > 0 && down < 0)
        p1.push(
          ` Set against its ${pct(overall)} overall, that is ${fixed(up, 1)} points better at ${best.label} and ${fixed(-down, 1)} worse at ${worst.label}.`,
        );
      else if (down >= 0)
        p1.push(
          ` It clears its ${pct(overall)} overall in every bracket, by ${fixed(up, 1)} points at ${best.label} and ${fixed(down, 1)} at ${worst.label}.`,
        );
      else
        p1.push(
          ` It sits under its ${pct(overall)} overall in every bracket, ${fixed(-down, 1)} points down at ${worst.label} and ${fixed(-up, 1)} at ${best.label}.`,
        );
    }
  }
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
  const upstream = input.counters.length > 0 ? 'Duo synergies and the head-to-head stat lines come' : 'Duo synergies come';
  p.push(
    `${upstream} from the upstream deadlock-api.com feed rather than RankLock's database. Win rates are shares of games won, never MMR; the `,
    link('methodology', '/methodology/'),
    ` page explains each table.`,
  );
  return { heading: 'About these numbers', paras: [p] };
}

export function heroNarrative(input: HeroNarrativeInput): Section[] {
  return [
    performance(input),
    kit(input),
    matchups(input),
    headToHead(input),
    partners(input),
    items(input),
    byRank(input),
    about(input),
  ].filter((s): s is Section => s != null);
}
