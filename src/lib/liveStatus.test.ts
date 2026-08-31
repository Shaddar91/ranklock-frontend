import { describe, it, expect } from 'vitest';
import { ApiError } from './apiClient';
import { liveStatusLine } from './liveStatus';

//"offline" must fire ONLY on a genuine probe failure with no baked snapshot — a populated
//panel or a healthy 202/501 gate never says "offline" (the false-offline-on-a-live-site bug).

const err = (status: number) => new ApiError(status, 'https://api.test/health', `${status}`);
const netErr = () => new ApiError(0, 'https://api.test/health', 'Network request failed');
const OFFLINE = 'API unavailable (offline) — the site renders without it.';

describe('liveStatusLine', () => {
  it('pending → checking', () => {
    expect(liveStatusLine({ phase: 'pending', hasSnapshot: false })).toEqual({ text: 'Checking API…', className: 'muted' });
  });
  it('ok → reachable, carries the health status', () => {
    expect(liveStatusLine({ phase: 'ok', hasSnapshot: true, status: 'ok' })).toEqual({
      text: 'API reachable — status: ok',
      className: 'ok',
    });
  });
  it('501 disabled is a healthy gate, never "offline"', () => {
    const line = liveStatusLine({ phase: 'error', hasSnapshot: false, error: err(501) });
    expect(line.text).toContain('analytics disabled');
    expect(line.text).not.toContain('offline');
  });
  it('202 computing is a healthy gate, never "offline"', () => {
    const line = liveStatusLine({ phase: 'error', hasSnapshot: false, error: err(202) });
    expect(line.text).toContain('computing');
    expect(line.text).not.toContain('offline');
  });
  it('genuine failure WITH a baked snapshot never says "offline"', () => {
    expect(liveStatusLine({ phase: 'error', hasSnapshot: true, error: err(500) }).text).toBe('Showing the latest snapshot.');
    expect(liveStatusLine({ phase: 'error', hasSnapshot: true, error: netErr() }).text).toBe('Showing the latest snapshot.');
  });
  it('genuine failure with NO snapshot is the ONLY path to "offline"', () => {
    expect(liveStatusLine({ phase: 'error', hasSnapshot: false, error: err(500) }).text).toBe(OFFLINE);
    expect(liveStatusLine({ phase: 'error', hasSnapshot: false, error: netErr() }).text).toBe(OFFLINE);
  });
});
