import { describe, expect, it } from 'vitest';
import {
  ALL_HEROES,
  ROSTER_COLORS,
  ROSTER_MAX,
  addToRoster,
  asAccountId,
  decodeRoster,
  encodeRoster,
  removeFromRoster,
  scopeLabel,
  scopeRoster,
  withColors,
  type RosterEntry,
} from './laneRoster';

const p = (account_id: number, name: string, hero_id: number | null = null): RosterEntry => ({
  account_id,
  name,
  scope: hero_id == null ? ALL_HEROES : { hero_id, hero_name: `Hero ${hero_id}` },
});

describe('roster membership', () => {
  it('keeps add order and hands slot 0 the page accent', () => {
    const slots = withColors([p(1, 'a'), p(2, 'b')]);
    expect(slots.map((s) => s.name)).toEqual(['a', 'b']);
    expect(slots.map((s) => s.color)).toEqual([ROSTER_COLORS[0], ROSTER_COLORS[1]]);
  });

  it('caps at four and refuses the same account twice', () => {
    let r: RosterEntry[] = [];
    for (let i = 1; i <= 6; i++) r = addToRoster(r, p(i, `p${i}`));
    expect(r).toHaveLength(ROSTER_MAX);
    const again = addToRoster([p(1, 'a')], p(1, 'a again'));
    expect(again).toHaveLength(1);
    expect(again.map((x) => x.name)).toEqual(['a']);
  });

  it('removes by id and re-colours the remaining slots by position', () => {
    const r = removeFromRoster([p(1, 'a'), p(2, 'b'), p(3, 'c')], 1);
    expect(r.map((x) => x.account_id)).toEqual([2, 3]);
    expect(withColors(r).map((x) => x.color)).toEqual([ROSTER_COLORS[0], ROSTER_COLORS[1]]);
  });

  it('scopes one player without touching the others', () => {
    const r = scopeRoster([p(1, 'a'), p(2, 'b')], 2, { hero_id: 67, hero_name: 'Paige' });
    expect(r.map((x) => scopeLabel(x.scope))).toEqual(['All heroes', 'Paige']);
  });
});

describe('url round trip', () => {
  it('encodes ids in axis order with the hero scope after a colon', () => {
    expect(encodeRoster([p(104319610, 'Sleep64'), p(103082711, 'Shaddar', 67)])).toBe(
      '104319610,103082711:67',
    );
  });

  it('decodes back to the same slots', () => {
    expect(decodeRoster('104319610,103082711:67')).toEqual([
      { account_id: 104319610, hero_id: null },
      { account_id: 103082711, hero_id: 67 },
    ]);
  });

  it('drops junk, duplicates and anything past the cap', () => {
    expect(decodeRoster('abc,,0,-4')).toEqual([]);
    expect(decodeRoster('104319610,104319610')).toHaveLength(1);
    expect(decodeRoster('1001,1002,1003,1004,1005')).toHaveLength(ROSTER_MAX);
    expect(decodeRoster(null)).toEqual([]);
  });

  it('treats a malformed hero scope as all heroes rather than dropping the player', () => {
    expect(decodeRoster('104319610:notanid')).toEqual([{ account_id: 104319610, hero_id: null }]);
  });
});

describe('asAccountId', () => {
  it('routes an all-digits query to the by-id lookup', () => {
    expect(asAccountId('104319610')).toBe(104319610);
    expect(asAccountId('  103082711 ')).toBe(103082711);
  });

  it('leaves a name to the name search', () => {
    expect(asAccountId('Sleep64')).toBeNull();
    expect(asAccountId('64')).toBeNull();
    expect(asAccountId('')).toBeNull();
  });
});
