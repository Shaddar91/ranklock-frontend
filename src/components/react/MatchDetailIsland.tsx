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
import { useMatch, useMatchId } from './match/useMatch';
import { AD_SLOTS } from '../../config/artDirection';
import { TEAM, teamKills, teamNetWorth, teamPlayers } from '../../lib/match';
import { count, DASH, duration, fixed, shortDate } from '../../lib/format';
import type { MatchDetail, MatchPlayerDetail } from '../../types/api';

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
              <a className="flex" href={`/players/${p.account_id}`} style={{ alignItems: 'center', gap: 10, textDecoration: 'none' }}>
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
  const amberNw = teamNetWorth(teamPlayers(match, TEAM.amber));
  const sapphireNw = teamNetWorth(teamPlayers(match, TEAM.sapphire));
  const leadK = (amberNw - sapphireNw) / 1000;
  return (
    <div className="panel" style={{ padding: '18px 22px' }}>
      <div className="between" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 10 }}>
        <h2 className="h-sec" style={{ fontSize: 17 }}>
          Net worth
        </h2>
        <Chip tone={leadK >= 0 ? 'win' : 'loss'}>
          {leadK >= 0 ? 'Amber' : 'Sapphire'} +{fixed(Math.abs(leadK), 1)}k at end
        </Chip>
      </div>
      <p className="muted" style={{ fontSize: 13, margin: '0 0 12px' }}>
        Final team net worth — Amber <b className="amber-c mono">{count(amberNw)}</b> vs Sapphire{' '}
        <b className="sap-c mono">{count(sapphireNw)}</b>.
      </p>
      {/* The per-minute net-worth timeline is an UNBUILT endpoint — empty-state it
          (build-ahead) while keeping the layout reserved; the totals above are live. */}
      <EmptyState
        title="Net-worth timeline not served yet"
        message="The per-minute economy timeline comes online with the match-inspect pipeline; the final totals above are live."
        icon="chart"
      />
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
      <EmptyState title={`No data for match ${id}`} message="This match hasn't been ingested, or the id is unknown." icon="inbox" />
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
