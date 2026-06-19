//============================================================================
//Match inspector — the HEAVY per-player advanced matrix (C5). Mounted SEPARATELY
//from the scoreboard with `client:visible` on matches/[id].astro, so this wide
//all-players table only hydrates + renders when scrolled into view and never
//blocks the scoreboard's first paint (requirements §6.4 "inspect loads as a
//client:visible island"). It shares the /matches/:id fetch with the scoreboard
//island via the singleton query cache — no second request.
//
//It surfaces the deep per-player stats that ARE served on /matches/:id (damage
//dealt/taken, last hits, denies, net worth, KDA, rank). The richer "inspect"
//payload (per-player item + ability timelines) is a documented UNBUILT endpoint;
//that section empty-states until it ships (build-ahead).
//============================================================================
import { isNotFound } from '../../lib/apiClient';
import QueryProvider from './QueryProvider';
import { EmptyState, GameIcon, RankBadge } from './ui/index';
import { useMatch, useMatchId } from './match/useMatch';
import { count, DASH, fixed, kda } from '../../lib/format';
import { rankFromBadge } from '../../lib/ranks';
import { TEAM } from '../../lib/match';

const TEAM_DOT: Record<number, string> = { 0: 'var(--amber-acc)', 1: 'var(--sapphire-acc)' };

function MatchInspectorInner() {
  const id = useMatchId();
  const matchId = typeof id === 'number' ? id : 0;
  const { data, isPending, isError, error } = useMatch(matchId);

  if (id === undefined) return <p className="muted">Loading inspector…</p>;
  if (id === null) return null;
  if (isPending) return <p className="muted">Loading inspector…</p>;
  if (isError || !data) {
    //the scoreboard island already shows the primary error; stay quiet here on 404.
    return isNotFound(error) ? null : <EmptyState title="Inspector unavailable" message="The match detail couldn't be loaded." icon="inbox" />;
  }

  //all 12 players, richest first — the heavy matrix.
  const players = [...data.players].sort((a, b) => b.net_worth - a.net_worth);

  return (
    <div className="container" style={{ marginTop: 18 }}>
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="cat-h">
          <span className="display" style={{ flex: 1 }}>
            Inspector · all players
          </span>
          <span className="label-xs">{players.length} players</span>
        </div>
        {players.length === 0 ? (
          <div style={{ padding: 14 }}>
            <EmptyState title="No player rows" icon="users" />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="dt">
              <thead>
                <tr>
                  <th><span className="th-static">Team</span></th>
                  <th><span className="th-static">Player</span></th>
                  <th><span className="th-static">Rank</span></th>
                  <th className="num"><span className="th-static">KDA</span></th>
                  <th className="num"><span className="th-static">Net worth</span></th>
                  <th className="num"><span className="th-static">Dmg dealt</span></th>
                  <th className="num"><span className="th-static">Dmg taken</span></th>
                  <th className="num"><span className="th-static">Last hits</span></th>
                  <th className="num"><span className="th-static">Denies</span></th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => {
                  const rk = rankFromBadge(p.badge);
                  return (
                    <tr key={p.account_id}>
                      <td>
                        <span
                          aria-label={p.team === TEAM.amber ? 'Amber' : 'Sapphire'}
                          title={p.team === TEAM.amber ? 'Amber' : 'Sapphire'}
                          style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: TEAM_DOT[p.team] ?? 'var(--muted)' }}
                        />
                      </td>
                      <td>
                        <a className="flex" href={`/players/${p.account_id}`} style={{ alignItems: 'center', gap: 10, textDecoration: 'none' }}>
                          <GameIcon kind="hero" name={p.hero_name} src={p.icon_url} size={28} />
                          <span className="display" style={{ fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                            {p.steam_name}
                          </span>
                        </a>
                      </td>
                      <td>{rk ? <RankBadge tier={rk.tier} size={24} glow={false} /> : <span className="faint">{DASH}</span>}</td>
                      <td className="num tnum">{fixed(kda(p.kills, p.deaths, p.assists))}</td>
                      <td className="num gold-c tnum" style={{ fontWeight: 600 }}>{count(p.net_worth)}</td>
                      <td className="num tnum">{count(p.damage_dealt)}</td>
                      <td className="num tnum">{count(p.damage_taken)}</td>
                      <td className="num tnum">{count(p.last_hits)}</td>
                      <td className="num tnum">{count(p.denies)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ padding: 14, borderTop: '1px solid var(--border)' }}>
          <EmptyState
            title="Per-player item & ability timelines not served yet"
            message="The rich inspect payload (build order, ability usage, per-minute item spikes) loads here once the match-inspect endpoint ships."
            icon="book"
          />
        </div>
      </div>
    </div>
  );
}

export default function MatchInspectorIsland() {
  return (
    <QueryProvider>
      <MatchInspectorInner />
    </QueryProvider>
  );
}
