//Unranked/Ranked match_mode selector (ranked-axis 047) — the URL-backed (`?ranked=1`) twin of
//useGameMode; one store so separate island roots stay in lockstep. Unranked default stays out of the
//URL so its API calls are byte-identical to pre-047. Pure URL<->mode mapping lives in matchMode.ts.
import { useCallback, useSyncExternalStore } from 'react';
import type { MatchMode } from '../types/api';
import { DEFAULT_MATCH_MODE, MATCH_MODE_PARAM, matchModeFromParam, matchModeToParam } from './matchMode';

const CHANGE_EVENT = 'ranklock:matchmode';

function readFromUrl(): MatchMode {
  if (typeof window === 'undefined') return DEFAULT_MATCH_MODE;
  return matchModeFromParam(new URLSearchParams(window.location.search).get(MATCH_MODE_PARAM));
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('popstate', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('popstate', onChange);
  };
}

const getSnapshot = (): MatchMode => readFromUrl();
const getServerSnapshot = (): MatchMode => DEFAULT_MATCH_MODE;

export interface MatchModeControl {
  matchMode: MatchMode;
  isRanked: boolean;
  setMatchMode: (next: MatchMode) => void;
}

export function useMatchMode(): MatchModeControl {
  const matchMode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setMatchMode = useCallback((next: MatchMode) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const slug = matchModeToParam(next);
    if (slug === null) url.searchParams.delete(MATCH_MODE_PARAM);
    else url.searchParams.set(MATCH_MODE_PARAM, slug);
    //replaceState (a filter isn't a history entry) + dispatch so the other island roots re-read.
    window.history.replaceState(window.history.state, '', url.toString());
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { matchMode, isRanked: matchMode === 'Ranked', setMatchMode };
}
