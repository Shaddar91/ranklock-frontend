import { describe, expect, it } from 'vitest';
import {
  buildNarrative,
  buyOrderByPos,
  dedupeSetItems,
  itemTotals,
  rankedSets,
  setLabel,
  sumMatchupBrackets,
  type BuildNarrativeInput,
} from './buildNarrative';
import { plainText } from './narrative';
import type {
  BuildStatsBuyOrderRow,
  BuildStatsItemSet,
  HeroSummary,
  MatchupEntry,
  ScoredBuild,
} from '../types/api';

const mk = (id: number, name: string, wr: number | null, picks: number): HeroSummary => ({
  hero_id: id, hero_name: name, icon_url: null, picks, win_rate: wr,
  avg_kills: 6, avg_deaths: 6, avg_assists: 8, avg_net_worth: 40000, avg_duration_s: null,
});
const roster = [
  mk(1, 'Abrams', 49, 900000), mk(2, 'Seven', 55.9, 1900000), mk(3, 'Bebop', 50.5, 1200000),
  mk(4, 'Haze', 52.6, 2000000), mk(5, 'Lash', 50.8, 600000), mk(6, 'Wraith', 47, 300000),
  mk(7, 'Kelvin', 51, 700000), mk(8, 'Dynamo', 48.5, 500000),
];
const names = new Map(roster.map((h) => [h.hero_id, h.hero_name]));
const haze = roster[3] as HeroSummary;

const item = (id: number, name: string) => ({ item_id: id, item_name: name, icon_url: null });
const set = (ids: [number, string][], games: number, win_rate: number, wilson_lower: number): BuildStatsItemSet => ({
  items: ids.map(([id, n]) => item(id, n)), games, wins: Math.round(games * win_rate), win_rate, wilson_lower,
});
const buy = (pos: number, id: number, name: string, games: number, win_rate: number, wilson_lower: number): BuildStatsBuyOrderRow => ({
  ...item(id, name), pos, games, wins: Math.round(games * win_rate), win_rate, wilson_lower,
});

const SETS: BuildStatsItemSet[] = [
  set([[10, 'Fixation'], [10, 'Fixation'], [11, 'Swift Striker'], [12, 'Extra Spirit'], [13, 'Smoke Bomb'], [14, 'Sleep Dagger']], 671, 0.548, 0.51),
  set([[10, 'Fixation'], [11, 'Swift Striker'], [11, 'Swift Striker'], [15, 'Headshot Booster'], [13, 'Smoke Bomb'], [16, 'Mystic Burst']], 5928, 0.521, 0.505),
  set([[17, 'Berserker'], [11, 'Swift Striker'], [18, 'Tesla Bullets'], [19, 'Soul Shredder'], [20, 'Glass Cannon'], [21, 'Ricochet']], 200, 0.60, 0.49),
];
const BUY: BuildStatsBuyOrderRow[] = [
  buy(1, 10, 'Fixation', 16452, 0.486, 0.478), buy(1, 14, 'Sleep Dagger', 474, 0.50, 0.455),
  buy(2, 11, 'Swift Striker', 14000, 0.52, 0.514), buy(3, 15, 'Headshot Booster', 9000, 0.515, 0.508),
];
const WR = [
  { item_id: 10, item_name: 'Fixation', games: 40000, win_rate: 0.49 },
  { item_id: 11, item_name: 'Swift Striker', games: 60000, win_rate: 0.53 },
  { item_id: 13, item_name: 'Smoke Bomb', games: 30000, win_rate: 0.505 },
  { item_id: 99, item_name: 'Escalating Exposure', games: 20000, win_rate: 0.62 },
];
const scored = (over: Partial<ScoredBuild> = {}): ScoredBuild => ({
  hero_id: 4, hero_build_id: 1, name: 'b3 | NEW META', author_account_id: 118, author_name: 'back3p',
  version: 34, num_favorites: null, num_weekly_favorites: 17027, last_updated_timestamp: 1774604162,
  categories: [{ name: 'Early', description: '', items: [{ item_id: 10 }, { item_id: 11 }] }],
  score: { kind: 'item_average', win_rate: 0.5107, games: 40674143, coverage: { covered: 6, total: 6 }, label: "Core items' average win rate: 51.1% (6 of 6 items covered)" },
  ...over,
});
//Real shape: bracket 0 double-counts, so the page sums buckets 1-5 instead.
const mu = (b: number, matches: number, wins: number): MatchupEntry => ({ hero_b_id: b, matches, hero_a_wins: wins, win_rate: wins / matches });

