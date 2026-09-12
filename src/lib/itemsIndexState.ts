//Items index page state shared across its three island roots (sticky rank bar, the
//sort presets on the page-head row, the table). Same external-store shape as
//heroBracket: Astro renders each island as its own React tree.
import { useCallback, useSyncExternalStore } from 'react';
import type { BracketValue } from '../components/react/ui/BracketFilter';
import { SORT_PRESETS, type SortSpec } from './itemsIndex';

let bracket: BracketValue = 'all';
let sort: SortSpec = SORT_PRESETS[0]!.sort;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

const DEFAULT_SORT = SORT_PRESETS[0]!.sort;

export function useItemsBracket(): { bracket: BracketValue; setBracket: (next: BracketValue) => void } {
  const value = useSyncExternalStore(
    subscribe,
    () => bracket,
    () => 'all' as BracketValue,
  );
  const setBracket = useCallback((next: BracketValue) => {
    if (next === bracket) return;
    bracket = next;
    emit();
  }, []);
  return { bracket: value, setBracket };
}

export function useItemsSort(): { sort: SortSpec; setSort: (next: SortSpec) => void } {
  const value = useSyncExternalStore(
    subscribe,
    () => sort,
    () => DEFAULT_SORT,
  );
  const setSort = useCallback((next: SortSpec) => {
    if (next.key === sort.key && next.dir === sort.dir) return;
    sort = next;
    emit();
  }, []);
  return { sort: value, setSort };
}
