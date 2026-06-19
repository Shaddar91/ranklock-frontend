//Leaderboard island (mount with client:load on /leaderboard).
//
//Top-3 podium strip + the ranked table below. SSG-friendly: the page bakes the
//build-time rows as initialRows so the server render holds the real ladder (SEO
//without JS). The rank-band filter is CLIENT-SIDE (the /leaderboard endpoint
//takes no bracket param) — it filters the loaded rows by badge tier, labelled by
//rank emblem, never MMR.
import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../lib/apiClient';
import QueryProvider from './QueryProvider';
import { DataTable, type DataTableColumn, RankBadge, WinBar } from './ui/index';
import BucketFilter from './ui/BucketFilter';
import type { RankBucket } from '../../lib/brackets';
import { rankFromBadge, subLabel } from '../../lib/ranks';
import { count, DASH } from '../../lib/format';
import type { LeaderboardEntry } from '../../types/api';

type RankedEntry = LeaderboardEntry & { rank: number };

//Leaderboard-specific bands: top players cluster in the upper tiers, so the
//filter offers All + the meaningful high/top bands (rank-emblem labelled).
const LEADERBOARD_BUCKETS: readonly RankBucket[] = [
  { key: 'all', label: 'All ranks', short: 'All', tiers: [] },
  { key: 'high', label: 'Oracle – Phantom', short: 'High', tiers: [8, 9] },
  { key: 'top', label: 'Ascendant – Eternus', short: 'Top', tiers: [10, 11] },
];

const MEDAL = ['var(--gold)', '#cfd6df', '#c08457'];

function Podium({ rows }: { rows: RankedEntry[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="podium-grid" style={{ marginBottom: 18 }}>
      {rows.map((p, i) => {
        const rk = rankFromBadge(p.badge);
        const medal = MEDAL[i] ?? 'var(--brass-edge)';
        return (
          <div key={p.account_id} className="panel top3" style={{ padding: '14px 16px', borderColor: medal + '55' }}>
            <span className="corner tl" style={{ color: medal, opacity: i === 0 ? 'var(--corner-op)' : 0 }} />
            <span className="corner br" style={{ color: medal, opacity: i === 0 ? 'var(--corner-op)' : 0 }} />
            <div className="flex" style={{ alignItems: 'center', gap: 13 }}>
              <div style={{ position: 'relative' }}>
                {rk ? (
                  <RankBadge tier={rk.tier} sub={rk.sub} size={i === 0 ? 52 : 46} glow={i === 0} />
                ) : (
                  <span className="hav" style={{ width: 46, height: 46 }} aria-hidden="true" />
                )}
                <span className="top3-medal display" style={{ color: medal, borderColor: medal + '66' }}>
                  #{p.rank}
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <a
                  href={`/players/${p.account_id}`}
                  className="display"
                  style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}
                >
                  {p.steam_name}
                </a>
                {rk && (
                  <div className="display" style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
                    {subLabel(rk.tier, rk.sub)}
                  </div>
                )}
              </div>
            </div>
            <div className="flex" style={{ marginTop: 12, borderTop: '1px solid var(--border-soft)', paddingTop: 10 }}>
              {[
                ['Win', p.win_rate == null ? DASH : `${p.win_rate.toFixed(1)}%`],
                ['Matches', count(p.matches)],
                ['Wins', count(p.wins)],
              ].map(([l, v]) => (
                <div key={l} style={{ flex: 1, textAlign: 'center' }}>
                  <div className="label-xs" style={{ fontSize: 9.5, marginBottom: 2 }}>
                    {l}
                  </div>
                  <div className="display tnum" style={{ fontSize: 15, fontWeight: 700 }}>
                    {v}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LeaderboardInner({ initialRows }: { initialRows: LeaderboardEntry[] }) {
  const [bucket, setBucket] = useState<RankBucket['key']>('all');

  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.leaderboard({ limit: 100 }),
    queryFn: () => api.getLeaderboard({ limit: 100 }),
    initialData: initialRows,
    placeholderData: keepPreviousData,
  });

  const ranked = useMemo<RankedEntry[]>(() => {
    const all = (data ?? []).map((r, i) => ({ ...r, rank: i + 1 }));
    const band = LEADERBOARD_BUCKETS.find((b) => b.key === bucket);
    if (!band || band.tiers.length === 0) return all;
    return all.filter((r) => {
      const rk = rankFromBadge(r.badge);
      return rk != null && band.tiers.includes(rk.tier);
    });
  }, [data, bucket]);

  const podium = ranked.slice(0, 3);
  const rest = ranked.slice(3);

  const columns = useMemo<DataTableColumn<RankedEntry>[]>(
    () => [
      { key: 'rank', header: '#', numeric: true, sortValue: (r) => r.rank, render: (r) => <span className="rank-num">{r.rank}</span> },
      {
        key: 'player',
        header: 'Player',
        sortValue: (r) => r.steam_name,
        render: (r) => {
          const rk = rankFromBadge(r.badge);
          return (
            <a className="flex" href={`/players/${r.account_id}`} style={{ alignItems: 'center', gap: 10, textDecoration: 'none' }}>
              {rk && <RankBadge tier={rk.tier} size={26} glow={false} />}
              <span className="display" style={{ fontWeight: 600, color: 'var(--text)' }}>
                {r.steam_name}
              </span>
            </a>
          );
        },
      },
      {
        key: 'badge',
        header: 'Rank',
        sortValue: (r) => r.badge,
        render: (r) => {
          const rk = rankFromBadge(r.badge);
          return rk ? <span className="muted">{subLabel(rk.tier, rk.sub)}</span> : <span className="faint">{DASH}</span>;
        },
      },
      { key: 'matches', header: 'Matches', numeric: true, sortValue: (r) => r.matches, render: (r) => <span className="tnum">{count(r.matches)}</span> },
      {
        key: 'wr',
        header: 'Win rate',
        numeric: true,
        sortValue: (r) => r.win_rate,
        render: (r) => (r.win_rate == null ? <span className="faint">{DASH}</span> : <WinBar wr={r.win_rate} />),
      },
      { key: 'wins', header: 'Wins', numeric: true, sortValue: (r) => r.wins, render: (r) => <span className="tnum">{count(r.wins)}</span> },
    ],
    [],
  );

  return (
    <div>
      <div className="between" style={{ marginBottom: 16, gap: 16, flexWrap: 'wrap' }}>
        <span className="label-xs">Global ranked ladder</span>
        <BucketFilter buckets={LEADERBOARD_BUCKETS} value={bucket} onChange={setBucket} ariaLabel="Leaderboard by rank" />
      </div>
      <Podium rows={podium} />
      <DataTable
        columns={columns}
        rows={rest}
        rowKey={(r) => r.account_id}
        loading={isPending}
        initialSort={{ key: 'rank', dir: 1 }}
        caption="Top Deadlock players by rank"
        emptyTitle={isError ? 'Leaderboard unavailable' : 'No players in this band yet'}
        emptyMessage={
          isError
            ? 'The stats API is offline — the ladder fills in when it comes back online.'
            : 'No ranked players for this band yet. Try another bracket or check back after the next data refresh.'
        }
      />
    </div>
  );
}

export default function LeaderboardTable({ initialRows }: { initialRows: LeaderboardEntry[] }) {
  return (
    <QueryProvider>
      <LeaderboardInner initialRows={initialRows} />
    </QueryProvider>
  );
}