function input(over: Partial<BuildNarrativeInput> = {}): BuildNarrativeInput {
  return {
    hero: haze, roster, itemSets: SETS, buyOrder: BUY, itemWinRates: WR, builds: [scored()],
    matchups: [mu(1, 400000, 200000), mu(2, 300000, 120000), mu(6, 250000, 140000), mu(7, 220000, 110000)],
    heroName: (id) => names.get(id) ?? `Hero ${id}`,
    ...over,
  };
}

describe('dedupeSetItems', () => {
  it('folds an ability taken twice into one row with a multiplier', () => {
    const out = dedupeSetItems((SETS[0] as BuildStatsItemSet).items);
    expect(out).toHaveLength(5);
    expect(out[0]).toMatchObject({ item_id: 10, n: 2 });
    expect(out[1]).toMatchObject({ item_id: 11, n: 1 });
  });
  it('keeps first-appearance order', () => {
    expect(dedupeSetItems((SETS[1] as BuildStatsItemSet).items).map((i) => i.item_id)).toEqual([10, 11, 15, 13, 16]);
  });
});

describe('setLabel', () => {
  it('marks a repeat with x2 and leaves singles bare', () => {
    expect(setLabel((SETS[0] as BuildStatsItemSet).items)).toBe(
      'Fixation x2, Swift Striker, Extra Spirit, Smoke Bomb, Sleep Dagger',
    );
  });
});

describe('rankedSets', () => {
  it('orders by wilson_lower, not raw win rate', () => {
    const out = rankedSets(SETS);
    expect(out.map((s) => s.games)).toEqual([671, 5928, 200]);
    //the 200-game 60% set has the highest win_rate and the lowest wilson_lower — it must sort last
    expect(out[out.length - 1]?.win_rate).toBe(0.6);
  });
  it('drops sets with no games', () => {
    expect(rankedSets([...SETS, set([[1, 'X']], 0, 0, 0)])).toHaveLength(3);
  });
});

describe('buyOrderByPos', () => {
  it('groups by slot ascending with the highest wilson_lower first in each', () => {
    const out = buyOrderByPos(BUY);
    expect(out.map((p) => p.pos)).toEqual([1, 2, 3]);
    expect(out[0]?.rows.map((r) => r.item_id)).toEqual([10, 14]);
  });
});

describe('sumMatchupBrackets', () => {
  it('adds matches and wins across buckets and recomputes the rate', () => {
    const out = sumMatchupBrackets([[mu(1, 100, 60)], [mu(1, 100, 40)]], 4);
    expect(out).toEqual([{ hero_b_id: 1, matches: 200, hero_a_wins: 100, win_rate: 0.5 }]);
  });
  it('drops the self-matchup row three heroes ship', () => {
    expect(sumMatchupBrackets([[mu(4, 2, 1), mu(1, 100, 60)]], 4).map((r) => r.hero_b_id)).toEqual([1]);
  });
});

