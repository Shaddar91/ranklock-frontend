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
import { buildAheadMessage, PlaystyleRadarPanel } from './AnalyticsPanels';
import { useCompare, useComparePlayer, usePlayerHeroes, usePlayerHeroesPlayed, usePlayerMatches, usePlayerPerformance } from './usePlayer';
import { api, isNotFound, isUnauthorized, queryKeys } from '../../../lib/apiClient';
import { rankFromBadge } from '../../../lib/ranks';
import { count, DASH, duration, fixed, kda, pct, shortDate } from '../../../lib/format';
import type { HeroLedgerRow, PlayerMatchRow, SearchResult } from '../../../types/api';

//---- recent matches ---------------------------------------------------------

export function RecentMatchesPanel({ id }: { id: number }) {
  const { data, isPending, isError } = usePlayerMatches(id, 25);
  //borrow icon_url from the hero ledger (PlayerMatchRow carries no icon).
  const heroes = usePlayerHeroes(id).data ?? [];
  const iconOf = new Map(heroes.map((h) => [h.hero_id, h.icon_url] as const));
  const rows = data ?? [];

  if (isPending) return <p className="muted">Loading matches…</p>;
  if (isError || rows.length === 0) {
    return <EmptyState title="No matches yet" message="Recent matches appear here once this player's match history is ingested." icon="swords" />;
  }
  return (
    <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
      <table className="dt">
        <thead>
          <tr>
            <th><span className="th-static">Result</span></th>
            <th><span className="th-static">Hero</span></th>
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
                <a href={`/matches/${m.match_id}`} style={{ textDecoration: 'none' }}>
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
  );
}

//---- per-hero ledger --------------------------------------------------------

