//Leaderboard island (mount with client:load on /leaderboard).
//
//Top-3 podium strip + ranked table with URL-backed numbered paging (?page=N).
//SSG-friendly: page 1 of the default band uses initialRows baked at build time.
import { useEffect, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, isComputing, queryKeys } from '../../lib/apiClient';
import { computingMessage } from '../../lib/apiStates';
import { useGameMode } from '../../lib/useGameMode';
import QueryProvider from './QueryProvider';
import { DataTable, type DataTableColumn, Icon, RankBadge, WinBar } from './ui/index';
import BucketFilter from './ui/BucketFilter';
import SearchBox from './SearchBox';
import { badgeRangeForTiers, type RankBucket } from '../../lib/brackets';
import { rankFromBadge, subLabel } from '../../lib/ranks';
import { count, DASH } from '../../lib/format';
import type { LeaderboardEntry } from '../../types/api';
import {
  LEADERBOARD_PAGE_SIZE,
  lastPage,
  offsetFromPage,
  pageFromSearch,
  pagerWindow,
} from '../../lib/leaderboardPager';

type RankedEntry = LeaderboardEntry & { rank: number };

//Leaderboard-specific bands: top players cluster in the upper tiers, so the
//filter offers All + the meaningful high/top bands (rank-emblem labelled).
const LEADERBOARD_BUCKETS: readonly RankBucket[] = [
  { key: 'all',      label: 'All ranks',           short: 'All',      tiers: []         },
  { key: 'initiate', label: 'Initiate – Alchemist', short: 'Initiate', tiers: [1, 2, 3] },
  { key: 'arcanist', label: 'Arcanist – Ritualist', short: 'Arcanist', tiers: [4, 5]    },
  { key: 'emissary', label: 'Emissary – Archon',    short: 'Emissary', tiers: [6, 7]    },
  { key: 'high',     label: 'Oracle – Phantom',     short: 'High',     tiers: [8, 9]    },
  { key: 'top',      label: 'Ascendant – Eternus',  short: 'Top',      tiers: [10, 11]  },
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
                  href={`/players/${p.account_id}/`}
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
  const { mode } = useGameMode();
  const [bucket, setBucket] = useState<RankBucket['key']>('all');
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');

  const offset = offsetFromPage(page);

  //Sync page from URL on mount; re-sync on browser Back/Forward.
  useEffect(() => {
    function sync() { setPage(pageFromSearch(window.location.search)); }
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  useEffect(() => { setPageInput(String(page)); }, [page]);

  const prevMode = useRef(mode);
  useEffect(() => {
    if (prevMode.current !== mode) {
      prevMode.current = mode;
      const url = new URL(window.location.href);
      url.searchParams.delete('page');
      history.replaceState(null, '', url.toString());
      setPage(1);
    }
  }, [mode]);

  function goToPage(p: number) {
    const url = new URL(window.location.href);
    if (p === 1) {
      url.searchParams.delete('page');
    } else {
      url.searchParams.set('page', String(p));
    }
    history.pushState(null, '', url.toString());
    setPage(p);
  }

  function changeBucket(key: RankBucket['key']) {
    setBucket(key);
    const url = new URL(window.location.href);
    url.searchParams.delete('page');
    history.replaceState(null, '', url.toString());
    setPage(1);
  }

  //Server-driven band filter: the band sends min_badge/max_badge (badge tiers,
  //labelled by rank emblem) and offset/limit page the ladder server-side.
  const band = LEADERBOARD_BUCKETS.find((b) => b.key === bucket);
  const badgeRange = badgeRangeForTiers(band?.tiers ?? []);
  const params = {
    limit: LEADERBOARD_PAGE_SIZE,
    offset,
    ...(badgeRange ?? {}),
    game_mode: mode,
  };

  //offset + band + mode ride in the queryKey so every page/band/mode caches
  //separately; keepPreviousData keeps the prior page visible during fetch.
  //initialData seeds ONLY the SSG default key (Normal, all ranks, page 1).
  const isDefaultPage = bucket === 'all' && page === 1 && mode === 'Normal';

  const { data, isPending, isError, error, isPlaceholderData } = useQuery({
    queryKey: queryKeys.leaderboard(params),
    queryFn: () => api.getLeaderboard(params),
    initialData: isDefaultPage ? { rows: initialRows, total: null } : undefined,
    placeholderData: keepPreviousData,
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? null;
  const last = lastPage(total);

  //Auto-clamp: if ?page= exceeds the known total, correct the URL in place.
  useEffect(() => {
    if (last !== null && page > last) {
      const url = new URL(window.location.href);
      if (last === 1) {
        url.searchParams.delete('page');
      } else {
        url.searchParams.set('page', String(last));
      }
      history.replaceState(null, '', url.toString());
      setPage(last);
    }
  }, [last, page]);

  const ranked = useMemo<RankedEntry[]>(
    () => rows.map((r, i) => ({ ...r, rank: offset + i + 1 })),
    [rows, offset],
  );

  const podium = offset === 0 ? ranked.slice(0, 3) : [];
  const rest = offset === 0 ? ranked.slice(3) : ranked;

  const hasPrev = page > 1;
  const hasNext = rows.length >= LEADERBOARD_PAGE_SIZE;

  function commitPageInput() {
    const n = Number(pageInput);
    if (Number.isInteger(n) && n >= 1) {
      goToPage(last !== null ? Math.min(n, last) : n);
    }
  }

  const ranksLabel = ranked.length > 0
    ? total !== null
      ? `Ranks ${count(offset + 1)}–${count(offset + ranked.length)} of ${count(total)}`
      : `Ranks ${count(offset + 1)}–${count(offset + ranked.length)}`
    : DASH;

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
            <a className="flex" href={`/players/${r.account_id}/`} style={{ alignItems: 'center', gap: 10, textDecoration: 'none' }}>
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
        <SearchBox variant="compact" placeholder="Find a player…" />
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
        emptyTitle={
          isComputing(error) ? 'Ladder is computing' : isError ? 'Leaderboard unavailable' : 'No players in this band yet'
        }
        emptyMessage={
          isComputing(error)
            ? computingMessage('the ladder is being generated', error)
            : isError
              ? 'The stats API is offline — the ladder fills in when it comes back online.'
              : 'No ranked players for this band yet. Try another bracket or check back after the next data refresh.'
        }
      />
      {last !== null ? (
        <nav className="between" style={{ marginTop: 16, gap: 8, flexWrap: 'wrap', alignItems: 'center' }} aria-label="Leaderboard pages">
          <div className="flex" style={{ gap: 4, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-ghost" onClick={() => goToPage(1)} disabled={page === 1 || isPlaceholderData}>
              <Icon name="arrowR" size={13} style={{ transform: 'scaleX(-1)' }} /> First
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => goToPage(page - 1)} disabled={page === 1 || isPlaceholderData}>
              <Icon name="arrowR" size={13} style={{ transform: 'scaleX(-1)' }} /> Prev
            </button>
            {pagerWindow(page, last).map((p) => (
              <button
                key={p}
                type="button"
                className="btn btn-ghost"
                style={p === page ? { fontWeight: 700, color: 'var(--text)' } : undefined}
                onClick={() => goToPage(p)}
                disabled={isPlaceholderData}
                aria-current={p === page ? 'page' : undefined}
              >
                {p}
              </button>
            ))}
            <button type="button" className="btn btn-ghost" onClick={() => goToPage(page + 1)} disabled={page >= last || isPlaceholderData}>
              Next <Icon name="arrowR" size={13} />
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => goToPage(last)} disabled={page >= last || isPlaceholderData}>
              Last <Icon name="arrowR" size={13} />
            </button>
          </div>
          <label className="label-xs" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Go to page
            <input
              type="number"
              min={1}
              max={last}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitPageInput(); }}
              onBlur={() => setPageInput(String(page))}
              disabled={isPlaceholderData}
              style={{ width: 64, textAlign: 'center' }}
            />
          </label>
          <span className="label-xs tnum" aria-live="polite">{ranksLabel}</span>
        </nav>
      ) : (hasPrev || hasNext) ? (
        <nav className="between" style={{ marginTop: 16, gap: 12, flexWrap: 'wrap' }} aria-label="Leaderboard pages">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => goToPage(page - 1)}
            disabled={!hasPrev || isPlaceholderData}
          >
            <Icon name="arrowR" size={13} style={{ transform: 'scaleX(-1)' }} /> Prev
          </button>
          <span className="label-xs tnum" aria-live="polite">{ranksLabel}</span>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => goToPage(page + 1)}
            disabled={!hasNext || isPlaceholderData}
          >
            Next <Icon name="arrowR" size={13} />
          </button>
        </nav>
      ) : null}
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