describe('buildNarrative', () => {
  it('emits all five sections when every input is present', () => {
    expect(buildNarrative(input()).map((s) => s.heading)).toEqual([
      'What wins on Haze', "Haze's core items", 'What gets bought first',
      'What the community publishes', 'Where the matchup gives room',
    ]);
  });

  it('drops the sections whose inputs are missing, keeping the opening', () => {
    const out = buildNarrative(input({ itemSets: [], buyOrder: [], builds: [], matchups: [] }));
    expect(out.map((s) => s.heading)).toEqual(['What wins on Haze']);
    expect(plainText(out)).toContain('has not folded a finished Haze set');
  });

  it('names the top set and its lift over the hero baseline', () => {
    const text = plainText(buildNarrative(input()));
    expect(text).toContain('Fixation');
    expect(text).toContain('671 games');
    //54.8% set against a 52.6% hero baseline = 2.2 points of lift
    expect(text).toContain('2.2 points above');
  });

  it('reads a set below the hero baseline as the hero carrying the build', () => {
    const flat = [set([[10, 'Fixation'], [11, 'Swift Striker'], [12, 'Extra Spirit'], [13, 'Smoke Bomb'], [14, 'Sleep Dagger'], [15, 'Headshot Booster']], 900, 0.50, 0.47)];
    expect(plainText(buildNarrative(input({ itemSets: flat })))).toContain('carrying its common builds');
  });

  it('calls slot 1 contested when the top two are inside a point', () => {
    //48.6% vs 50.0% is 1.4 points apart, so this fixture is NOT contested
    expect(plainText(buildNarrative(input()))).toContain('Slot 1 is not close');
    const close = [buy(1, 10, 'Fixation', 16452, 0.486, 0.478), buy(1, 14, 'Sleep Dagger', 9000, 0.49, 0.482), buy(2, 11, 'Swift Striker', 14000, 0.52, 0.514), buy(3, 15, 'Headshot Booster', 9000, 0.515, 0.508)];
    expect(plainText(buildNarrative(input({ buyOrder: close })))).toContain('Slot 1 is contested');
  });

  it('reads a single published build differently from several', () => {
    expect(plainText(buildNarrative(input()))).toContain('One published Haze build');
    const many = [scored(), scored({ hero_build_id: 2, name: 'Second', author_name: null, author_account_id: 777 })];
    const text = plainText(buildNarrative(input({ builds: many })));
    expect(text).toContain('2 published Haze builds');
    expect(text).toContain('credited by account id');
  });

  it('renders the upstream score label verbatim and never relabels it', () => {
    const text = plainText(buildNarrative(input()));
    expect(text).toContain("Core items' average win rate: 51.1% (6 of 6 items covered)");
    expect(text).not.toMatch(/build['’]s win rate/i);
  });

  it('falls back to the account id when upstream publishes no author name', () => {
    const text = plainText(buildNarrative(input({ builds: [scored({ author_name: null, author_account_id: 4242 })] })));
    expect(text).toContain('Account 4242');
  });

  it('names matchups by residual against the expected head-to-head, not raw win rate', () => {
    const text = plainText(buildNarrative(input()));
    //Raw best is Wraith at 56.0%, but expected there is 50+52.6-47 = 55.6, so its residual is only +0.4.
    //Seven: actual 40.0 against an expected 50+52.6-55.9 = 46.7, residual -6.7 — the worst return.
    expect(text).toContain("the two heroes' overall win rates predict");
    expect(text).toContain('Its worst return is into Seven');
    //a 6.7-point residual must not be described as small
    expect(text).toContain('past what the ratings explain');
    expect(text).not.toContain('counter-pick');
  });

  it('calls small residuals what they are rather than counter-picks', () => {
    //every actual within 1.5 points of its predicted head-to-head
    const even = [mu(1, 400000, 214400), mu(2, 300000, 141600), mu(6, 250000, 140000), mu(7, 220000, 110440)];
    const text = plainText(buildNarrative(input({ matchups: even })));
    expect(text).toContain('Neither is large enough to call a counter-pick');
  });

  it('drops matchup opponents below the 2%-of-max game floor', () => {
    const thin = [mu(1, 400000, 200000), mu(2, 300000, 120000), mu(6, 100, 60)];
    const text = plainText(buildNarrative(input({ matchups: thin })));
    //only two opponents qualify, below the three the section needs
    expect(text).not.toContain('Where the matchup gives room');
  });

  it('produces different section sets for a thin hero and a full one', () => {
    const thin = buildNarrative(input({ hero: roster[5] as HeroSummary, itemSets: [], buyOrder: [], builds: [] }));
    const full = buildNarrative(input());
    expect(thin.length).not.toBe(full.length);
  });
});

describe('itemTotals', () => {
  it('sums buys across every slot an item appears at and reweights the rate', () => {
    const t = itemTotals([buy(1, 10, 'Fixation', 100, 0.4, 0.3), buy(2, 10, 'Fixation', 300, 0.6, 0.5)]);
    expect(t.get(10)).toEqual({ buys: 400, winRate: 55.00000000000001 });
  });
});

describe('coreItems figures', () => {
  it('quotes buy_order, so an ability with no item-win-rate row still gets a number', () => {
    //item 12 is in two sets and in the buy order, but absent from itemWinRates
    const withAbility = [
      buy(1, 12, 'Extra Spirit', 8000, 0.5, 0.49), buy(1, 10, 'Fixation', 16452, 0.486, 0.478),
      buy(2, 11, 'Swift Striker', 14000, 0.52, 0.514), buy(3, 15, 'Headshot Booster', 9000, 0.515, 0.508),
    ];
    const text = plainText(buildNarrative(input({ buyOrder: withAbility })));
    expect(text).toMatch(/Fixation \(2 of 3 sets, 48\.6% across 16,452 buys\)/);
  });
  it('separates the all-games per-item table from the finished-set numbers', () => {
    expect(plainText(buildNarrative(input()))).toContain('Widening to every Haze game rather than the finished sets');
  });
});

describe('spread multiplier', () => {
  it('takes "an" before 8, 11 and 18 and "a" otherwise', () => {
    //200 -> 5,928 is a 29.6x spread
    expect(plainText(buildNarrative(input()))).toContain('a 29.6x spread');
    const eight = [SETS[0] as BuildStatsItemSet, set([[10, 'Fixation'], [11, 'Swift Striker'], [12, 'Extra Spirit'], [13, 'Smoke Bomb'], [14, 'Sleep Dagger'], [15, 'Headshot Booster']], 5400, 0.52, 0.505)];
    expect(plainText(buildNarrative(input({ itemSets: eight })))).toContain('an 8.0x spread');
  });
});
