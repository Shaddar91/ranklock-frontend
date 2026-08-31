//3-state ranked filter store (Any/Ranked/Unranked), URL-backed via `?ranked=`. Mirrors useMatchMode's
//useSyncExternalStore pattern and shares its change-event so every `?ranked=` consumer stays in lockstep.
import { useCallback, useSyncExternalStore } from 'react';
import { MATCH_MODE_CHANGE_EVENT, MATCH_MODE_PARAM } from './matchMode';
import { DEFAULT_RANKED_FILTER, rankedFilterFromParam, rankedFilterToParam, type RankedFilter } from './matchesRanked';

function readFromUrl(): RankedFilter {
  if (typeof window === 'undefined') return DEFAULT_RANKED_FILTER;
  return rankedFilterFromParam(new URLSearchParams(window.location.search).get(MATCH_MODE_PARAM));
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(MATCH_MODE_CHANGE_EVENT, onChange);
  window.addEventListener('popstate', onChange);
  return () => {
    window.removeEventListener(MATCH_MODE_CHANGE_EVENT, onChange);
    window.removeEventListener('popstate', onChange);
  };
}

const getSnapshot = (): RankedFilter => readFromUrl();
const getServerSnapshot = (): RankedFilter => DEFAULT_RANKED_FILTER;

export interface RankedFilterControl {
  ranked: RankedFilter;
  setRanked: (next: RankedFilter) => void;
}

export function useMatchesRanked(): RankedFilterControl {
  const ranked = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setRanked = useCallback((next: RankedFilter) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const slug = rankedFilterToParam(next);
    if (slug === null) url.searchParams.delete(MATCH_MODE_PARAM);
    else url.searchParams.set(MATCH_MODE_PARAM, slug);
    //replaceState (a filter isn't a history entry) + dispatch so the other `?ranked=` roots re-read.
    window.history.replaceState(window.history.state, '', url.toString());
    window.dispatchEvent(new Event(MATCH_MODE_CHANGE_EVENT));
  }, []);

  return { ranked, setRanked };
}
