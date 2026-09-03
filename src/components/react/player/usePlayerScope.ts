//URL-backed player scope (pure model: lib/playerScope.ts) — useSyncExternalStore over
//?kind/?n/?hero, mirroring lib/useGameMode.ts, so the radar, the Compare tab and the
//header's share link all read the ONE store instead of separate useState copies.
import { useCallback, useSyncExternalStore } from 'react';
import {
  DEFAULT_SCOPE,
  SCOPE_CHANGE_EVENT,
  SCOPE_HERO_PARAM,
  SCOPE_KIND_PARAM,
  SCOPE_N_PARAM,
  scopeHeroFromParam,
  scopeHeroToParam,
  scopeKindFromParam,
  scopeKindToParam,
  scopeNFromParam,
  scopeNToParam,
  type PlayerScope,
  type PlayerScopeKind,
} from '../../../lib/playerScope';

function search(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(SCOPE_CHANGE_EVENT, onChange);
  window.addEventListener('popstate', onChange);
  return () => {
    window.removeEventListener(SCOPE_CHANGE_EVENT, onChange);
    window.removeEventListener('popstate', onChange);
  };
}

//Each field is its own primitive useSyncExternalStore snapshot (mirrors useCurveScope.ts) so Object.is stays stable — a composite {kind,n,hero_id} object literal never does (F2).
function getKindSnapshot(): PlayerScopeKind {
  return typeof window === 'undefined' ? DEFAULT_SCOPE.kind : scopeKindFromParam(search().get(SCOPE_KIND_PARAM));
}
function getNSnapshot(): number | 'all' {
  return typeof window === 'undefined' ? DEFAULT_SCOPE.n : scopeNFromParam(search().get(SCOPE_N_PARAM), getKindSnapshot());
}
function getHeroSnapshot(): number {
  return typeof window === 'undefined' ? DEFAULT_SCOPE.hero_id : scopeHeroFromParam(search().get(SCOPE_HERO_PARAM));
}

function writeScope(next: PlayerScope): void {
  const url = new URL(window.location.href);
  const kindParam = scopeKindToParam(next.kind);
  if (kindParam === null) url.searchParams.delete(SCOPE_KIND_PARAM);
  else url.searchParams.set(SCOPE_KIND_PARAM, kindParam);
  const nParam = scopeNToParam(next.n, next.kind);
  if (nParam === null) url.searchParams.delete(SCOPE_N_PARAM);
  else url.searchParams.set(SCOPE_N_PARAM, nParam);
  const heroParam = scopeHeroToParam(next.hero_id);
  if (heroParam === null) url.searchParams.delete(SCOPE_HERO_PARAM);
  else url.searchParams.set(SCOPE_HERO_PARAM, heroParam);
  window.history.replaceState(window.history.state, '', url.toString());
  window.dispatchEvent(new Event(SCOPE_CHANGE_EVENT));
}

//initialHeroId seeds a first render with no `?hero=` yet (CompareIsland, pre-hydration).
export function usePlayerScope(initialHeroId = 0) {
  const kind = useSyncExternalStore(subscribe, getKindSnapshot, () => DEFAULT_SCOPE.kind);
  const n = useSyncExternalStore(subscribe, getNSnapshot, () => DEFAULT_SCOPE.n);
  const rawHero = useSyncExternalStore(subscribe, getHeroSnapshot, () => DEFAULT_SCOPE.hero_id);
  const withSeed = useCallback((h: number): number => (h === 0 && initialHeroId > 0 ? initialHeroId : h), [initialHeroId]);
  const scope: PlayerScope = { kind, n, hero_id: withSeed(rawHero) };

  //Setters re-read fresh (not the closed-over render values) so back-to-back calls in one handler stay correct.
  const setKind = useCallback(
    (nextKind: PlayerScopeKind) => {
      const curKind = getKindSnapshot();
      if (nextKind !== curKind) writeScope({ kind: nextKind, n: nextKind === 'days' ? 30 : DEFAULT_SCOPE.n, hero_id: withSeed(getHeroSnapshot()) });
    },
    [withSeed],
  );
  const setN = useCallback(
    (nextN: number | 'all') => writeScope({ kind: getKindSnapshot(), n: nextN, hero_id: withSeed(getHeroSnapshot()) }),
    [withSeed],
  );
  const setHero = useCallback((nextHero: number) => writeScope({ kind: getKindSnapshot(), n: getNSnapshot(), hero_id: nextHero }), []);

  return { scope, setKind, setN, setHero };
}
