//Hero Overview arithmetic: matchup/duo folding, the delta-vs-expected column, the
//editorial phase bands and the data-derived "Reading the numbers" paragraph.
//Every rate is derived from wins/matches counts, so no source-scale guessing.
import type { HeroSummary, ItemStat, MatchupEntry, HeroSynergyRow } from '../types/api';

export interface MergedMatchup {
  opponentId: number;
  matches: number;
  wins: number;
  winRate: number;
}

//The unbanded route serves TWO rows per opponent (one per team side); a banded one
//serves a single row. Folding on hero_b_id handles both without a mode flag.
export function mergeMatchups(rows: readonly MatchupEntry[]): MergedMatchup[] {
  const byOpponent = new Map<number, { matches: number; wins: number }>();
  for (const r of rows) {
    const acc = byOpponent.get(r.hero_b_id) ?? { matches: 0, wins: 0 };
    acc.matches += r.matches ?? 0;
    acc.wins += r.hero_a_wins ?? 0;
    byOpponent.set(r.hero_b_id, acc);
  }
  return [...byOpponent.entries()].map(([opponentId, { matches, wins }]) => ({
    opponentId,
    matches,
    wins,
    winRate: matches > 0 ? (wins / matches) * 100 : 0,
  }));
}

//Log5: the rate two heroes with these overall win rates would produce against each
//other if nothing but overall strength mattered. Both inputs and the result are percent.
export function expectedWinRate(heroWr: number, opponentWr: number): number | null {
  const a = heroWr / 100;
  const b = opponentWr / 100;
  if (!(a > 0 && a < 1 && b > 0 && b < 1)) return null;
  const num = a * (1 - b);
  const denom = num + b * (1 - a);
  return denom > 0 ? (num / denom) * 100 : null;
}

export interface MatchupRow extends MergedMatchup {
  name: string;
  iconUrl: string | null;
  delta: number | null;
}

export function matchupRows(
  merged: readonly MergedMatchup[],
  heroWinRate: number | null,
  roster: ReadonlyMap<number, HeroSummary>,
  minMatches = 1,
): MatchupRow[] {
  return merged
    .filter((m) => m.matches >= minMatches)
    .map((m) => {
      const opponent = roster.get(m.opponentId);
      const expected =
        heroWinRate != null && opponent?.win_rate != null
          ? expectedWinRate(heroWinRate, opponent.win_rate)
          : null;
      return {
        ...m,
        name: opponent?.hero_name ?? `Hero ${m.opponentId}`,
        iconUrl: opponent?.icon_url ?? null,
        delta: expected == null ? null : m.winRate - expected,
      };
    })
    .sort((a, b) => b.winRate - a.winRate);
}

export interface DuoRow {
  partnerId: number;
  name: string;
  iconUrl: string | null;
  matches: number;
  winRate: number;
  delta: number | null;
}

export function duoRows(
  rows: readonly HeroSynergyRow[],
  heroId: number,
  heroWinRate: number | null,
  roster: ReadonlyMap<number, HeroSummary>,
): DuoRow[] {
  return rows
    .flatMap((r) => {
      const partnerId = r.hero_id1 === heroId ? r.hero_id2 : r.hero_id1;
      if (partnerId === heroId || r.matches_played <= 0) return [];
      const partner = roster.get(partnerId);
      const winRate = (r.wins / r.matches_played) * 100;
      //Two allies both winning lifts the pair, so the neutral baseline is the chance
      //at least one of them would have carried it: 1 - (1-a)(1-b).
      const a = heroWinRate == null ? null : heroWinRate / 100;
      const b = partner?.win_rate == null ? null : partner.win_rate / 100;
      const expected = a != null && b != null ? (1 - (1 - a) * (1 - b)) * 100 : null;
      return [
        {
          partnerId,
          name: partner?.hero_name ?? `Hero ${partnerId}`,
          iconUrl: partner?.icon_url ?? null,
          matches: r.matches_played,
          winRate,
          delta: expected == null ? null : winRate - expected,
        },
      ];
    })
    .sort((x, y) => y.winRate - x.winRate);
}

export interface PhaseBand {
  name: string;
  range: string;
  from: number;
  to: number;
}

//Editorial bands, ours — not a game concept. Stated as such wherever they render.
export const PHASE_BANDS: readonly PhaseBand[] = [
  { name: 'Laning', range: '0–10 min', from: 0, to: 10 },
  { name: 'Mid game', range: '10–22 min', from: 10, to: 22 },
  { name: 'Late game', range: '22+ min', from: 22, to: Infinity },
];

