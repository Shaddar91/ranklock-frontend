import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MATCH_MODE,
  isRankedMode,
  matchModeFromParam,
  matchModeQuery,
  matchModeToParam,
} from './matchMode';

describe('matchModeFromParam — ?ranked= URL value to match_mode', () => {
  it('absent (null/undefined) → Unranked default', () => {
    expect(matchModeFromParam(null)).toBe('Unranked');
    expect(matchModeFromParam(undefined)).toBe('Unranked');
  });
  it('"1" → Ranked', () => expect(matchModeFromParam('1')).toBe('Ranked'));
  it('"ranked" / "true" (case-insensitive, trimmed) → Ranked', () => {
    expect(matchModeFromParam('ranked')).toBe('Ranked');
    expect(matchModeFromParam('RANKED')).toBe('Ranked');
    expect(matchModeFromParam('true')).toBe('Ranked');
    expect(matchModeFromParam(' 1 ')).toBe('Ranked');
  });
  it('"0" / empty / garbage → Unranked (hostile input never selects an unknown mode)', () => {
    expect(matchModeFromParam('0')).toBe('Unranked');
    expect(matchModeFromParam('')).toBe('Unranked');
    expect(matchModeFromParam('unranked')).toBe('Unranked');
    expect(matchModeFromParam('casual')).toBe('Unranked');
  });
});

describe('matchModeToParam — match_mode to canonical URL slug (default omitted)', () => {
  it('Ranked → "1"', () => expect(matchModeToParam('Ranked')).toBe('1'));
  it('Unranked → null (kept out of the URL)', () => expect(matchModeToParam('Unranked')).toBeNull());
});

describe('matchModeQuery — match_mode to the API ?match_mode= value', () => {
  it('Ranked → "Ranked"', () => expect(matchModeQuery('Ranked')).toBe('Ranked'));
  it('Unranked → undefined (param omitted → backend default, byte-identical request)', () =>
    expect(matchModeQuery('Unranked')).toBeUndefined());
});

describe('round-trip — param → mode → param is stable', () => {
  it('Ranked slug round-trips 1 → Ranked → 1', () =>
    expect(matchModeToParam(matchModeFromParam('1'))).toBe('1'));
  it('default round-trips absent → Unranked → no-param', () =>
    expect(matchModeToParam(matchModeFromParam(null))).toBeNull());
});

describe('isRankedMode + DEFAULT_MATCH_MODE', () => {
  it('the default axis is Unranked', () => expect(DEFAULT_MATCH_MODE).toBe('Unranked'));
  it('isRankedMode reflects the mode', () => {
    expect(isRankedMode('Ranked')).toBe(true);
    expect(isRankedMode('Unranked')).toBe(false);
  });
});
