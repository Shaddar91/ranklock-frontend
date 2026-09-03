//============================================================================
//Player-profile tab views (C5): Matches, Heroes, Performance, Compare. Each one
//self-fetches via the shared hooks (react-query dedupes against the queries the
//header/overview already issued) and empty-states gracefully on a build-ahead
//202/404/501. Performance & Compare are the documented-but-unbuilt coaching
//surfaces (action item 3) — scaffolded against their contracts, empty until
//served.
//============================================================================
import { useEffect, useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Chip, EmptyState, GameIcon, Icon, RankBadge } from '../ui/index';
import { buildAheadMessage, humanize, PlaystyleRadarPanel, SEV } from './AnalyticsPanels';
import { ShareCompareButton } from './ShareCompareButton';
import { useCompare, useComparePlayer, usePlayerHeroes, usePlayerHeroesPlayed, usePlayerMatches, usePlayerPerformance, usePlayerReadiness } from './usePlayer';
import { api, isNotFound, isUnauthorized, queryKeys } from '../../../lib/apiClient';
import { rankFromBadge } from '../../../lib/ranks';
import { scopeCaption, scopeParams, type PlayerScope } from '../../../lib/playerScope';
import { usePlayerScope } from './usePlayerScope';
import { useCompareTarget } from './useCompareTarget';
import { PlayerScopeControls } from './PlayerScopeControls';
import { MIN_PERCENTILE_SAMPLE, percentileOrdinal } from '../../../lib/percentile';
import { count, DASH, duration, fixed, kda, pct, shortDate } from '../../../lib/format';
import { gameModeLabel, isRanked, slugToGameMode, type MatchesModeSlug } from '../../../lib/matchesMode';
import { filterRowsByRanked } from '../../../lib/matchesRanked';
import { useMatchesRanked } from '../../../lib/useMatchesRanked';
import type { HeroLedgerRow, PlayerMatchRow, ReadinessMetric, SearchResult } from '../../../types/api';

//---- recent matches ---------------------------------------------------------

function MatchModeChips({ game_mode, match_mode }: { game_mode: string | null; match_mode: string | null }) {
  const gLabel = gameModeLabel(game_mode);
  const ranked = isRanked(match_mode);
  if (!gLabel && !ranked) return null;
  const tooltip = [game_mode, match_mode].filter(Boolean).join(' · ') || undefined;
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {gLabel && <Chip title={tooltip}>{gLabel}</Chip>}
      {ranked && <Chip title={tooltip}>Ranked</Chip>}
    </div>
  );
}

