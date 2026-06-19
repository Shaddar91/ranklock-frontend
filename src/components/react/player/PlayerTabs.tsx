//============================================================================
//Player-profile tab views (C5): Matches, Heroes, Performance, Compare. Each one
//self-fetches via the shared hooks (react-query dedupes against the queries the
//header/overview already issued) and empty-states gracefully on a build-ahead
//202/404/501. Performance & Compare are the documented-but-unbuilt coaching
//surfaces (action item 3) — scaffolded against their contracts, empty until
//served.
//============================================================================
import { useState } from 'react';
import { Chip, EmptyState, GameIcon } from '../ui/index';
import { buildAheadMessage, PlaystyleRadarPanel } from './AnalyticsPanels';
import { useCompare, usePlayerHeroes, usePlayerHeroesPlayed, usePlayerMatches, usePlayerPerformance } from './usePlayer';
import { count, DASH, duration, fixed, kda, pct, shortDate } from '../../../lib/format';
import type { HeroLedgerRow, PlayerMatchRow } from '../../../types/api';

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

export function ComparePanel({ id }: { id: number }) {
  //Hero selector sourced from the real /heroes-played endpoint (§A.4 success
  //criterion: derive the hero list from heroes-played, NOT from /matches).
  const heroesPlayed = usePlayerHeroesPlayed(id);
  const heroOptions = [...(heroesPlayed.data ?? [])].sort((a, b) => b.matches_played - a.matches_played);
  const [hero, setHero] = useState<number | undefined>(undefined);
  const { data, isPending, isError, error } = useCompare(id, hero);

  const selector = heroOptions.length > 0 && (
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
            You ({data.you.tier_name}) vs {data.cohort.tier_name}
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
          Cohort clamped to the nearest available tier.
        </p>
      )}
      <table className="dt">
        <thead>
          <tr>
            <th><span className="th-static">Metric</span></th>
            <th className="num"><span className="th-static">You</span></th>
            <th className="num"><span className="th-static">Cohort</span></th>
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
    </div>
  );
}
