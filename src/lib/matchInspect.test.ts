import { describe, expect, it } from 'vitest';
import {
  endNetWorth,
  hasEconomyTimeline,
  hasItemBuilds,
  playerNetWorthSeries,
  sortInspectPlayers,
  teamNetWorthSeries,
  windowNote,
} from './matchInspect';
import type { MatchInspectItem, MatchInspectPlayer, MatchInspectTimelinePoint } from '../types/api';

function tp(t: number, souls: number): MatchInspectTimelinePoint {
  return { t_seconds: t, souls, last_hits: 0, kills: 0, deaths: 0, assists: 0, player_damage: 0 };
}

function item(over: Partial<MatchInspectItem> = {}): MatchInspectItem {
  return { item_id: 1, item_name: 'X', icon_url: null, bought_s: 60, sold_s: null, ...over };
}

function player(
  over: Partial<MatchInspectPlayer> & { account_id: number; team: number },
): MatchInspectPlayer {
  return {
    steam_name: `player-${over.account_id}`,
    hero_id: 0,
    hero_name: '',
    hero_icon_url: null,
    items: [],
    souls_timeline: [],
    ...over,
  };
}

describe('teamNetWorthSeries — per-sample team totals with carry-forward', () => {
  const players = [
    player({ account_id: 1, team: 0, souls_timeline: [tp(0, 800), tp(180, 4000)] }),
    player({ account_id: 2, team: 0, souls_timeline: [tp(0, 800), tp(180, 3000)] }),
    player({ account_id: 3, team: 1, souls_timeline: [tp(0, 800)] }), // no 180 sample → carried
  ];
  const rows = teamNetWorthSeries(players);

  it('emits one row per distinct sample time, ascending', () => {
    expect(rows.map((r) => r.t)).toEqual([0, 180]);
  });
  it('sums each team at t=0', () => {
    expect(rows[0]).toMatchObject({ t: 0, amber: 1600, sapphire: 800 });
  });
  it('carries a missing later sample forward instead of dropping to zero', () => {
    expect(rows[1]).toMatchObject({ t: 180, amber: 7000, sapphire: 800 });
  });
});

describe('playerNetWorthSeries — one key per player + legend meta', () => {
  it('keys rows on p{account_id} and names the series by hero', () => {
    const { rows, series } = playerNetWorthSeries([
      player({ account_id: 9, team: 1, hero_name: 'Haze', souls_timeline: [tp(0, 500), tp(60, 1500)] }),
    ]);
    expect(series).toEqual([{ key: 'p9', name: 'Haze', team: 1 }]);
    expect(rows).toEqual([{ t: 0, p9: 500 }, { t: 60, p9: 1500 }]);
  });
  it('falls back to the steam name when the hero name is blank', () => {
    const { series } = playerNetWorthSeries([player({ account_id: 7, team: 0, souls_timeline: [tp(0, 1)] })]);
    expect(series[0]?.name).toBe('player-7');
  });
});

describe('windowNote — honest empty-state phrase', () => {
  it('names N when window_days is seeded', () => expect(windowNote(45)).toBe('the last 45 days'));
  it('degrades before migration 051 lands (null)', () => expect(windowNote(null)).toBe('a recent window'));
  it('degrades on a nonsense zero window', () => expect(windowNote(0)).toBe('a recent window'));
});

describe('presence guards', () => {
  it('hasEconomyTimeline is true only when some player has samples', () => {
    expect(hasEconomyTimeline([player({ account_id: 1, team: 0 })])).toBe(false);
    expect(hasEconomyTimeline([player({ account_id: 1, team: 0, souls_timeline: [tp(0, 1)] })])).toBe(true);
  });
  it('hasItemBuilds is true only when some player bought an item', () => {
    expect(hasItemBuilds([player({ account_id: 1, team: 0 })])).toBe(false);
    expect(hasItemBuilds([player({ account_id: 1, team: 0, items: [item()] })])).toBe(true);
  });
});

describe('endNetWorth + sortInspectPlayers', () => {
  it('endNetWorth reads the last sample, 0 when none', () => {
    expect(endNetWorth(player({ account_id: 1, team: 0, souls_timeline: [tp(0, 1), tp(60, 9)] }))).toBe(9);
    expect(endNetWorth(player({ account_id: 1, team: 0 }))).toBe(0);
  });
  it('orders Amber (0) before Sapphire (1), richest first within a team', () => {
    const sap = player({ account_id: 1, team: 1, souls_timeline: [tp(0, 100)] });
    const amberPoor = player({ account_id: 2, team: 0, souls_timeline: [tp(0, 50)] });
    const amberRich = player({ account_id: 3, team: 0, souls_timeline: [tp(0, 90)] });
    expect(sortInspectPlayers([sap, amberPoor, amberRich]).map((p) => p.account_id)).toEqual([3, 2, 1]);
  });
});