export function RecentMatchesPanel({ id }: { id: number }) {
  const [slug, setSlugState] = useState<MatchesModeSlug>(() => {
    if (typeof window === 'undefined') return 'normal';
    const v = new URLSearchParams(window.location.search).get('matches');
    if (v === 'brawl' || v === 'all') return v;
    return 'normal';
  });

  function setSlug(next: MatchesModeSlug) {
    const url = new URL(window.location.href);
    if (next === 'normal') url.searchParams.delete('matches');
    else url.searchParams.set('matches', next);
    window.history.replaceState(window.history.state, '', url.toString());
    setSlugState(next);
  }

  const game_mode = slugToGameMode(slug);
  const { ranked, setRanked } = useMatchesRanked();
  const { data, isPending, isError } = usePlayerMatches(id, 25, game_mode);
  //borrow icon_url from the hero ledger (PlayerMatchRow carries no icon).
  const heroes = usePlayerHeroes(id).data ?? [];
  const iconOf = new Map(heroes.map((h) => [h.hero_id, h.icon_url] as const));
  //client-filter the fetched page by match_mode (rows carry it), mirroring the /matches list.
  const rows = filterRowsByRanked(data ?? [], ranked);

  const controls = (
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
            className={'minitog' + (ranked === r ? ' on' : '')}
            aria-pressed={ranked === r}
            onClick={() => setRanked(r)}
          >
            {r === 'any' ? 'Any' : r === 'ranked' ? 'Ranked' : 'Unranked'}
          </button>
        ))}
      </div>
    </div>
  );

  if (isPending) return <div>{controls}<p className="muted">Loading matches…</p></div>;
  if (isError) {
    return <EmptyState title="No matches yet" message="Recent matches appear here once this player's history is in RankLock's data." icon="swords" />;
  }

  return (
    <div>
      {controls}
      {rows.length === 0 ? (
        <EmptyState title="No matches" message="No matches for this filter." icon="swords" />
      ) : (
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="dt">
            <thead>
              <tr>
                <th><span className="th-static">Result</span></th>
                <th><span className="th-static">Hero</span></th>
                <th><span className="th-static">Mode</span></th>
                <th className="num"><span className="th-static">K / D / A</span></th>
                <th className="num"><span className="th-static">KDA</span></th>
                <th className="num"><span className="th-static">Net worth</span></th>
                <th className="num"><span className="th-static">Duration</span></th>
                <th className="num"><span className="th-static">When</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m: PlayerMatchRow) => (
                <tr key={m.match_id} style={{ boxShadow: `inset 3px 0 0 ${m.winner ? 'var(--win)' : 'var(--loss)'}` }}>
                  <td>
                    <a href={`/matches/${m.match_id}/`} style={{ textDecoration: 'none' }}>
                      <Chip tone={m.winner ? 'win' : 'loss'}>{m.winner ? 'Victory' : 'Defeat'}</Chip>
                    </a>
                  </td>
                  <td>
                    <div className="flex" style={{ alignItems: 'center', gap: 10 }}>
                      <GameIcon kind="hero" name={m.hero_name} src={iconOf.get(m.hero_id)} size={30} />
                      <span className="display" style={{ fontWeight: 600, color: 'var(--text)' }}>
                        {m.hero_name}
                      </span>
                    </div>
                  </td>
                  <td><MatchModeChips game_mode={m.game_mode} match_mode={m.match_mode} /></td>
                  <td className="num tnum">
                    {m.kills} / {m.deaths} / {m.assists}
                  </td>
                  <td className="num tnum">{fixed(kda(m.kills, m.deaths, m.assists))}</td>
                  <td className="num gold-c tnum" style={{ fontWeight: 600 }}>
                    {count(m.net_worth)}
                  </td>
                  <td className="num tnum">{duration(m.duration_s)}</td>
                  <td className="num faint">{shortDate(m.start_time) || DASH}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

//---- per-hero ledger --------------------------------------------------------

export function HeroLedgerPanel({ id }: { id: number }) {
  const { data, isPending, isError } = usePlayerHeroes(id);
  const rows = [...(data ?? [])].sort((a, b) => b.matches - a.matches);

  if (isPending) return <p className="muted">Loading hero ledger…</p>;
  if (isError || rows.length === 0) {
    return <EmptyState title="No hero ledger yet" message="Per-hero win rates appear here once this player's matches are counted." icon="users" />;
  }
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))' }}>
      {rows.map((h: HeroLedgerRow) => (
        <div key={h.hero_id} className="panel" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
          <GameIcon kind="hero" name={h.hero_name} src={h.icon_url} size={48} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="display" style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {h.hero_name}
            </div>
            <div className="mono faint" style={{ fontSize: 12 }}>
              {count(h.matches)} games · KDA {fixed(h.kda)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="display tnum" style={{ fontSize: 20, fontWeight: 700, color: (h.win_rate ?? 0) >= 50 ? 'var(--win)' : 'var(--loss)' }}>
              {pct(h.win_rate)}
            </div>
            <div className="faint" style={{ fontSize: 10 }}>
              win rate
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

//---- performance percentiles ------------------------------------------------

export function PerformancePanel({ id }: { id: number }) {
  const { data, isPending, isError, error } = usePlayerPerformance(id);

  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr 1.25fr', alignItems: 'start' }}>
      <PlaystyleRadarPanel id={id} />
      <div className="panel" style={{ padding: '18px 20px' }}>
        <div className="kicker" style={{ marginBottom: 4 }}>
          Percentiles
        </div>
        <h2 className="h-sec" style={{ fontSize: 17, marginBottom: 4 }}>
          Where you rank within each bracket
        </h2>
        <p className="faint" style={{ fontSize: 12, marginBottom: 12 }}>
          Percentile among players of the same bracket — higher is better; 87th = better than 87% of them.
        </p>
        {isPending ? (
          <p className="muted">Loading percentiles…</p>
        ) : isError || !data || data.brackets.length === 0 ? (
          <EmptyState title="Percentiles not available yet" message={buildAheadMessage(error)} icon="chart" />
        ) : (
          <>
            <table className="dt">
              <thead>
                <tr>
                  <th><span className="th-static">Bracket</span></th>
                  <th className="num"><span className="th-static">KDA</span></th>
                  <th className="num"><span className="th-static">Net worth</span></th>
                  <th className="num"><span className="th-static">Win rate</span></th>
                  <th className="num"><span className="th-static">Sample</span></th>
                </tr>
              </thead>
              <tbody>
                {data.brackets.map((b) => {
                  const thin = b.sample_matches < MIN_PERCENTILE_SAMPLE;
                  return (
                    <tr key={b.bracket} style={thin ? { opacity: 0.55 } : undefined}>
                      <td>
                        <span className="display" style={{ fontWeight: 600, color: 'var(--text)' }}>
                          {b.bracket_label}
                        </span>
                      </td>
                      {thin ? (
                        <td className="num faint" colSpan={3}>
                          n too small
                        </td>
                      ) : (
                        <>
                          <td className="num tnum">{percentileOrdinal(b.kda_pct)}</td>
                          <td className="num tnum">{percentileOrdinal(b.net_worth_pct)}</td>
                          <td className="num tnum">{percentileOrdinal(b.win_rate_pct)}</td>
                        </>
                      )}
                      <td className="num tnum faint">{count(b.sample_matches)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {data.fresh_as_of && (
              <p className="faint" style={{ fontSize: 11, marginTop: 10 }}>
                Fresh as of {shortDate(data.fresh_as_of)}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

//---- rank-up readiness (backlog A1) ------------------------------------------

//The backend sign-corrects each metric into `met` (deaths invert), so severity keys
//off `met` plus the gap magnitude, not the raw delta's sign.
const readinessSev = (m: ReadinessMetric): keyof typeof SEV => {
  if (m.met) return 'low';
  return Math.abs(m.delta_pct) >= 15 ? 'high' : 'med';
};

export function ReadinessCard({ id }: { id: number }) {
  const { data, isPending, isError, error } = usePlayerReadiness(id);
  const noMatches = !isError && data != null && data.matches_in_window === 0;
  const target = data?.target_bracket_label;

  return (
    <div className="panel" style={{ padding: '16px 18px', marginTop: 16 }}>
      <div className="between" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="kicker" style={{ marginBottom: 4 }}>
            Rank-up readiness
          </div>
          <h2 className="h-sec" style={{ fontSize: 17 }}>
            {target ? `Your last ${data?.window} games vs the ${target} median` : 'Are you ready to rank up?'}
          </h2>
        </div>
        {data != null && !noMatches && (
          <Chip tone={data.ready ? 'win' : 'loss'}>{data.ready ? 'Ready to climb' : 'Not ready yet'}</Chip>
        )}
      </div>
      {isPending ? (
        <p className="muted">Checking rank-up readiness…</p>
      ) : isError || !data ? (
        <EmptyState title="Readiness not available yet" message={buildAheadMessage(error)} icon="target" />
      ) : noMatches ? (
        <EmptyState title="No recent matches" message="Play a few matches and the rank-up readiness verdict appears here." icon="target" />
      ) : (
        <>
          <p className="muted" style={{ fontSize: 12.5, margin: '0 0 12px', lineHeight: 1.5 }}>
            You meet or beat the {target} median on <b className="mono">{data.metrics_met}</b> of{' '}
            <b className="mono">{data.metrics_total}</b> metrics.
            {data.clamped ? ' You are in the top band, so the target is the top band itself.' : ''}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.metrics.map((m, i) => {
              const sev = readinessSev(m);
              return (
                <div
                  key={m.metric}
                  className="flex"
                  style={{ gap: 12, alignItems: 'flex-start', paddingBottom: 10, borderBottom: i < data.metrics.length - 1 ? '1px solid var(--border-soft)' : 'none' }}
                >
                  <span style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, background: SEV[sev].c, flex: 'none' }} />
                  <div style={{ flex: 1 }}>
                    <div className="display" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>
                      {humanize(m.metric)} {m.delta_pct >= 0 ? '+' : ''}
                      {fixed(m.delta_pct, 1)}% vs {target}
                    </div>
                    <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0, lineHeight: 1.45 }}>
                      You average <b className="mono">{fixed(m.user_avg, 1)}</b> against a median of{' '}
                      <b className="mono">{fixed(m.target_p50, 1)}</b>.
                    </p>
                  </div>
                  <span className="chip" style={{ fontSize: 10, color: SEV[sev].c, borderColor: SEV[sev].c + '55', flex: 'none' }}>
                    {SEV[sev].l}
                  </span>
                </div>
              );
            })}
          </div>
          {data.fresh_as_of && (
            <p className="faint" style={{ fontSize: 11, marginTop: 10 }}>
              Fresh as of {shortDate(data.fresh_as_of)}
            </p>
          )}
        </>
      )}
    </div>
  );
}

//---- compare (you vs cohort league) -----------------------------------------

//Deadlock rank-tier names (tier = badge/10, 1..11). Mirrored from the backend's
//tier_name() (deadlock-backend/src/main.rs:1268-1283) so the UI can name a tier by
//number; keep in lockstep with the backend.
const TIER_NAMES: Record<number, string> = {
  1: 'Initiate',
  2: 'Seeker',
  3: 'Alchemist',
  4: 'Arcanist',
  5: 'Ritualist',
  6: 'Emissary',
  7: 'Archon',
  8: 'Oracle',
  9: 'Phantom',
  10: 'Ascendant',
  11: 'Eternus',
};

//Comparison-target options: the RELATIVE league_offsets below; the "Jump to tier" group
//in the selector sends an absolute target_tier, which overrides league_offset server-side
//(compare.rs).
const TARGET_OPTIONS: ReadonlyArray<readonly [string, string]> = [
  ['same', 'Your rank'],
  ['one_up', 'One rank up'],
  ['two_up', 'Two ranks up'],
  ['top', `Best — ${TIER_NAMES[11]}`],
];

//---- compare to a specific player (optional, behind the rank selector) ------

//The loaded you-vs-them comparison body. Shared by the picker below and the
///compare/{a}/{b} shell island (CompareIsland), which preloads the pair and
//relabels the "You" side with the first player's name.
export function PairCompareView({
  id,
  vsId,
  vsName,
  scope,
  youLabel = 'You',
  notFoundMessage,
}: {
  id: number;
  vsId: number;
  vsName: string;
  scope: PlayerScope;
  youLabel?: string;
  notFoundMessage?: string;
}) {
  const cmp = useComparePlayer(id, vsId, scopeParams(scope));
  const cmpData = cmp.data ?? null;

  if (!cmpData) {
    if (cmp.isPending) return <p className="muted">Loading comparison with {vsName}…</p>;
    if (isNotFound(cmp.error)) {
      return (
        <EmptyState
          title="No games to compare"
          message={notFoundMessage ?? `${vsName} has no matches in this mode yet — pick another player.`}
          icon="users"
        />
      );
    }
    return <EmptyState title="Comparison not available yet" message={buildAheadMessage(cmp.error)} icon="users" />;
  }

  //D2 precision — both sides come from the ONE /compare-player response.
  const rows: [string, number | null, number | null, (n: number) => string][] = [
    ['Net worth', cmpData.you.avg_net_worth, cmpData.them.avg_net_worth, count],
    ['Souls / min', cmpData.you.souls_per_min, cmpData.them.souls_per_min, count],
    ['Last hits / min', cmpData.you.last_hits_per_min, cmpData.them.last_hits_per_min, (n) => fixed(n, 1)],
    ['Avg denies', cmpData.you.avg_denies, cmpData.them.avg_denies, (n) => fixed(n, 1)],
    ['Avg kills', cmpData.you.avg_kills, cmpData.them.avg_kills, (n) => fixed(n, 1)],
    ['Avg deaths', cmpData.you.avg_deaths, cmpData.them.avg_deaths, (n) => fixed(n, 1)],
    ['Avg assists', cmpData.you.avg_assists, cmpData.them.avg_assists, (n) => fixed(n, 1)],
    ['Damage dealt', cmpData.you.avg_damage, cmpData.them.avg_damage, count],
    ['Damage / min', cmpData.you.damage_per_min, cmpData.them.damage_per_min, count],
  ];
  const youText = youLabel === 'You' ? 'you' : youLabel;

  return (
    <>
      <p className="faint" style={{ fontSize: 11, marginBottom: 10 }}>
        {scopeCaption({
          scope,
          heroName: cmpData.hero_id === 0 ? null : cmpData.hero_name,
          you: cmpData.you,
          youLabel,
          themLabel: vsName,
          them: cmpData.them,
        })}
      </p>
      <div className="between" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
        <span className="label-xs">
          {cmpData.hero_name} · {youText} ({cmpData.you.tier_name}) vs {vsName} ({cmpData.them.tier_name})
        </span>
        <div className="flex" style={{ alignItems: 'center', gap: 8 }}>
          <ShareCompareButton me={id} vs={vsId} heroId={scope.hero_id} />
          <Chip tone={cmpData.efficiency.standing === 'ahead' ? 'win' : cmpData.efficiency.standing === 'behind' ? 'loss' : 'neutral'}>
            {cmpData.efficiency.standing}
          </Chip>
        </div>
      </div>
      <table className="dt">
        <thead>
          <tr>
            <th>
              <span className="th-static">Metric</span>
            </th>
            <th className="num">
              <span className="th-static">{youLabel}</span>
            </th>
            <th className="num">
              <span className="th-static">{vsName}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, you, them, fmt]) => (
            <tr key={label}>
              <td>{label}</td>
              <td className="num tnum cyan-c" style={{ fontWeight: 600 }}>
                {you != null ? fmt(you) : DASH}
              </td>
              <td className="num tnum muted">{them != null ? fmt(them) : DASH}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {cmpData.efficiency.note && (
        <p className="muted" style={{ fontSize: 12.5, marginTop: 12, lineHeight: 1.5 }}>
          {cmpData.efficiency.note}
        </p>
      )}
    </>
  );
}

//"Compare-to-a-specific-player" picker. A debounced typeahead over the
//SAME /players/search endpoint the nav SearchBox uses (cache is shared via the
//`search` query key); on select it fetches /players/:id/compare-player under the
//shared scope controls (Games/Days window + hero select, All heroes default) and
//renders the SAME you-vs-them table + efficiency standing/note as the cohort
//compare above. A 404 means an account has no games at all in this mode; a 0-game
//windowed side comes back 200 and shows matches:0 with dashes in the table.
function ComparePlayerPicker({ id }: { id: number }) {
  const [raw, setRaw] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<SearchResult | null>(null);
  const listId = useId();
  const { scope, setKind, setN, setHero } = usePlayerScope();

  //debounce the query the API sees (250ms) — mirrors SearchBox.
  useEffect(() => {
    const t = setTimeout(() => setQ(raw.trim()), 250);
    return () => clearTimeout(t);
  }, [raw]);

  const searchEnabled = q.length >= 2;
  const search = useQuery({
    queryKey: queryKeys.search(q),
    queryFn: () => api.searchPlayers(q, 8),
    enabled: searchEnabled,
  });
  //can't compare a player to themselves — drop the profile owner from the results.
  const results = (search.data ?? []).filter((r) => r.account_id !== id);
  //the search hit only the profile owner (self is filtered out above): tell the user
  //that is them rather than the misleading "no players found" no-hits note.
  const selfOnly = (search.data?.length ?? 0) > 0 && results.length === 0 && (search.data ?? []).every((r) => r.account_id === id);

  function pick(r: SearchResult) {
    setPicked(r);
    setRaw('');
    setQ('');
    setOpen(false);
  }

  return (
    <div style={{ marginTop: 18 }}>
      <div className="deco-rule" style={{ margin: '0 0 14px' }}>
        <span className="dia" />
      </div>
      <div className="between" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="kicker" style={{ marginBottom: 4 }}>
            Or compare to a specific player
          </div>
          <h3 className="h-sec" style={{ fontSize: 15 }}>
            {picked ? `You vs ${picked.steam_name}` : 'Pick a player to compare against'}
          </h3>
        </div>
        {picked && (
          <button type="button" className="minitog" onClick={() => setPicked(null)}>
            Clear
          </button>
        )}
      </div>

      <div className="searchbig" style={{ minWidth: 0, maxWidth: 360 }}>
        <Icon name="search" size={16} style={{ left: 12 }} />
        <input
          className="field"
          style={{ height: 38, paddingLeft: 36, fontSize: 13 }}
          placeholder="Search a player or Steam ID…"
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
          }}
          role="combobox"
          aria-expanded={open && searchEnabled}
          aria-controls={listId}
          aria-label="Search a player to compare against"
          autoComplete="off"
        />
        {open && searchEnabled && (
          <div className="search-pop panel" id={listId} role="listbox">
            {search.isFetching && results.length === 0 ? (
              <div className="search-note muted">Searching…</div>
            ) : search.isError ? (
              <div className="search-note muted">
                {isUnauthorized(search.error) ? 'Sign in to search.' : 'Search is offline right now.'}
              </div>
            ) : results.length === 0 ? (
              selfOnly ? (
                <div className="search-note muted">That is you — search for a different player to compare.</div>
              ) : (
                <div className="search-note muted">No players found for &ldquo;{q}&rdquo;.</div>
              )
            ) : (
              results.map((r) => {
                const rk = rankFromBadge(r.badge);
                return (
                  <button
                    key={r.account_id}
                    type="button"
                    className="search-row"
                    //keep input focus until the click lands so onBlur doesn't close the popup first.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(r)}
                    role="option"
                    aria-selected="false"
                    style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    {rk && <RankBadge tier={rk.tier} size={24} glow={false} />}
                    <span className="display" style={{ flex: 1, fontWeight: 600, color: 'var(--text)' }}>
                      {r.steam_name}
                    </span>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {count(r.matches)} games
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <PlayerScopeControls scope={scope} onKind={setKind} onN={setN} onHero={setHero} playerId={id} themId={picked?.account_id} />
      </div>

      {picked && (
        <div style={{ marginTop: 14 }}>
          <PairCompareView id={id} vsId={picked.account_id} vsName={picked.steam_name} scope={scope} />
        </div>
      )}
    </div>
  );
}

export function ComparePanel({ id }: { id: number }) {
  //Hero selector sourced from the real /heroes-played endpoint (§A.4 success
  //criterion: derive the hero list from heroes-played, NOT from /matches).
  const heroesPlayed = usePlayerHeroesPlayed(id);
  const heroOptions = [...(heroesPlayed.data ?? [])].sort((a, b) => b.matches_played - a.matches_played);
  //Shared with the radar and ComparePlayerPicker below (usePlayerScope, URL-backed) — was its
  //own local copy that could silently disagree with the rest of the page's hero selection.
  const { scope, setHero } = usePlayerScope();
  const hero = scope.hero_id;
  //Comparison target: a relative league_offset, or `tier:N` for an absolute tier jump
  //(target_tier overrides league_offset server-side). 'same' = the player's own tier.
  const { target, setTarget } = useCompareTarget();
  const absTier = target.startsWith('tier:') ? Number(target.slice(5)) : undefined;
  const { data, isPending, isError, error } = useCompare(id, {
    hero_id: hero,
    league_offset: absTier == null ? target : undefined,
    target_tier: absTier,
  });

  const heroSelector = heroOptions.length > 0 && (
    <label className="flex" style={{ alignItems: 'center', gap: 8 }}>
      <span className="label-xs">Hero</span>
      <select
        className="field"
        style={{ width: 'auto', padding: '7px 10px' }}
        value={hero}
        onChange={(e) => setHero(Number(e.target.value))}
        aria-label="Compare a hero"
      >
        <option value={0}>All heroes</option>
        {heroOptions.map((h) => (
          <option key={h.hero_id} value={h.hero_id}>
            {h.hero_name} ({count(h.matches_played)})
          </option>
        ))}
      </select>
    </label>
  );

  const targetSelector = (
    <label className="flex" style={{ alignItems: 'center', gap: 8 }}>
      <span className="label-xs">Compare to</span>
      <select
        className="field"
        style={{ width: 'auto', padding: '7px 10px' }}
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        aria-label="Choose the rank to compare against"
      >
        <optgroup label="Relative">
          {TARGET_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </optgroup>
        <optgroup label="Jump to tier">
          {Object.entries(TIER_NAMES).map(([tier, name]) => (
            <option key={tier} value={`tier:${tier}`}>
              {name}
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  );

  const selector = (
    <>
      {heroSelector}
      {targetSelector}
    </>
  );

  if (isPending) {
    return (
      <div className="panel" style={{ padding: '18px 20px' }}>
        {selector}
        <p className="muted" style={{ marginTop: 12 }}>Loading league comparison…</p>
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="panel" style={{ padding: '18px 20px' }}>
        {selector}
        <div style={{ marginTop: 12 }}>
          <EmptyState title="Comparison not available yet" message={buildAheadMessage(error)} icon="users" />
        </div>
      </div>
    );
  }

  const rows: [string, number | null, number | null][] = [
    ['Net worth', data.you.avg_net_worth, data.cohort.avg_net_worth],
    ['Souls / min', data.you.souls_per_min, data.cohort.souls_per_min],
    ['Last hits / min', data.you.last_hits_per_min, data.cohort.last_hits_per_min],
    ['Avg denies', data.you.avg_denies, data.cohort.avg_denies],
    ['Avg kills', data.you.avg_kills, data.cohort.avg_kills],
    ['Avg deaths', data.you.avg_deaths, data.cohort.avg_deaths],
    ['Avg assists', data.you.avg_assists, data.cohort.avg_assists],
    ['Damage dealt', data.you.avg_damage, data.cohort.avg_damage],
    ['Damage / min', data.you.damage_per_min, data.cohort.damage_per_min],
  ];

  return (
    <div className="panel" style={{ padding: '18px 20px' }}>
      <div className="between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="kicker" style={{ marginBottom: 4 }}>
            League compare · {data.hero_name}
          </div>
          <h2 className="h-sec" style={{ fontSize: 17 }}>
            You ({data.you.tier_name}) vs {data.cohort.tier_name}{' '}
            <span className="faint" style={{ fontWeight: 400, fontSize: 13 }}>
              (badges {data.cohort.badge_lo}–{data.cohort.badge_hi}, n={count(data.cohort.sample_size)})
            </span>
          </h2>
        </div>
        <div className="flex" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {selector}
          <Chip tone={data.efficiency.standing === 'ahead' ? 'win' : data.efficiency.standing === 'behind' ? 'loss' : 'neutral'}>
            {data.efficiency.standing}
          </Chip>
        </div>
      </div>
      {data.clamped && (
        <p className="faint" style={{ fontSize: 11, marginBottom: 10 }}>
          Comparison clamped to the nearest available tier.
        </p>
      )}
      {data.cohort.sample_size === 0 && (
        <p className="faint" style={{ fontSize: 11, marginBottom: 10 }}>
          No {data.cohort.tier_name} players on {data.hero_name} in the dataset yet — the tier column is empty.
        </p>
      )}
      <table className="dt">
        <thead>
          <tr>
            <th><span className="th-static">Metric</span></th>
            <th className="num"><span className="th-static">You</span></th>
            <th className="num"><span className="th-static">Tier</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, you, cohort]) => (
            <tr key={label}>
              <td>{label}</td>
              <td className="num tnum cyan-c" style={{ fontWeight: 600 }}>
                {you != null ? count(you) : DASH}
              </td>
              <td className="num tnum muted">{cohort != null ? count(cohort) : DASH}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.efficiency.note && (
        <p className="muted" style={{ fontSize: 12.5, marginTop: 12, lineHeight: 1.5 }}>
          {data.efficiency.note}
        </p>
      )}
      <ComparePlayerPicker id={id} />
    </div>
  );
}
