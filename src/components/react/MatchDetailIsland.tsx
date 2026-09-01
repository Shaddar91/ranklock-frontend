//============================================================================
//Match detail — the per-match CSR scoreboard dashboard (C5). Mounted
//`client:only="react"` on matches/[id].astro; reads the match id from the URL
//(never prerendered per id) and fetches /matches/:id. This island carries the
//score header + the Amber/Sapphire scoreboard + the economy headline — the part
//that should paint immediately. The HEAVY per-player inspect matrix is a SEPARATE
//`client:visible` island (MatchInspectorIsland) so it never blocks first paint.
//============================================================================
import { useState } from 'react';
import { isNotFound } from '../../lib/apiClient';
import QueryProvider from './QueryProvider';
import { AdSlot, Chip, EmptyState, GameIcon, MvpBadge } from './ui/index';
import ShareLinkButton from './ui/ShareLinkButton';
import { useMatch, useMatchId, useMatchInspect } from './match/useMatch';
import { AD_SLOTS } from '../../config/artDirection';
import MatchNetWorthChart, { type NetWorthSeries } from './charts/MatchNetWorthChart';
import { seriesColor } from './charts/chartTheme';
import { TEAM, teamKills, teamNetWorth, teamPlayers } from '../../lib/match';
import {
  hasEconomyTimeline,
  playerNetWorthSeries,
  type PlayerSeriesMeta,
  teamNetWorthSeries,
  windowNote,
} from '../../lib/matchInspect';
import { count, DASH, duration, fixed, shortDate } from '../../lib/format';
import type { MatchDetail, MatchPlayerDetail } from '../../types/api';

//A per-player opacity ramp so up-to-six same-team lines stay individually tellable
//(the team hue already tells the sides apart; opacity separates teammates).
const PLAYER_FADE = [1, 0.82, 0.66, 0.52, 0.42, 0.34];

//Map the per-player series metadata to drawn lines: team hue + a within-team fade.
function playerSeries(meta: PlayerSeriesMeta[]): NetWorthSeries[] {
  const seen: Record<number, number> = {};
  return meta.map((m) => {
    const i = seen[m.team] ?? 0;
    seen[m.team] = i + 1;
    return {
      key: m.key,
      name: m.name,
      color: m.team === TEAM.amber ? seriesColor.amber : seriesColor.sapphire,
      opacity: PLAYER_FADE[Math.min(i, PLAYER_FADE.length - 1)],
    };
  });
}

const TEAM_SERIES: NetWorthSeries[] = [
  { key: 'amber', name: 'Amber', color: seriesColor.amber },
  { key: 'sapphire', name: 'Sapphire', color: seriesColor.sapphire },
];

type EconView = 'Teams' | 'Players';

type Tab = 'Scoreboard' | 'Economy';

