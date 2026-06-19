import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, queryKeys, isNotFound } from '../../lib/apiClient';
import QueryProvider from './QueryProvider';

//CSR per-user island (mounted with `client:only="react"` on players/[id].astro).
//It reads the account id from the URL at runtime — the shell is NEVER prebuilt
//per id (architecture §4 / mental-model #3: users are data, not pages). Guards
//the zero-match `win_rate.toFixed()` crash class flagged in requirements §A.6.
function readPlayerId(): number | null {
  if (typeof window === 'undefined') return null;
  const match = window.location.pathname.match(/\/players\/(\d+)/);
  return match ? Number(match[1]) : null;
}

function PlayerProfileInner() {
  const [accountId, setAccountId] = useState<number | null>(null);
  useEffect(() => {
    setAccountId(readPlayerId());
  }, []);

  const { data, isPending, isError, error } = useQuery({
    queryKey: accountId != null ? queryKeys.player(accountId) : ['player', 'pending'],
    queryFn: () => api.getPlayer(accountId as number),
    enabled: accountId != null,
  });

  if (accountId == null) return <p className="muted">No player id in the URL.</p>;
  if (isPending) return <p className="muted">Loading player {accountId}…</p>;
  if (isError) {
    if (isNotFound(error)) return <p className="muted">No data for player {accountId} yet.</p>;
    return <p className="muted">Couldn’t load player {accountId} — try again later.</p>;
  }

  const winRate = data.win_rate != null ? `${data.win_rate.toFixed(1)}%` : '—';
  return (
    <section className="panel">
      <p className="kicker">PLAYER PROFILE</p>
      <h1 className="h-hero">{data.steam_name}</h1>
      <p className="tnum">
        {data.matches ?? 0} matches · {winRate} win rate
      </p>
      <p className="muted">Recent form: {data.recent_form.label}</p>
    </section>
  );
}

export default function PlayerProfileIsland() {
  return (
    <QueryProvider>
      <PlayerProfileInner />
    </QueryProvider>
  );
}
