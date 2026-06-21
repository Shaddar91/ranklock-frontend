//Leaderboard island (mount with client:load on /leaderboard).
//
//Top-3 podium strip + the ranked table below, with Next/Prev paging. SSG-friendly:
//the page bakes page 1 of the default band as initialRows so the server render
//holds the real ladder (SEO without JS). The rank-band filter is SERVER-DRIVEN —
//a band sends min_badge/max_badge (badge tiers, labelled by rank emblem, never
//MMR) and offset/limit page the ladder; both ride in the React Query key.
import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../lib/apiClient';
import QueryProvider from './QueryProvider';
import { DataTable, type DataTableColumn, Icon, RankBadge, WinBar } from './ui/index';
import BucketFilter from './ui/BucketFilter';
import { badgeRangeForTiers, type RankBucket } from '../../lib/brackets';
import { rankFromBadge, subLabel } from '../../lib/ranks';
import { count, DASH } from '../../lib/format';
import type { LeaderboardEntry } from '../../types/api';

type RankedEntry = LeaderboardEntry & { rank: number };

//Rows per ladder page. Shared with the SSG seed in leaderboard.astro so the
//build-time fetch and the page-1 client query request the same window (its rows
//become React Query's initialData for the default band's first page).
export const LEADERBOARD_PAGE_SIZE = 50;

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
  const [offset, setOffset] = useState(0);

  //Server-driven now. The old path loaded a fixed top-100 and filtered bands
  //CLIENT-SIDE, so picking Oracle/Phantom (tiers 8,9) over a top-100 that is all
  //tier 10/11 showed an empty table. Instead the band sends min_badge/max_badge
  //(badge tiers, not a row filter) and offset/limit page the ladder server-side.
  const band = LEADERBOARD_BUCKETS.find((b) => b.key === bucket);
  const badgeRange = badgeRangeForTiers(band?.tiers ?? []);
  const params: { limit: number; offset: number; min_badge?: number; max_badge?: number } = {
    limit: LEADERBOARD_PAGE_SIZE,
    offset,
    ...(badgeRange ?? {}),
  };

  //offset + band ride in the queryKey (queryKeys.leaderboard spreads params) so
  //every page/band caches separately; keepPreviousData keeps the prior page
  //on-screen for a smooth swap. initialData seeds ONLY the SSG default key (all
  //ranks, page 1) — seeding another page/band with the all-ranks rows is wrong.
  const isDefaultPage = bucket === 'all' && offset === 0;

  const { data, isPending, isError, isPlaceholderData } = useQuery({
    queryKey: queryKeys.leaderboard(params),
    queryFn: () => api.getLeaderboard(params),
    initialData: isDefaultPage ? initialRows : undefined,
    placeholderData: keepPreviousData,
  });

  //# = absolute ladder position for the page/band: page 2 of 50 starts at #51.
  const ranked = useMemo<RankedEntry[]>(
    () => (data ?? []).map((r, i) => ({ ...r, rank: offset + i + 1 })),
    [data, offset],
  );

  //Podium only crowns the first page; deeper pages are a pure table.
  const podium = offset === 0 ? ranked.slice(0, 3) : [];
  const rest = offset === 0 ? ranked.slice(3) : ranked;

  const hasPrev = offset > 0;
  //The endpoint returns a bare array (no total), so a full page implies there may
  //be more and a short page is the last one.
  const hasNext = (data?.length ?? 0) >= LEADERBOARD_PAGE_SIZE;
  const showPager = hasPrev || hasNext;

  function changeBucket(key: RankBucket['key']) {
    setBucket(key);
    setOffset(0); //band change → reset to page 1
  }

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
        <BucketFilter buckets={LEADERBOARD_BUCKETS} value={bucket} onChange={changeBucket} ariaLabel="Leaderboard by rank" />
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
      {showPager && (
        <nav className="between" style={{ marginTop: 16, gap: 12, flexWrap: 'wrap' }} aria-label="Leaderboard pages">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setOffset((o) => Math.max(0, o - LEADERBOARD_PAGE_SIZE))}
            disabled={!hasPrev || isPlaceholderData}
          >
            <Icon name="arrowR" size={13} style={{ transform: 'scaleX(-1)' }} /> Prev
          </button>
          <span className="label-xs tnum" aria-live="polite">
            {ranked.length > 0 ? `Ranks ${count(offset + 1)}–${count(offset + ranked.length)}` : DASH}
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setOffset((o) => o + LEADERBOARD_PAGE_SIZE)}
            disabled={!hasNext || isPlaceholderData}
          >
            Next <Icon name="arrowR" size={13} />
          </button>
        </nav>
      )}
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
