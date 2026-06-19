//============================================================================
//Player profile — the per-user CSR dashboard (C5). ONE Astro island (mounted
//`client:only="react"` on players/[id].astro): the shell is NEVER prerendered
//per id (architecture §4 — users are data, not pages), and NO per-user data is
//ever baked into static HTML. The id is read from the URL at runtime; everything
//is fetched client-side via TanStack Query.
//
//Kept as ONE hydration root (not twenty islands): the header + every tab + every
//chart are plain React children of this single island, composed from
//./player/*. The build-ahead surfaces (radar / soul-curve / coaching / compare)
//empty-state until their analytics endpoints serve — they never white-screen
//(requirements §8.1, success criteria).
//============================================================================
import { useState } from 'react';
import { isNotFound } from '../../lib/apiClient';
import QueryProvider from './QueryProvider';
import { EmptyState } from './ui/index';
import PlayerHeader from './player/PlayerHeader';
import { CategorizedSection, CoachingPanel, EconomyPanel, PlaystyleRadarPanel } from './player/AnalyticsPanels';
import { ComparePanel, HeroLedgerPanel, PerformancePanel, RecentMatchesPanel } from './player/PlayerTabs';
import { usePlayer, usePlayerHeroes, usePlayerId, usePlayerMatches, usePlayerPerformance, useViewer } from './player/usePlayer';
import type { PerformanceResponse } from '../../types/api';

const TABS = ['Overview', 'Matches', 'Performance', 'Heroes', 'Coaching', 'Compare'] as const;
type Tab = (typeof TABS)[number];

//"Top N%" from the most-sampled bracket's served win-rate percentile (null when
///performance hasn't served). win_rate_pct is "better than X%", so top = 100 − X.
function topPercentile(perf: PerformanceResponse | undefined): number | null {
  if (!perf || perf.brackets.length === 0) return null;
  const best = perf.brackets.reduce((a, b) => (b.sample_matches > a.sample_matches ? b : a));
  return best.win_rate_pct == null ? null : Math.max(1, Math.round(100 - best.win_rate_pct));
}

function PlayerProfileInner() {
  const id = usePlayerId();
  const [tab, setTab] = useState<Tab>('Overview');

  //hooks must run unconditionally; pass a harmless 0 until the id resolves and
  //gate the fetch with `enabled` via a stable guard below.
  const accountId = typeof id === 'number' ? id : 0;
  const player = usePlayer(accountId);
  const matches = usePlayerMatches(accountId);
  const heroes = usePlayerHeroes(accountId);
  const performance = usePlayerPerformance(accountId);
  const { viewer } = useViewer();

  if (id === undefined) return <p className="muted">Loading…</p>;
  if (id === null) return <p className="muted">No player id in the URL.</p>;
  if (player.isPending) return <p className="muted">Loading player {id}…</p>;
  if (player.isError) {
    return isNotFound(player.error) ? (
      <EmptyState title={`No data for player ${id} yet`} message="This account hasn't been ingested, or the id is unknown." icon="inbox" />
    ) : (
      <EmptyState title="Couldn't load this player" message="The stats API is unreachable right now — try again shortly." icon="inbox" />
    );
  }

  //recent form: last-10 winner flags, ordered oldest→newest for the strip.
  const formWins = [...(matches.data ?? [])].slice(0, 10).reverse().map((m) => m.winner);
  const isOwner = viewer?.deadlock_account_id != null && viewer.deadlock_account_id === id;

  return (
    <div className="container">
      <PlayerHeader
        player={player.data}
        heroes={heroes.data}
        formWins={formWins}
        topPercentile={topPercentile(performance.data)}
        isOwner={isOwner}
      />

      <div className="tabs" role="tablist" aria-label="Player sections" style={{ marginBottom: 20 }}>
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={'tab' + (tab === t ? ' on' : '')} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="grid">
          <div className="grid" style={{ gridTemplateColumns: '1fr 1.25fr', alignItems: 'start' }}>
            <PlaystyleRadarPanel id={id} />
            <EconomyPanel id={id} />
          </div>
          <CoachingPanel id={id} />
          <CategorizedSection id={id} />
          <div>
            <h2 className="h-sec" style={{ fontSize: 16, margin: '4px 0 12px' }}>
              Recent matches
            </h2>
            <RecentMatchesPanel id={id} />
          </div>
        </div>
      )}

      {tab === 'Matches' && <RecentMatchesPanel id={id} />}
      {tab === 'Performance' && <PerformancePanel id={id} />}
      {tab === 'Heroes' && <HeroLedgerPanel id={id} />}
      {tab === 'Coaching' && (
        <div className="grid">
          <CoachingPanel id={id} />
          <CategorizedSection id={id} />
        </div>
      )}
      {tab === 'Compare' && <ComparePanel id={id} />}
    </div>
  );
}

export default function PlayerProfileIsland() {
  return (
    <QueryProvider>
      <PlayerProfileInner />
    </QueryProvider>
  );
}
