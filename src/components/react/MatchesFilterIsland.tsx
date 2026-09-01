//React island for /matches — server-paged list (?page=N, leaderboard-style numbered pager)
//with server-side Normal/Brawl/All + Any/Ranked/Unranked filters. SSG seeds page 1 of the
//default filters; every other page/filter combination fetches live.
import { useEffect, useRef, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../lib/apiClient';
import QueryProvider from './QueryProvider';
import { Icon } from './ui/index';
import { count, DASH, duration, shortDate } from '../../lib/format';
import { rankFromBadge, subLabel } from '../../lib/ranks';
import { gameModeLabel, isRanked, type MatchesModeSlug } from '../../lib/matchesMode';
import { useMatchesRanked } from '../../lib/useMatchesRanked';
import {
  lastPage,
  MATCHES_LAST_PAGE,
  MATCHES_PAGE_SIZE,
  offsetFromPage,
  pageFromSearch,
  pagerWindow,
  recentMatchesParams,
} from '../../lib/matchesPager';
import type { Badge, MatchRow } from '../../types/api';

function badgeLabel(b: Badge): string {
  const rk = rankFromBadge(b);
  return rk ? subLabel(rk.tier, rk.sub) : '—';
}

function winnerLabel(team: number | null): string {
  return team === 0 ? 'Amber' : team === 1 ? 'Sapphire' : '—';
}

interface MatchesIslandProps {
  initialRows: MatchRow[];
  initialTotal: number | null;
}

function MatchesInner({ initialRows, initialTotal }: MatchesIslandProps) {
  const [slug, setSlug] = useState<MatchesModeSlug>('normal');
  const { ranked: rankedFilter, setRanked } = useMatchesRanked();
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');

  //Sync page from URL on mount; re-sync on browser Back/Forward.
  useEffect(() => {
    function sync() { setPage(pageFromSearch(window.location.search)); }
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  useEffect(() => { setPageInput(String(page)); }, [page]);

  //Reset to page 1 when either filter flips — an offset under one filter set is
  //meaningless under another.
  const prevFilters = useRef(`${slug}:${rankedFilter}`);
  useEffect(() => {
    const f = `${slug}:${rankedFilter}`;
    if (prevFilters.current !== f) {
      prevFilters.current = f;
      const url = new URL(window.location.href);
      url.searchParams.delete('page');
      history.replaceState(null, '', url.toString());
      setPage(1);
    }
  }, [slug, rankedFilter]);

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

  const params = recentMatchesParams(page, slug, rankedFilter);
  const isDefaultKey = page === 1 && slug === 'normal' && rankedFilter === 'any';

  const { data, isPending, isError, isPlaceholderData } = useQuery({
    queryKey: queryKeys.recentMatches(params),
    queryFn: () => api.getRecentMatches(params),
    initialData:
      isDefaultKey && initialRows.length > 0 ? { rows: initialRows, total: initialTotal } : undefined,
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

  const hasNext = rows.length >= MATCHES_PAGE_SIZE && page < MATCHES_LAST_PAGE;
  const atEnd = last !== null ? page >= last : !hasNext;

  function commitPageInput() {
    const n = Number(pageInput);
    if (Number.isInteger(n) && n >= 1) {
      goToPage(Math.min(n, last ?? MATCHES_LAST_PAGE));
    }
  }

  const offset = offsetFromPage(page);
  const rangeLabel =
    rows.length > 0
      ? `Matches ${count(offset + 1)}–${count(offset + rows.length)} of ${total !== null ? count(total) : '…'}`
      : DASH;

  //Numbered frame renders as soon as rows exist — before X-Total-Count lands `last` is
  //null, so fill the same 5-wide window from a bound ("Last" stays disabled until real).
  const displayLast = last ?? (hasNext ? Math.max(page + 2, 5) : page);

  const hasTeamBadges = rows.some(
    (m) => rankFromBadge(m.average_badge_team0) != null || rankFromBadge(m.average_badge_team1) != null,
  );

  return (
    <div>
      <div className="flex" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div className="brkfilter gm-toggle" role="group" aria-label="Match mode">
          {(['normal', 'brawl', 'all'] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={'minitog' + (slug === s ? ' on' : '')}
              aria-pressed={slug === s}
              onClick={() => setSlug(s)}
            >
              {s === 'normal' ? 'Normal' : s === 'brawl' ? 'Brawl' : 'All'}
            </button>
          ))}
        </div>
        <div className="brkfilter gm-toggle" role="group" aria-label="Ranked filter">
          {(['any', 'ranked', 'unranked'] as const).map((r) => (
            <button
              key={r}
              type="button"
              className={'minitog' + (rankedFilter === r ? ' on' : '')}
              aria-pressed={rankedFilter === r}
              onClick={() => setRanked(r)}
            >
              {r === 'any' ? 'Any' : r === 'ranked' ? 'Ranked' : 'Unranked'}
            </button>
          ))}
        </div>
      </div>
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        {rows.length === 0 ? (
          <p className="muted" style={{ padding: '24px' }}>
            {isPending
              ? 'Loading matches…'
              : isError
                ? 'Matches are unavailable — the stats API is offline.'
                : 'No matches for this filter.'}
          </p>
        ) : (
          <div className="dt-scroll">
            <table className="dt">
              <thead>
                <tr>
                  <th><span className="th-static">Match</span></th>
                  <th><span className="th-static">Mode</span></th>
                  {hasTeamBadges && <th><span className="th-static">Amber rank</span></th>}
                  {hasTeamBadges && <th><span className="th-static">Sapphire rank</span></th>}
                  <th className="num"><span className="th-static">Duration</span></th>
                  <th><span className="th-static">Result</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => {
                  const gLabel = gameModeLabel(m.game_mode);
                  const ranked = isRanked(m.match_mode);
                  const tooltip = [m.game_mode, m.match_mode].filter(Boolean).join(' · ') || undefined;
                  return (
                    <tr key={m.match_id}>
                      <td>
                        <a href={`/matches/${m.match_id}/`} className="display" style={{ fontWeight: 600 }}>
                          #{m.match_id}
                        </a>
                        <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{shortDate(m.start_time)}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {gLabel ? (
                            <>
                              <span className="chip" title={tooltip}>{gLabel}</span>
                              {ranked && <span className="chip" title={tooltip}>Ranked</span>}
                            </>
                          ) : (
                            <span className="muted">{m.game_mode ?? m.match_mode ?? '—'}</span>
                          )}
                        </div>
                      </td>
                      {hasTeamBadges && <td><span className="amber-c">{badgeLabel(m.average_badge_team0)}</span></td>}
                      {hasTeamBadges && <td><span className="sap-c">{badgeLabel(m.average_badge_team1)}</span></td>}
                      <td className="num"><span className="tnum">{duration(m.duration_s)}</span></td>
                      <td>
                        <span className={'chip' + (m.winning_team === 0 ? ' gold' : '')}>{winnerLabel(m.winning_team)} win</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {rows.length > 0 || last !== null ? (
        <nav className="between" style={{ marginTop: 16, gap: 8, flexWrap: 'wrap', alignItems: 'center' }} aria-label="Recent match pages">
          <div className="flex" style={{ gap: 4, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-ghost" onClick={() => goToPage(1)} disabled={page === 1 || isPlaceholderData}>
              <Icon name="arrowR" size={13} style={{ transform: 'scaleX(-1)' }} /> First
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => goToPage(page - 1)} disabled={page === 1 || isPlaceholderData}>
              <Icon name="arrowR" size={13} style={{ transform: 'scaleX(-1)' }} /> Prev
            </button>
            {pagerWindow(page, displayLast).map((p) => (
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
            <button type="button" className="btn btn-ghost" onClick={() => goToPage(page + 1)} disabled={atEnd || isPlaceholderData}>
              Next <Icon name="arrowR" size={13} />
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => { if (last !== null) goToPage(last); }} disabled={last === null || page >= last || isPlaceholderData}>
              Last <Icon name="arrowR" size={13} />
            </button>
          </div>
          <label className="label-xs" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Go to page
            <input
              type="number"
              min={1}
              max={last ?? undefined}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitPageInput(); }}
              onBlur={() => setPageInput(String(page))}
              disabled={isPlaceholderData}
              style={{ width: 64, textAlign: 'center' }}
            />
          </label>
          <span className="label-xs tnum" aria-live="polite">{rangeLabel}</span>
        </nav>
      ) : null}
    </div>
  );
}

export default function MatchesFilterIsland(props: MatchesIslandProps) {
  return (
    <QueryProvider>
      <MatchesInner {...props} />
    </QueryProvider>
  );
}
