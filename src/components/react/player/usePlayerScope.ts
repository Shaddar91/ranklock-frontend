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

function readScope(): PlayerScope {
  if (typeof window === 'undefined') return DEFAULT_SCOPE;
  const q = new URLSearchParams(window.location.search);
  const kind = scopeKindFromParam(q.get(SCOPE_KIND_PARAM));
  return {
    kind,
    n: scopeNFromParam(q.get(SCOPE_N_PARAM), kind),
    hero_id: scopeHeroFromParam(q.get(SCOPE_HERO_PARAM)),
  };
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

const getServerSnapshot = (): PlayerScope => DEFAULT_SCOPE;

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
  const raw = useSyncExternalStore(subscribe, readScope, getServerSnapshot);
  const withSeed = useCallback(
    (s: PlayerScope): PlayerScope => (s.hero_id === 0 && initialHeroId > 0 ? { ...s, hero_id: initialHeroId } : s),
    [initialHeroId],
  );
  const scope = withSeed(raw);

  const setKind = useCallback(
    (kind: PlayerScopeKind) => {
      const cur = withSeed(readScope());
      if (kind !== cur.kind) writeScope({ ...cur, kind, n: kind === 'days' ? 30 : 'all' });
    },
    [withSeed],
  );
  const setN = useCallback((n: number | 'all') => writeScope({ ...withSeed(readScope()), n }), [withSeed]);
  const setHero = useCallback((hero_id: number) => writeScope({ ...withSeed(readScope()), hero_id }), [withSeed]);

  return { scope, setKind, setN, setHero };
}
