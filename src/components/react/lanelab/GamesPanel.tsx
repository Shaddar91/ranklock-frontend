//"Recent games and heroes" — per player, the newest games as cards and the hero ledger below them.
//Clicking a hero scopes that player's lines to it, which is the only way the page narrows one
//player without narrowing the rest.
import { useQueries } from '@tanstack/react-query';
import { api, queryKeys } from '../../../lib/apiClient';
import { count, dayDate, duration, fixed, pct } from '../../../lib/format';
import type { HeroScope, RosterSlot } from '../../../lib/laneRoster';

const GAMES_SHOWN = 6;
const HEROES_SHOWN = 4;
//Below this a hero's win rate is noise, so the card renders faded.
const THIN_HERO_GAMES = 5;

export interface GamesPanelProps {
  roster: readonly RosterSlot[];
  matchMode: 'Unranked' | 'Ranked';
  onScope: (account_id: number, scope: HeroScope) => void;
}

export default function GamesPanel({ roster, matchMode, onScope }: GamesPanelProps) {
  const matches = useQueries({
    queries: roster.map((p) => ({
      queryKey: queryKeys.playerMatches(p.account_id, { limit: GAMES_SHOWN, match_mode: matchMode }),
      queryFn: () =>
        api.getPlayerMatches(p.account_id, { limit: GAMES_SHOWN, match_mode: matchMode }),
      staleTime: 5 * 60 * 1000,
      retry: false,
    })),
  });

  const heroes = useQueries({
    queries: roster.map((p) => ({
      queryKey: queryKeys.playerHeroes(p.account_id, 'Normal'),
      queryFn: () => api.getPlayerHeroes(p.account_id, 'Normal'),
      staleTime: 10 * 60 * 1000,
      retry: false,
    })),
  });

  return (
    <section className="ll-games">
      {roster.map((p, i) => {
        const games = matches[i]?.data ?? [];
        const ledger = (heroes[i]?.data ?? []).slice(0, HEROES_SHOWN);
        return (
          <div className="ll-games-block" key={p.account_id}>
            <header className="ll-sc-head">
              <div>
                <div className="kicker">Recent games</div>
                <h2 className="h-sec">
                  <span className="ll-dot" style={{ background: p.color }} />
                  {p.name}
                </h2>
              </div>
              <p className="ll-sc-note">
                {games.length === 0
                  ? `No ${matchMode} games in the window`
                  : `Newest first · ${games.length} shown · each card opens the match`}
              </p>
            </header>

            <div className="ll-cards">
              {games.map((g) => (
                <a className="ll-card" href={`/matches/${g.match_id}/`} key={g.match_id}>
                  <div className="ll-card-top">
                    <span className="ll-card-hero">{g.hero_name}</span>
                    <span className={`ll-card-res ${g.winner ? 'win' : 'loss'}`}>
                      {g.winner ? 'win' : 'loss'}
                    </span>
                  </div>
                  <div className="ll-card-kda tnum">
                    {g.kills}/{g.deaths}/{g.assists} · {count(g.net_worth)}
                  </div>
                  <div className="ll-card-meta tnum">
                    {duration(g.duration_s)} · {dayDate(g.start_time)}
                  </div>
                </a>
              ))}
            </div>

            {ledger.length > 0 && (
              <>
                <header className="ll-sc-head">
                  <div className="kicker">Heroes</div>
                  <p className="ll-sc-note">Click a hero to scope {p.name}&rsquo;s lines to it</p>
                </header>
                <div className="ll-cards">
                  {ledger.map((h) => {
                    const on = p.scope.hero_id === h.hero_id;
                    return (
                      <button
                        type="button"
                        key={h.hero_id}
                        className={`ll-hero${on ? ' on' : ''}${h.matches < THIN_HERO_GAMES ? ' thin' : ''}`}
                        onClick={() =>
                          onScope(
                            p.account_id,
                            on
                              ? { hero_id: null, hero_name: null }
                              : { hero_id: h.hero_id, hero_name: h.hero_name },
                          )
                        }
                        title={
                          on
                            ? `Back to all of ${p.name}'s heroes`
                            : `Scope ${p.name} to ${h.hero_name}`
                        }
                      >
                        {h.icon_url ? (
                          <img src={h.icon_url} alt="" width={36} height={36} loading="lazy" />
                        ) : (
                          <span className="ll-hero-mono">{h.hero_name.slice(0, 2)}</span>
                        )}
                        <span className="ll-hero-body">
                          <span className="ll-hero-top">
                            <span>{h.hero_name}</span>
                            <span
                              className={`tnum ${(h.win_rate ?? 0) >= 50 ? 'tone-good' : 'tone-bad'}`}
                            >
                              {pct(h.win_rate, 1)}
                            </span>
                          </span>
                          <span className="ll-hero-sub tnum">
                            {count(h.matches)} games · KDA {fixed(h.kda, 2)} ·{' '}
                            {count(Math.round(h.avg_net_worth ?? 0))}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}
