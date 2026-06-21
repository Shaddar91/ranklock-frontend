//============================================================================
//Global Normal/Brawl game-mode selector (migration 022 — game-mode separation).
//
//ONE source of truth for "which game mode are the aggregate surfaces showing",
//backed by the URL (`?mode=normal|brawl`) so a mode is SHAREABLE (paste the link,
//get the same view) and SURVIVES navigation. The URL — not React state — is the
//store because Astro renders each island as its OWN React root: the header toggle
//and the heroes/items/leaderboard/patches tables are SEPARATE trees that cannot
//share context. They stay in lockstep by all reading the same external store (the
//URL) via `useSyncExternalStore` and re-reading on a shared change event.
//
//SSG/hydration-safe: `getServerSnapshot` returns the default (`Normal`) so the
//build-time/server render is deterministic and matches a no-`?mode` first paint
//(no hydration flash for the default). A `?mode=brawl` deep-link re-reads on mount
//and the islands refetch via their mode-keyed queries — correct, not a flash of
//Normal-data-under-a-Brawl-URL (the query key carries the mode, so the Normal
//`initialData` seed simply doesn't apply).
//============================================================================
import { useCallback, useSyncExternalStore } from 'react';
import type { GameMode } from '../types/api';

//The URL slug is short + lowercase (shareable, clean); the API value is the
//canonical backend name. `normal` is the default and is kept OUT of the URL so a
//default view has a clean, canonical link.
export type GameModeSlug = 'normal' | 'brawl';

export const DEFAULT_MODE: GameMode = 'Normal';

const PARAM = 'mode';
//Dispatched on every in-tab `setMode` so the OTHER island roots re-read the store
//(a plain history.replaceState fires no event of its own).
const CHANGE_EVENT = 'ranklock:gamemode';

const MODE_TO_SLUG: Record<GameMode, GameModeSlug> = { Normal: 'normal', StreetBrawl: 'brawl' };

//Parse a URL slug → API value. Anything that isn't the explicit `brawl` slug
//(absent, `normal`, or garbage) resolves to the Normal default — a hostile/typo'd
//`?mode=` can never select a non-competitive or unknown mode.
function modeFromSlug(slug: string | null): GameMode {
  return slug === 'brawl' ? 'StreetBrawl' : 'Normal';
}

function readModeFromUrl(): GameMode {
  if (typeof window === 'undefined') return DEFAULT_MODE;
  return modeFromSlug(new URLSearchParams(window.location.search).get(PARAM));
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  //CHANGE_EVENT = same-tab toggles; popstate = back/forward nav that changes ?mode.
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('popstate', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('popstate', onChange);
  };
}

//Snapshots return one of two interned string literals, so `Object.is` is stable
//across reads with no `?mode` change — useSyncExternalStore won't loop.
const getSnapshot = (): GameMode => readModeFromUrl();
const getServerSnapshot = (): GameMode => DEFAULT_MODE;

export interface GameModeControl {
  mode: GameMode;
  slug: GameModeSlug;
  setMode: (next: GameMode) => void;
}

//Read the active mode and a setter that rewrites `?mode=` in place (no nav) and
//notifies every other island root. Default mode is kept out of the URL so a
//`Normal` view links cleanly; `Brawl` adds `?mode=brawl`.
export function useGameMode(): GameModeControl {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setMode = useCallback((next: GameMode) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (next === DEFAULT_MODE) url.searchParams.delete(PARAM);
    else url.searchParams.set(PARAM, MODE_TO_SLUG[next]);
    //replaceState (not push) — flipping the mode is a filter, not a new history
    //entry to back-button through. Preserve any existing history state object.
    window.history.replaceState(window.history.state, '', url.toString());
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { mode, slug: MODE_TO_SLUG[mode], setMode };
}
