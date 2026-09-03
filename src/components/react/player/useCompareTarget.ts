//React hook for lib/compareTarget.ts, URL-backed like useMatchMode/useGameMode: ComparePanel's
//"Compare to" selector reads/writes ?target= so a reload or a shared link keeps the same
//comparison pinned instead of resetting to "Your rank" (F1, 08-frontend-verdict.md).
import { useCallback, useSyncExternalStore } from 'react';
import {
  COMPARE_TARGET_CHANGE_EVENT,
  COMPARE_TARGET_PARAM,
  compareTargetFromParam,
  compareTargetToParam,
  DEFAULT_COMPARE_TARGET,
} from '../../../lib/compareTarget';

function readFromUrl(): string {
  if (typeof window === 'undefined') return DEFAULT_COMPARE_TARGET;
  return compareTargetFromParam(new URLSearchParams(window.location.search).get(COMPARE_TARGET_PARAM));
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(COMPARE_TARGET_CHANGE_EVENT, onChange);
  window.addEventListener('popstate', onChange);
  return () => {
    window.removeEventListener(COMPARE_TARGET_CHANGE_EVENT, onChange);
    window.removeEventListener('popstate', onChange);
  };
}

const getServerSnapshot = (): string => DEFAULT_COMPARE_TARGET;

export interface CompareTargetControl {
  target: string;
  setTarget: (next: string) => void;
}

export function useCompareTarget(): CompareTargetControl {
  const target = useSyncExternalStore(subscribe, readFromUrl, getServerSnapshot);

  const setTarget = useCallback((next: string) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const param = compareTargetToParam(next);
    if (param === null) url.searchParams.delete(COMPARE_TARGET_PARAM);
    else url.searchParams.set(COMPARE_TARGET_PARAM, param);
    window.history.replaceState(window.history.state, '', url.toString());
    window.dispatchEvent(new Event(COMPARE_TARGET_CHANGE_EVENT));
  }, []);

  return { target, setTarget };
}