export interface PhaseItem {
  itemId: number;
  name: string;
  iconUrl: string | null;
  slotTier: string;
  minute: number;
  winRate: number;
  matches: number;
}

export interface PhaseCard extends PhaseBand {
  items: PhaseItem[];
}

/** The most-bought rows per band by the aggregate's average buy time — the shortlist the
 *  page then resolves to true median minutes before banding for real. */
export function phaseCandidates(rows: readonly ItemStat[], perBand = 8): ItemStat[] {
  const picked = new Map<number, ItemStat>();
  for (const band of PHASE_BANDS) {
    rows
      .filter((r) => {
        const minute = (r.avg_buy_time_s ?? 0) / 60;
        return r.avg_buy_time_s != null && minute >= band.from && minute < band.to;
      })
      .sort((a, b) => (b.matches ?? 0) - (a.matches ?? 0))
      .slice(0, perBand)
      .forEach((r) => picked.set(r.item_id, r));
  }
  return [...picked.values()];
}

/** Most-bought items per editorial band, ranked by matches, capped per phase. Band and
 *  rendered minute come from the same `minuteOf`, so a row never sits outside its own band. */
export function buildPhases(
  rows: readonly ItemStat[],
  slotTier: (itemId: number) => string,
  minuteOf: (row: ItemStat) => number | null,
  perPhase = 4,
): PhaseCard[] {
  return PHASE_BANDS.map((band) => {
    const items = rows
      .flatMap((r) => {
        const minute = minuteOf(r);
        return minute != null && minute >= band.from && minute < band.to ? [{ row: r, minute }] : [];
      })
      .sort((a, b) => (b.row.matches ?? 0) - (a.row.matches ?? 0))
      .slice(0, perPhase)
      .map(({ row, minute }) => ({
        itemId: row.item_id,
        name: row.item_name ?? `Item ${row.item_id}`,
        iconUrl: row.icon_url ?? null,
        slotTier: slotTier(row.item_id),
        minute,
        winRate: row.win_rate ?? 0,
        matches: row.matches ?? 0,
      }));
    return { ...band, items };
  });
}

export interface ReadingInput {
  heroName: string;
  winRate: number | null;
  patchRank: number | null;
  rosterSize: number;
  worstMatchups: readonly { name: string; winRate: number }[];
  bestDuo: { name: string; winRate: number } | null;
  topWinRateItem: { name: string; winRate: number; games: number } | null;
  mostBoughtItem: { name: string; minute: number; pickRate: number | null } | null;
}

/** The §8 editorial panel: sentences built only from figures this page already prints. */
export function readingTheNumbers(input: ReadingInput): string[] {
  const out: string[] = [];
  const n = (v: number, dp = 1) => v.toFixed(dp);
  if (input.winRate != null && input.patchRank != null) {
    out.push(
      `${input.heroName} wins ${n(input.winRate)}% of its games and sits #${input.patchRank} of ${input.rosterSize} by pick count this patch.`,
    );
  }
  if (input.worstMatchups.length > 0) {
    const names = input.worstMatchups.map((m) => m.name);
    const last = names.pop() as string;
    const listed = names.length > 0 ? `${names.join(', ')} and ${last}` : last;
    out.push(
      `Its hardest lanes are ${listed} — the worst of them holds it to ${n(input.worstMatchups[input.worstMatchups.length - 1]?.winRate ?? 0)}%.`,
    );
  }
  if (input.mostBoughtItem) {
    const share =
      input.mostBoughtItem.pickRate == null ? '' : ` in ${n(input.mostBoughtItem.pickRate)}% of its games`;
    out.push(
      `${input.mostBoughtItem.name} is the most bought item${share}, on average around minute ${n(input.mostBoughtItem.minute, 0)}.`,
    );
  }
  if (input.topWinRateItem) {
    out.push(
      `The best-performing item by Wilson lower bound is ${input.topWinRateItem.name} at ${n(input.topWinRateItem.winRate)}% over ${input.topWinRateItem.games.toLocaleString('en-US')} games.`,
    );
  }
  if (input.bestDuo) {
    out.push(`Its strongest duo is ${input.bestDuo.name}, at ${n(input.bestDuo.winRate)}% together.`);
  }
  return out;
}
