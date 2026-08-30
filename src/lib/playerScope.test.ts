import { describe, it, expect } from 'vitest';
import { DEFAULT_SCOPE, scopeCaption, scopeParams, sideScopeText, windowLabel } from './playerScope';

describe('scopeParams', () => {
  it('maps the default scope to an explicit all-heroes hero_id and no window bound', () => {
    expect(scopeParams(DEFAULT_SCOPE)).toEqual({ hero_id: 0 });
  });
  it('maps a games window to last_games', () => {
    expect(scopeParams({ kind: 'games', n: 10, hero_id: 0 })).toEqual({ hero_id: 0, last_games: 10 });
  });
  it('maps a days window to last_days', () => {
    expect(scopeParams({ kind: 'days', n: 30, hero_id: 35 })).toEqual({ hero_id: 35, last_days: 30 });
  });
  it('never mixes the two window params', () => {
    const days = scopeParams({ kind: 'days', n: 7, hero_id: 0 });
    const games = scopeParams({ kind: 'games', n: 25, hero_id: 0 });
    expect(days.last_games).toBeUndefined();
    expect(games.last_days).toBeUndefined();
  });
  it('passes an explicit hero through under every window kind', () => {
    expect(scopeParams({ kind: 'games', n: 'all', hero_id: 35 })).toEqual({ hero_id: 35 });
    expect(scopeParams({ kind: 'games', n: 50, hero_id: 35 })).toEqual({ hero_id: 35, last_games: 50 });
  });
});

describe('windowLabel', () => {
  it('names each scope in words', () => {
    expect(windowLabel({ kind: 'games', n: 'all', hero_id: 0 })).toBe('all loaded');
    expect(windowLabel({ kind: 'games', n: 50, hero_id: 0 })).toBe('last 50 games');
    expect(windowLabel({ kind: 'days', n: 3, hero_id: 0 })).toBe('last 3 days');
  });
});

describe('sideScopeText', () => {
  it('prints count and date span for a side with games', () => {
    const t = sideScopeText('You', { matches: 10, span_from: '2026-08-12T10:00:00Z', span_to: '2026-08-29T18:23:20Z' }, DEFAULT_SCOPE);
    expect(t).toBe('You 10 games (Aug 12–Aug 29)');
  });
  it('states a 0-game days side in the last-N-days phrasing', () => {
    const t = sideScopeText('You', { matches: 0 }, { kind: 'days', n: 30, hero_id: 0 });
    expect(t).toBe('You: 0 games in the last 30 days');
  });
  it('states a 0-game games-side as this window', () => {
    const t = sideScopeText('Sleep64', { matches: 0 }, { kind: 'games', n: 10, hero_id: 0 });
    expect(t).toBe('Sleep64: 0 games in this window');
  });
});

describe('scopeCaption', () => {
  it('prints scope + your count + span when nobody is picked', () => {
    const c = scopeCaption({
      scope: { kind: 'games', n: 10, hero_id: 0 },
      you: { matches: 10, span_from: '2026-08-12T10:00:00Z', span_to: '2026-08-29T18:23:20Z' },
    });
    expect(c).toBe('All heroes · last 10 games · You 10 games (Aug 12–Aug 29)');
  });
  it('prints both sides when a player is picked', () => {
    const c = scopeCaption({
      scope: DEFAULT_SCOPE,
      you: { matches: 26, span_from: '2026-05-24T23:22:51Z', span_to: '2026-07-06T18:23:20Z' },
      themLabel: 'Sleep64',
      them: { matches: 111, span_from: '2026-05-06T20:57:44Z', span_to: '2026-08-20T15:45:15Z' },
    });
    expect(c).toBe('All heroes · all loaded · You 26 games (May 24–Jul 6) · Sleep64 111 games (May 6–Aug 20)');
  });
  it('keeps a 0-game side in the caption instead of dropping it', () => {
    const c = scopeCaption({
      scope: { kind: 'days', n: 30, hero_id: 0 },
      you: { matches: 0 },
      themLabel: 'Sleep64',
      them: { matches: 60 },
    });
    expect(c).toBe('All heroes · last 30 days · You: 0 games in the last 30 days · Sleep64 60 games');
  });
  it('names the hero on an explicit hero pick', () => {
    const c = scopeCaption({
      scope: { kind: 'games', n: 'all', hero_id: 35 },
      heroName: 'Viscous',
      you: { matches: 8 },
    });
    expect(c).toBe('on Viscous · all loaded · You 8 games');
  });
});
