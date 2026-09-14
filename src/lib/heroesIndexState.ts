//Heroes index page state shared across its island roots (sticky rank bar, the sort presets
//on the page-head row, the table). Same external-store shape as itemsIndexState.
import { useCallback, useSyncExternalStore } from 'react';
import type { BracketValue } from '../components/react/ui/BracketFilter';
import type { SortState } from '../components/react/ui/DataTable';

export interface HeroSortPreset {
  key: string;
  label: string;
  sort: SortState;
}

export const HERO_SORT_PRESETS: readonly HeroSortPreset[] = [
  { key: 'wr', label: 'Highest WR', sort: { key: 'wr', dir: -1 } },
  { key: 'pick', label: 'Most picked', sort: { key: 'pick', dir: -1 } },
  { key: 'kda', label: 'Best KDA', sort: { key: 'kda', dir: -1 } },
];

const DEFAULT_SORT: SortState = HERO_SORT_PRESETS[0]!.sort;

let bracket: BracketValue = 'all';
let sort: SortState = DEFAULT_SORT;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function activeHeroPreset(s: SortState): HeroSortPreset | null {
  return HERO_SORT_PRESETS.find((p) => p.sort.key === s.key && p.sort.dir === s.dir) ?? null;
}

export function useHeroesBracket(): { bracket: BracketValue; setBracket: (next: BracketValue) => void } {
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

export function useHeroesSort(): { sort: SortState; setSort: (next: SortState) => void } {
  const value = useSyncExternalStore(
    subscribe,
    () => sort,
    () => DEFAULT_SORT,
  );
  const setSort = useCallback((next: SortState) => {
    if (next.key === sort.key && next.dir === sort.dir) return;
    sort = next;
    emit();
  }, []);
  return { sort: value, setSort };
}
