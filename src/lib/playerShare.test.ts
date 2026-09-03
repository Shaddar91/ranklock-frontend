import { describe, expect, it } from 'vitest';
import { playerCardUrl, playerSelectionQuery, playerShareUrl, playerSharePath, resolveFrozenWindow } from './playerShare';

describe('playerShareUrl', () => {
  it('builds the canonical share URL for a bare profile', () => {
    expect(playerShareUrl(103082711)).toBe('https://ranklock.app/players/103082711/');
  });

  it('builds the site-relative path', () => {
    expect(playerSharePath(1)).toBe('/players/1/');
  });

  it('omits every default so a plain profile link stays clean', () => {
    expect(playerShareUrl(1, { hero_id: 0, metric: 'souls', view: 'gap' })).toBe('https://ranklock.app/players/1/');
  });

  it('appends the frozen window and a slugged hero', () => {
    expect(playerShareUrl(103082711, { hero_id: 35, from: '2026-08-24', to: '2026-09-03' })).toBe(
      'https://ranklock.app/players/103082711/?hero=viscous&from=2026-08-24&to=2026-09-03',
    );
  });

  it('appends metric, view and an explicit league in a stable order', () => {
    expect(playerShareUrl(1, { metric: 'last_hits', view: 'totals', league: 5 })).toBe(
      'https://ranklock.app/players/1/?metric=last_hits&view=totals&league=5',
    );
  });

  it('encodes an explicit "All ranks" league distinctly from the auto default', () => {
    expect(playerSelectionQuery({ league: null })).toBe('?league=all');
    expect(playerSelectionQuery({ league: undefined })).toBe('');
  });

  it('appends the brawl and ranked axes', () => {
    expect(playerShareUrl(1, { game_mode: 'StreetBrawl', match_mode: 'Ranked' })).toBe('https://ranklock.app/players/1/?mode=brawl&ranked=1');
  });

  it('drops an unpinned/unknown hero rather than emit a bad slug', () => {
    expect(playerSelectionQuery({ hero_id: 999999 })).toBe('');
  });

  it('carries every non-default axis in one stable order', () => {
    const sel = { hero_id: 35, from: '2026-08-24', to: '2026-09-03', metric: 'last_hits' as const, view: 'totals' as const, league: 5, game_mode: 'StreetBrawl' as const, match_mode: 'Ranked' as const };
    expect(playerShareUrl(1, sel)).toBe(
      'https://ranklock.app/players/1/?hero=viscous&from=2026-08-24&to=2026-09-03&metric=last_hits&view=totals&league=5&mode=brawl&ranked=1',
    );
  });
});

describe('playerCardUrl', () => {
  it('points at the og-card service with the same selection query', () => {
    expect(playerCardUrl(103082711, { hero_id: 35, from: '2026-08-24', to: '2026-09-03' })).toBe(
      'https://og.ranklock.app/og/player/103082711.png?hero=viscous&from=2026-08-24&to=2026-09-03',
    );
  });

  it('is the bare card route for a default selection', () => {
    expect(playerCardUrl(1)).toBe('https://og.ranklock.app/og/player/1.png');
  });
});

describe('resolveFrozenWindow', () => {
  const now = new Date('2026-09-03T12:00:00Z');

  it('resolves a days window to an absolute [from, to]', () => {
    expect(resolveFrozenWindow('days', 10, now)).toEqual({ from: '2026-08-24', to: '2026-09-03' });
  });

  it('has no absolute equivalent for a games-count window', () => {
    expect(resolveFrozenWindow('games', 25, now)).toEqual({});
  });

  it('has no window at all for the all-time default', () => {
    expect(resolveFrozenWindow('days', 'all', now)).toEqual({});
    expect(resolveFrozenWindow('games', 'all', now)).toEqual({});
  });
});
