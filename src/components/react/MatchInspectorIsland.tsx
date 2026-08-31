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
import { useMatch, useMatchId, useMatchInspect } from './match/useMatch';
import { count, DASH, duration, fixed, kda } from '../../lib/format';
import { rankFromBadge } from '../../lib/ranks';
import { TEAM } from '../../lib/match';
import { hasItemBuilds, sortInspectPlayers, windowNote } from '../../lib/matchInspect';
import type { MatchInspectItem, MatchInspectPlayer } from '../../types/api';

const TEAM_DOT: Record<number, string> = { 0: 'var(--amber-acc)', 1: 'var(--sapphire-acc)' };

//One purchased item: icon + name + buy time, struck through + red when it was sold.
function ItemChip({ item }: { item: MatchInspectItem }) {
  const sold = item.sold_s != null;
  return (
    <span
      className="flex"
      title={`${item.item_name ?? `#${item.item_id}`} · bought ${duration(item.bought_s)}${sold ? ` · sold ${duration(item.sold_s)}` : ''}`}
      style={{
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'var(--raised)',
        opacity: sold ? 0.62 : 1,
      }}
    >
      <GameIcon kind="item" name={item.item_name ?? '?'} src={item.icon_url} size={22} />
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, minWidth: 0 }}>
        <span
          style={{
            fontSize: 12,
            color: 'var(--text)',
            textDecoration: sold ? 'line-through' : 'none',
            maxWidth: 132,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.item_name ?? `#${item.item_id}`}
        </span>
        <span className="mono" style={{ fontSize: 10.5, color: sold ? 'var(--loss)' : 'var(--faint)' }}>
          {duration(item.bought_s)}
          {sold ? ` → sold ${duration(item.sold_s)}` : ''}
        </span>
      </span>
    </span>
  );
}

//One player's build: hero header, then items in BUY order, then ability order if served.
function PlayerBuild({ player }: { player: MatchInspectPlayer }) {
  return (
    <div style={{ padding: '12px 0', borderTop: '1px solid var(--border)' }}>
      <div className="flex" style={{ alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, background: TEAM_DOT[player.team] ?? 'var(--muted)' }} />
        <GameIcon kind="hero" name={player.hero_name} src={player.hero_icon_url} size={26} />
        <span className="display" style={{ fontWeight: 600, color: 'var(--text)' }}>
          {player.steam_name}
        </span>
        <span className="faint" style={{ fontSize: 11 }}>{player.hero_name}</span>
      </div>
      {player.items.length === 0 ? (
        <span className="faint" style={{ fontSize: 12 }}>No items recorded for this player.</span>
      ) : (
        <div className="flex" style={{ flexWrap: 'wrap', gap: 8 }}>
          {player.items.map((it, i) => (
            <ItemChip key={`${it.item_id}-${i}`} item={it} />
          ))}
        </div>
      )}
      {player.abilities && player.abilities.length > 0 && (
        <div className="flex" style={{ flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}>
          <span className="label-xs">Abilities</span>
          {player.abilities.map((a, i) => (
            <span key={`${a.ability_id}-${i}`} title={`${a.ability_name ?? 'Ability'}${a.leveled_s != null ? ` · ${duration(a.leveled_s)}` : ''}`}>
              <GameIcon kind="item" name={a.ability_name ?? '?'} src={a.icon_url} size={22} />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function MatchInspectorInner() {
  const id = useMatchId();
  const matchId = typeof id === 'number' ? id : 0;
  const { data, isPending, isError, error } = useMatch(matchId);
  const { data: inspect, isPending: inspectPending, isError: inspectError } = useMatchInspect(matchId);

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
      <div className="panel catpanel" style={{ padding: 0, overflow: 'hidden' }}>
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
                        <a className="flex" href={`/players/${p.account_id}/`} style={{ alignItems: 'center', gap: 10, textDecoration: 'none' }}>
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
          <div className="between" style={{ marginBottom: 4, alignItems: 'center' }}>
            <span className="display" style={{ fontWeight: 600 }}>Who bought what</span>
            <span className="label-xs">buy order · sells marked</span>
          </div>
          {inspectPending && <p className="muted" style={{ fontSize: 13 }}>Loading builds…</p>}
          {!inspectPending && (inspectError || !inspect) && (
            <EmptyState title="Item builds unavailable" message="The per-player build detail couldn't be loaded — try again shortly." icon="book" />
          )}
          {!inspectPending && inspect && !inspect.in_window && (
            <EmptyState
              title="Item build not kept for this match"
              message={`Item & ability builds are kept for ${windowNote(inspect.window_days)}; this match is older.`}
              icon="book"
            />
          )}
          {!inspectPending && inspect && inspect.in_window && !hasItemBuilds(inspect.players) && (
            <EmptyState title="No item builds recorded" message="This match is in the window but carries no per-player item detail." icon="book" />
          )}
          {inspect && inspect.in_window && hasItemBuilds(inspect.players) && (
            <div>
              {sortInspectPlayers(inspect.players).map((p) => (
                <PlayerBuild key={p.account_id} player={p} />
              ))}
            </div>
          )}
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
