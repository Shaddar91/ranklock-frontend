//Compare permalink island: mounted client:only on compare/[a]/[b].astro; reads
//both account ids from the URL and hosts the profile ComparePanel pair
//machinery (PairCompareView) with the pair preloaded.
import { useEffect, useState } from 'react';
import QueryProvider from './QueryProvider';
import { EmptyState } from './ui/index';
import { readComparePair } from '../../lib/compareShare';
import { usePlayer } from './player/usePlayer';
import { usePlayerScope } from './player/usePlayerScope';
import { PlayerScopeControls } from './player/PlayerScopeControls';
import { PairCompareView } from './player/PlayerTabs';

//undefined = not read yet (first client render); null = absent/invalid pair.
function usePairIds(): { a: number; b: number } | null | undefined {
  const [pair, setPair] = useState<{ a: number; b: number } | null | undefined>(undefined);
  useEffect(() => setPair(readComparePair(window.location.pathname)), []);
  return pair;
}

function CompareInner() {
  const pair = usePairIds();
  const { scope, setKind, setN, setHero } = usePlayerScope();
  const aProfile = usePlayer(pair?.a ?? 0);
  const bProfile = usePlayer(pair?.b ?? 0);

  if (pair === undefined) return <p className="muted">Loading…</p>;
  if (pair === null) {
    return (
      <EmptyState
        title="No players in the URL"
        message="A compare link looks like /compare/<your id>/<their id>."
        icon="users"
      />
    );
  }

  const aName = aProfile.data?.steam_name ?? `#${pair.a}`;
  const bName = bProfile.data?.steam_name ?? `#${pair.b}`;

  return (
    <div className="container">
      <div className="panel" style={{ padding: '18px 20px' }}>
        <div className="between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="kicker" style={{ marginBottom: 4 }}>
              Player compare
            </div>
            <h1 className="h-sec" style={{ fontSize: 20 }}>
              <a href={`/players/${pair.a}/`} style={{ color: 'var(--text)', textDecoration: 'none' }}>
                {aName}
              </a>{' '}
              vs{' '}
              <a href={`/players/${pair.b}/`} style={{ color: 'var(--text)', textDecoration: 'none' }}>
                {bName}
              </a>
            </h1>
          </div>
          <PlayerScopeControls scope={scope} onKind={setKind} onN={setN} onHero={setHero} playerId={pair.a} themId={pair.b} />
        </div>
        <PairCompareView
          id={pair.a}
          vsId={pair.b}
          vsName={bName}
          scope={scope}
          youLabel={aName}
          notFoundMessage="These two players have no games to compare in this mode yet."
        />
      </div>
    </div>
  );
}

export default function CompareIsland() {
  return (
    <QueryProvider>
      <CompareInner />
    </QueryProvider>
  );
}
