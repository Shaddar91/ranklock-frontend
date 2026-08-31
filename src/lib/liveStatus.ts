//Composes the home "Live meta snapshot" line; "offline" only on a genuine failure with no baked snapshot.
import { isComputing, isDisabled } from './apiClient';

export type ProbePhase = 'pending' | 'ok' | 'error';

export interface LiveStatusInput {
  phase: ProbePhase;
  hasSnapshot: boolean;
  error?: unknown;
  status?: string;
}

export interface LiveStatusLine {
  text: string;
  className: 'ok' | 'muted';
}

export function liveStatusLine(input: LiveStatusInput): LiveStatusLine {
  const { phase, hasSnapshot, error, status } = input;
  if (phase === 'pending') return { text: 'Checking API…', className: 'muted' };
  if (phase === 'ok') return { text: `API reachable — status: ${status ?? 'ok'}`, className: 'ok' };
  if (isDisabled(error)) return { text: 'API unavailable (analytics disabled) — the site renders without it.', className: 'muted' };
  if (isComputing(error)) return { text: 'API unavailable (computing) — the site renders without it.', className: 'muted' };
  //a real network/5xx failure only labels the panel "offline" when the build baked no rows either.
  return hasSnapshot
    ? { text: 'Showing the latest snapshot.', className: 'muted' }
    : { text: 'API unavailable (offline) — the site renders without it.', className: 'muted' };
}