export function HeroLedgerPanel({ id }: { id: number }) {
  const { data, isPending, isError } = usePlayerHeroes(id);
  const rows = [...(data ?? [])].sort((a, b) => b.matches - a.matches);

  if (isPending) return <p className="muted">Loading hero ledger…</p>;
  if (isError || rows.length === 0) {
    return <EmptyState title="No hero ledger yet" message="Per-hero win rates appear here once this player's matches are aggregated." icon="users" />;
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

const ordinal = (n: number | null | undefined): string => {
  if (n == null || Number.isNaN(n)) return DASH;
  const v = Math.round(n);
  const s = ['th', 'st', 'nd', 'rd'];
  const m = v % 100;
  return `${v}${s[(m - 20) % 10] ?? s[m] ?? s[0]}`;
};

export function PerformancePanel({ id }: { id: number }) {
  const { data, isPending, isError, error } = usePlayerPerformance(id);

  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr 1.25fr', alignItems: 'start' }}>
      <PlaystyleRadarPanel id={id} />
      <div className="panel" style={{ padding: '18px 20px' }}>
        <div className="kicker" style={{ marginBottom: 4 }}>
          Percentiles
        </div>
        <h2 className="h-sec" style={{ fontSize: 17, marginBottom: 12 }}>
          Where you rank within each bracket
        </h2>
        {isPending ? (
          <p className="muted">Loading percentiles…</p>
        ) : isError || !data || data.brackets.length === 0 ? (
          <EmptyState title="Percentiles not served yet" message={buildAheadMessage(error)} icon="chart" />
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
                {data.brackets.map((b) => (
                  <tr key={b.bracket}>
                    <td>
                      <span className="display" style={{ fontWeight: 600, color: 'var(--text)' }}>
                        {b.bracket_label}
                      </span>
                    </td>
                    <td className="num tnum">{ordinal(b.kda_pct)}</td>
                    <td className="num tnum">{ordinal(b.net_worth_pct)}</td>
                    <td className="num tnum">{ordinal(b.win_rate_pct)}</td>
                    <td className="num tnum faint">{count(b.sample_matches)}</td>
                  </tr>
                ))}
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

//Comparison-target options. These are the RELATIVE offsets the backend CompareQuery
//actually reads (hero_id + league_offset only — main.rs:1166-1169). An absolute
//"jump to tier N" group would need a `target_tier` query param the backend does not
//consume yet (unknown query keys are silently dropped by serde, so it would fall back
//to the player's own tier). It is therefore intentionally deferred rather than shipped
//as a control that silently shows the wrong cohort.
const TARGET_OPTIONS: ReadonlyArray<readonly [string, string]> = [
  ['same', 'Your rank'],
  ['one_up', 'One rank up'],
  ['two_up', 'Two ranks up'],
  ['top', `Best — ${TIER_NAMES[11]}`],
];

//---- compare to a specific player (optional, behind the rank selector) ------

//Minimal "compare-to-a-specific-player" picker. A debounced typeahead over the
//SAME /players/search endpoint the nav SearchBox uses (cache is shared via the
//`search` query key); on select it fetches /players/:id/compare-player and renders
//the SAME you-vs-them table + efficiency standing/note as the cohort compare above.
//Scoped to the hero chosen in the rank selector. A 404 (the two never overlapped on
//that hero) shows an explicit empty state rather than an error.
function ComparePlayerPicker({ id, hero, heroName }: { id: number; hero?: number; heroName?: string }) {
  const [raw, setRaw] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<SearchResult | null>(null);
  const listId = useId();

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

  const cmp = useComparePlayer(id, picked?.account_id, hero);

  function pick(r: SearchResult) {
    setPicked(r);
    setRaw('');
    setQ('');
    setOpen(false);
  }

  //D2 precision
  const rows: [string, number | null, number | null, (n: number) => string][] = cmp.data
    ? [
        ['Net worth', cmp.data.you.avg_net_worth, cmp.data.them.avg_net_worth, count],
        ['Souls / min', cmp.data.you.souls_per_min, cmp.data.them.souls_per_min, count],
        ['Last hits / min', cmp.data.you.last_hits_per_min, cmp.data.them.last_hits_per_min, (n) => fixed(n, 1)],
        ['Avg denies', cmp.data.you.avg_denies, cmp.data.them.avg_denies, (n) => fixed(n, 1)],
        ['Avg kills', cmp.data.you.avg_kills, cmp.data.them.avg_kills, (n) => fixed(n, 1)],
        ['Avg deaths', cmp.data.you.avg_deaths, cmp.data.them.avg_deaths, (n) => fixed(n, 1)],
        ['Avg assists', cmp.data.you.avg_assists, cmp.data.them.avg_assists, (n) => fixed(n, 1)],
      ]
    : [];

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

      {picked && (
        <div style={{ marginTop: 14 }}>
          {cmp.isPending ? (
            <p className="muted">Loading comparison with {picked.steam_name}…</p>
          ) : cmp.isError ? (
            isNotFound(cmp.error) ? (
              <EmptyState
                title="No shared games to compare"
                message={
                  hero && heroName
                    ? `${picked.steam_name} hasn't played ${heroName} in the overlap window — pick another hero or player.`
                    : `You and ${picked.steam_name} have no overlapping hero games yet.`
                }
                icon="users"
              />
            ) : (
              <EmptyState title="Comparison not served yet" message={buildAheadMessage(cmp.error)} icon="users" />
            )
          ) : cmp.data ? (
            <>
              <div className="between" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
                <span className="label-xs">
                  {cmp.data.hero_name} · you ({cmp.data.you.tier_name}) vs {picked.steam_name} ({cmp.data.them.tier_name})
                </span>
                <Chip tone={cmp.data.efficiency.standing === 'ahead' ? 'win' : cmp.data.efficiency.standing === 'behind' ? 'loss' : 'neutral'}>
                  {cmp.data.efficiency.standing}
                </Chip>
              </div>
              <table className="dt">
                <thead>
                  <tr>
                    <th>
                      <span className="th-static">Metric</span>
                    </th>
                    <th className="num">
                      <span className="th-static">You</span>
                    </th>
                    <th className="num">
                      <span className="th-static">{picked.steam_name}</span>
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
              {cmp.data.efficiency.note && (
                <p className="muted" style={{ fontSize: 12.5, marginTop: 12, lineHeight: 1.5 }}>
                  {cmp.data.efficiency.note}
                </p>
              )}
            </>
          ) : null}
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
  const [hero, setHero] = useState<number | undefined>(undefined);
  //Relative comparison target (league_offset). 'same' reproduces the prior
  //no-offset behaviour (cohort = the player's own tier).
  const [target, setTarget] = useState<string>('same');
  const { data, isPending, isError, error } = useCompare(id, { hero_id: hero, league_offset: target });

  const heroSelector = heroOptions.length > 0 && (
    <label className="flex" style={{ alignItems: 'center', gap: 8 }}>
      <span className="label-xs">Hero</span>
      <select
        className="field"
        style={{ width: 'auto', padding: '7px 10px' }}
        value={hero ?? ''}
        onChange={(e) => setHero(e.target.value === '' ? undefined : Number(e.target.value))}
        aria-label="Compare a hero"
      >
        <option value="">Most played</option>
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
        {TARGET_OPTIONS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
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
          <EmptyState title="Comparison not served yet" message={buildAheadMessage(error)} icon="users" />
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
      <ComparePlayerPicker id={id} hero={hero} heroName={data.hero_name} />
    </div>
  );
}
