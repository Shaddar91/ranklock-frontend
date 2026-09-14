//The sticky filter bar: who is on the axis, and the four things that scope every panel below it.
//Hero scope is deliberately NOT here — it is per player, set from that player's hero cards, because
//the page compares individuals (owner ruling 2026-09-14), not one hero across a lobby.
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../../lib/apiClient';
import { count, pct } from '../../../lib/format';
import { asAccountId, scopeLabel, type RosterSlot } from '../../../lib/laneRoster';
import { LEAGUE_NAMES, LEAGUE_TIERS } from './LadderPanel';

export type WindowKey = 'all' | 'g10' | 'g25' | 'g50' | 'd30';

export const WINDOWS: readonly { key: WindowKey; label: string }[] = [
  { key: 'all', label: 'All games' },
  { key: 'g10', label: 'Last 10' },
  { key: 'g25', label: 'Last 25' },
  { key: 'g50', label: 'Last 50' },
  { key: 'd30', label: '30 days' },
];

//The window params the player curve takes. The five 060 metrics reject a window (the retained
//timeline has no such arrays), so the caller drops the window for those.
export function windowParams(key: WindowKey): { last_games?: number; last_days?: number } {
  switch (key) {
    case 'g10':
      return { last_games: 10 };
    case 'g25':
      return { last_games: 25 };
    case 'g50':
      return { last_games: 50 };
    case 'd30':
      return { last_days: 30 };
    default:
      return {};
  }
}

export interface CompareBarProps {
  roster: readonly RosterSlot[];
  full: boolean;
  onAdd: (entry: { account_id: number; name: string }) => void;
  onRemove: (account_id: number) => void;
  window: WindowKey;
  onWindow: (w: WindowKey) => void;
  matchMode: 'Unranked' | 'Ranked';
  onMatchMode: (m: 'Unranked' | 'Ranked') => void;
  tier: number;
  onTier: (t: number) => void;
  //Per-league player-game counts for the dropdown, tier -> n. Empty until the ladder resolves.
  leagueSamples: Map<number, number>;
  horizonLabel: string;
}

export default function CompareBar({
  roster,
  full,
  onAdd,
  onRemove,
  window: win,
  onWindow,
  matchMode,
  onMatchMode,
  tier,
  onTier,
  leagueSamples,
  horizonLabel,
}: CompareBarProps) {
  const [raw, setRaw] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [leagueOpen, setLeagueOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQ(raw.trim()), 220);
    return () => clearTimeout(t);
  }, [raw]);

  //An all-digits query is a Steam id: /players/search matches steam_name only, so a numeric search
//would return nothing. Route it to the by-id read instead.
  const byId = asAccountId(q);

  const search = useQuery({
    queryKey: queryKeys.search(q),
    queryFn: () => api.searchPlayers(q),
    enabled: q.length >= 2 && byId == null,
    staleTime: 60 * 1000,
    retry: false,
  });

  const direct = useQuery({
    queryKey: queryKeys.player(byId ?? 0, 'Normal'),
    queryFn: () => api.getPlayer(byId as number, 'Normal'),
    enabled: byId != null,
    staleTime: 60 * 1000,
    retry: false,
  });

  const results = byId != null
    ? direct.data
      ? [
          {
            account_id: direct.data.account_id,
            steam_name: direct.data.steam_name,
            badge: direct.data.badge,
            matches: direct.data.matches ?? 0,
            win_rate: direct.data.win_rate ?? null,
          },
        ]
      : []
    : (search.data ?? []);

  const take = (r: { account_id: number; steam_name: string }) => {
    onAdd({ account_id: r.account_id, name: r.steam_name });
    setRaw('');
    setQ('');
    setOpen(false);
  };

  return (
    <div className="ll-bar">
      <div className="ll-bar-inner">
        <span className="kicker">Compare</span>

        <div className="ll-chips">
          {roster.map((p) => (
            <span className="ll-chip" key={p.account_id} style={{ borderColor: p.color }}>
              <span className="ll-dot" style={{ background: p.color }} />
              <span className="ll-chip-name">{p.name}</span>
              <small>· {scopeLabel(p.scope)}</small>
              <button
                type="button"
                onClick={() => onRemove(p.account_id)}
                aria-label={`Remove ${p.name}`}
              >
                ×
              </button>
            </span>
          ))}

          <div className="ll-add">
            <input
              type="search"
              value={raw}
              placeholder={full ? 'Four players is the limit' : 'Add player — name or Steam ID'}
              disabled={full}
              onChange={(e) => {
                setRaw(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
            />
            <small className="tnum">{roster.length} of 4</small>
            {open && q.length >= 2 && (
              <div className="ll-typeahead">
                {results.length === 0 ? (
                  <p className="ll-empty">
                    {search.isPending || direct.isPending ? 'Searching…' : 'No player by that name or id'}
                  </p>
                ) : (
                  results.map((r) => (
                    <button type="button" key={r.account_id} onClick={() => take(r)}>
                      <span className="ll-ta-name">{r.steam_name}</span>
                      <span className="ll-ta-id tnum">{r.account_id}</span>
                      <span className="tnum">{count(r.matches)}</span>
                      <span className={`tnum ${(r.win_rate ?? 0) >= 50 ? 'tone-good' : 'tone-bad'}`}>
                        {pct(r.win_rate, 1)}
                      </span>
                    </button>
                  ))
                )}
                <p className="ll-ta-foot">
                  Twenty accounts are named Misery: games and win rate tell them apart
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="ll-seg">
          {WINDOWS.map((w) => (
            <button
              type="button"
              key={w.key}
              className={w.key === win ? 'on' : ''}
              onClick={() => onWindow(w.key)}
            >
              {w.label}
            </button>
          ))}
        </div>

        <div className="ll-seg">
          {(['Unranked', 'Ranked'] as const).map((m) => (
            <button
              type="button"
              key={m}
              className={m === matchMode ? 'on' : ''}
              onClick={() => onMatchMode(m)}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="ll-league">
          <button type="button" onClick={() => setLeagueOpen((v) => !v)}>
            <small>League</small> {LEAGUE_NAMES[tier]}
          </button>
          {leagueOpen && (
            <div className="ll-league-menu">
              <p>
                The reference is one league of Valve display ranks, ranked games only. A league under
                500 player-games at a minute is not drawn.
              </p>
              {LEAGUE_TIERS.map((t) => (
                <button
                  type="button"
                  key={t}
                  className={t === tier ? 'on' : ''}
                  onClick={() => {
                    onTier(t);
                    setLeagueOpen(false);
                  }}
                >
                  <span>{LEAGUE_NAMES[t]}</span>
                  <small className="tnum">
                    {leagueSamples.has(t) ? `${count(leagueSamples.get(t) ?? 0)} player-games` : ''}
                  </small>
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="ll-pill tnum">
          <span className="ll-dot" />
          Games through {horizonLabel}
        </span>
      </div>
    </div>
  );
}
