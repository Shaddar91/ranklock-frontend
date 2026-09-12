//Hero-page rank filter, shared by the sticky FilterBar and the panels below it. NOT
//URL-backed (unlike useGameMode): the brief keeps a rank filter as page state.
import { useCallback, useSyncExternalStore } from 'react';
import type { BracketValue } from '../components/react/ui/BracketFilter';
import { getRank } from './ranks';

//Islands are separate React roots sharing one module instance — this is what syncs them.
let current: BracketValue = 'all';
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

const getSnapshot = (): BracketValue => current;
const getServerSnapshot = (): BracketValue => 'all';

export interface HeroBracketControl {
  bracket: BracketValue;
  setBracket: (next: BracketValue) => void;
}

export function useHeroBracket(): HeroBracketControl {
  const bracket = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setBracket = useCallback((next: BracketValue) => {
    if (next === current) return;
    current = next;
    listeners.forEach((l) => l());
  }, []);
  return { bracket, setBracket };
}

//Analytics bands by PAIRS of tiers — backend brackets.rs bracket_badge_range.
const BANDS: readonly (readonly number[])[] = [[1, 2, 3], [4, 5], [6, 7], [8, 9], [10, 11]];

export function bracketBucket(value: BracketValue): number | undefined {
  if (value === 'all') return undefined;
  const i = BANDS.findIndex((tiers) => tiers.includes(value));
  return i < 0 ? undefined : i + 1;
}

export function servedBandLabel(value: BracketValue): string {
  const bucket = bracketBucket(value);
  if (bucket == null) return 'All ranks';
  const tiers = BANDS[bucket - 1] as readonly number[];
  const lo = getRank(tiers[0] as number).name;
  const hi = getRank(tiers[tiers.length - 1] as number).name;
  return `${lo} – ${hi}`;
}