function TeamTable({ players }: { players: MatchPlayerDetail[] }) {
  return (
    <table className="dt">
      <thead>
        <tr>
          <th><span className="th-static">Player</span></th>
          <th><span className="th-static">MVP</span></th>
          <th className="num"><span className="th-static">K / D / A</span></th>
          <th className="num"><span className="th-static">Net worth</span></th>
          <th className="num"><span className="th-static">Damage</span></th>
          <th className="num"><span className="th-static">LH</span></th>
        </tr>
      </thead>
      <tbody>
        {players.map((p, i) => (
          <tr key={p.account_id}>
            <td>
              <a className="flex" href={`/players/${p.account_id}/`} style={{ alignItems: 'center', gap: 10, textDecoration: 'none' }}>
                <GameIcon kind="hero" name={p.hero_name} src={p.icon_url} size={34} />
                <div style={{ minWidth: 0 }}>
                  <div className="display" style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.steam_name}
                  </div>
                  <div className="faint" style={{ fontSize: 11 }}>
                    {p.hero_name}
                  </div>
                </div>
              </a>
            </td>
            <td>
              <MvpBadge rank={i + 1} outOf={players.length} />
            </td>
            <td className="num tnum">
              <b style={{ color: 'var(--text)' }}>{p.kills}</b> / {p.deaths} / <span style={{ color: 'var(--info)' }}>{p.assists}</span>
            </td>
            <td className="num gold-c tnum" style={{ fontWeight: 600 }}>
              {count(p.net_worth)}
            </td>
            <td className="num tnum">{count(p.damage_dealt)}</td>
            <td className="num tnum">{count(p.last_hits)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ScoreHeader({ match }: { match: MatchDetail }) {
  const amber = teamPlayers(match, TEAM.amber);
  const sapphire = teamPlayers(match, TEAM.sapphire);
  const amberWon = match.winning_team === TEAM.amber;
  const sapphireWon = match.winning_team === TEAM.sapphire;

  return (
    <div className="panel" style={{ padding: '20px 26px', marginBottom: 18 }}>
      <div className="between" style={{ marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div className="flex" style={{ alignItems: 'center', gap: 12 }}>
          <span className="kicker">Match</span>
          <span className="mono faint" style={{ fontSize: 13 }}>
            #{match.match_id}
          </span>
        </div>
        <div className="flex" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip>{duration(match.duration_s)}</Chip>
          {match.game_mode && <Chip>{match.game_mode}</Chip>}
          <span className="faint" style={{ fontSize: 12 }}>
            {shortDate(match.start_time) || DASH}
          </span>
          <ShareLinkButton url={`https://ranklock.app/matches/${match.match_id}/`} label="Share match" />
        </div>
      </div>
      <div className="flex" style={{ alignItems: 'center', gap: 20, justifyContent: 'center' }}>
        <div className="teamhead amber" style={{ flex: 1, justifyContent: 'flex-end', maxWidth: 340 }}>
          <div style={{ textAlign: 'right' }}>
            <div className="display" style={{ fontWeight: 700, fontSize: 18 }}>
              Amber
            </div>
            {match.winning_team != null && <Chip tone={amberWon ? 'win' : 'loss'}>{amberWon ? 'Victory' : 'Defeat'}</Chip>}
          </div>
          <span className="tscore amber-c">{teamKills(amber)}</span>
        </div>
        <span className="display faint" style={{ fontSize: 18 }}>
          —
        </span>
        <div className="teamhead sapphire" style={{ flex: 1, maxWidth: 340 }}>
          <span className="tscore sap-c">{teamKills(sapphire)}</span>
          <div>
            <div className="display" style={{ fontWeight: 700, fontSize: 18 }}>
              Sapphire
            </div>
            {match.winning_team != null && <Chip tone={sapphireWon ? 'win' : 'loss'}>{sapphireWon ? 'Victory' : 'Defeat'}</Chip>}
          </div>
        </div>
      </div>
    </div>
  );
}

function EconomyTab({ match }: { match: MatchDetail }) {
  const [view, setView] = useState<EconView>('Teams');
  //Only mounts while the Economy tab is selected, so the inspect fetch is deferred
  //until it's opened; the deferred inspector island shares this one request.
  const { data: inspect, isPending, isError } = useMatchInspect(match.match_id);

  const amberNw = teamNetWorth(teamPlayers(match, TEAM.amber));
  const sapphireNw = teamNetWorth(teamPlayers(match, TEAM.sapphire));
  const leadK = (amberNw - sapphireNw) / 1000;

  const players = inspect?.in_window ? inspect.players : [];
  const showChart = hasEconomyTimeline(players);
  const teamRows = showChart ? teamNetWorthSeries(players) : [];
  const perPlayer = showChart ? playerNetWorthSeries(players) : { rows: [], series: [] };

  return (
    <div className="panel" style={{ padding: '18px 22px' }}>
      <div className="between" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 10 }}>
        <h2 className="h-sec" style={{ fontSize: 17 }}>
          Net worth over time
        </h2>
        <Chip tone={leadK >= 0 ? 'win' : 'loss'}>
          {leadK >= 0 ? 'Amber' : 'Sapphire'} +{fixed(Math.abs(leadK), 1)}k at end
        </Chip>
      </div>
      <p className="muted" style={{ fontSize: 13, margin: '0 0 12px' }}>
        Final team net worth — Amber <b className="amber-c mono">{count(amberNw)}</b> vs Sapphire{' '}
        <b className="sap-c mono">{count(sapphireNw)}</b> souls.
      </p>

      {isPending && <p className="muted" style={{ fontSize: 13 }}>Loading the per-minute economy…</p>}

      {!isPending && (isError || !inspect) && (
        <EmptyState
          title="Economy timeline unavailable"
          message="The per-minute net-worth series couldn't be loaded — the final totals above are live."
          icon="chart"
        />
      )}

      {!isPending && inspect && !inspect.in_window && (
        <EmptyState
          title="Per-minute economy not kept for this match"
          message={`The net-worth timeline is kept for ${windowNote(inspect.window_days)}; this match is older. The final totals above stay live.`}
          icon="chart"
        />
      )}

      {!isPending && inspect && inspect.in_window && !showChart && (
        <EmptyState title="No timeline samples" message="This match is in the window but carries no per-minute samples." icon="chart" />
      )}

      {showChart && (
        <>
          <div className="tabs" role="tablist" aria-label="Economy view" style={{ marginBottom: 10 }}>
            {(['Teams', 'Players'] as EconView[]).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                className={'tab' + (view === v ? ' on' : '')}
                onClick={() => setView(v)}
              >
                {v}
              </button>
            ))}
          </div>
          {view === 'Teams' ? (
            <MatchNetWorthChart data={teamRows} series={TEAM_SERIES} filled />
          ) : (
            <MatchNetWorthChart data={perPlayer.rows} series={playerSeries(perPlayer.series)} height={300} />
          )}
        </>
      )}
    </div>
  );
}

function MatchDetailInner() {
  const id = useMatchId();
  const [tab, setTab] = useState<Tab>('Scoreboard');
  const matchId = typeof id === 'number' ? id : 0;
  const { data, isPending, isError, error } = useMatch(matchId);

  if (id === undefined) return <p className="muted">Loading…</p>;
  if (id === null) return <p className="muted">No match id in the URL.</p>;
  if (isPending) return <p className="muted">Loading match {id}…</p>;
  if (isError || !data) {
    return isNotFound(error) ? (
      <EmptyState title={`No data for match ${id}`} message="This match isn't in RankLock's data, or the id is wrong." icon="inbox" />
    ) : (
      <EmptyState title="Couldn't load this match" message="The stats API is unreachable right now — try again shortly." icon="inbox" />
    );
  }

  const amber = teamPlayers(data, TEAM.amber);
  const sapphire = teamPlayers(data, TEAM.sapphire);

  return (
    <div className="container">
      <ScoreHeader match={data} />
      {/* Mid-content sponsor slot after the score header, before the team tables
          (ads plan C5, match detail). Gated by PUBLIC_AD_SLOTS; consent-gated placeholder. */}
      {AD_SLOTS === 'on' && (
        <div style={{ display: 'flex', justifyContent: 'center', margin: '0 0 18px' }}>
          <AdSlot kind="rect" />
        </div>
      )}
      <div className="tabs" role="tablist" aria-label="Match sections" style={{ marginBottom: 18 }}>
        {(['Scoreboard', 'Economy'] as Tab[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={'tab' + (tab === t ? ' on' : '')} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Scoreboard' && (
        <div className="grid" style={{ gap: 18 }}>
          <div className="panel" style={{ padding: 0, overflow: 'hidden', borderColor: 'rgba(245,158,11,.3)' }}>
            <div className="teamhead amber" style={{ borderRadius: 0, border: 'none', borderBottom: '1px solid rgba(245,158,11,.3)' }}>
              <span className="display" style={{ fontWeight: 700, fontSize: 16 }}>
                Amber
              </span>
              <span style={{ marginLeft: 'auto' }}>
                <Chip tone={data.winning_team === TEAM.amber ? 'win' : 'neutral'}>{teamKills(amber)} kills</Chip>
              </span>
            </div>
            {amber.length > 0 ? <TeamTable players={amber} /> : <div style={{ padding: 14 }}><EmptyState title="No Amber roster" icon="users" /></div>}
          </div>
          <div className="panel" style={{ padding: 0, overflow: 'hidden', borderColor: 'rgba(139,92,246,.3)' }}>
            <div className="teamhead sapphire" style={{ borderRadius: 0, border: 'none', borderBottom: '1px solid rgba(139,92,246,.3)' }}>
              <span className="display" style={{ fontWeight: 700, fontSize: 16 }}>
                Sapphire
              </span>
              <span style={{ marginLeft: 'auto' }}>
                <Chip tone={data.winning_team === TEAM.sapphire ? 'win' : 'neutral'}>{teamKills(sapphire)} kills</Chip>
              </span>
            </div>
            {sapphire.length > 0 ? <TeamTable players={sapphire} /> : <div style={{ padding: 14 }}><EmptyState title="No Sapphire roster" icon="users" /></div>}
          </div>
        </div>
      )}
      {tab === 'Economy' && <EconomyTab match={data} />}
      {/* Second sponsor slot at the foot of the match card (ads plan C5, match detail —
          the sidebar intent, placed in-flow to avoid a live scoreboard-grid refactor). */}
      {AD_SLOTS === 'on' && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
          <AdSlot kind="rect" />
        </div>
      )}
    </div>
  );
}

export default function MatchDetailIsland() {
  return (
    <QueryProvider>
      <MatchDetailInner />
    </QueryProvider>
  );
}
