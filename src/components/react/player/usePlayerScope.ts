//React state for the shared player compare scope (pure model: lib/playerScope.ts).
//Page-local; Games⇄Days restores that kind's last-used preset (Days starts on 30).
import { useRef, useState } from 'react';
import { DEFAULT_SCOPE, type PlayerScope, type PlayerScopeKind } from '../../../lib/playerScope';

//initialHeroId seeds the hero scope from a shared /compare link (0 = all heroes);
//it only sets the FIRST render's hero, after which the picker owns the state.
export function usePlayerScope(initialHeroId = 0) {
  const [scope, setScope] = useState<PlayerScope>(() =>
    initialHeroId > 0 ? { ...DEFAULT_SCOPE, hero_id: initialHeroId } : DEFAULT_SCOPE,
  );
  const lastN = useRef<{ games: number | 'all'; days: number }>({ games: DEFAULT_SCOPE.n, days: 30 });

  const setKind = (kind: PlayerScopeKind) =>
    setScope((s) => {
      if (s.kind === 'games') lastN.current.games = s.n;
      else if (s.n !== 'all') lastN.current.days = s.n;
      return { ...s, kind, n: lastN.current[kind] };
    });

  const setN = (n: number | 'all') => {
    if (scope.kind === 'games') lastN.current.games = n;
    else if (n !== 'all') lastN.current.days = n;
    setScope((s) => ({ ...s, n }));
  };

  const setHero = (hero_id: number) => setScope((s) => ({ ...s, hero_id }));

  return { scope, setKind, setN, setHero };
}
