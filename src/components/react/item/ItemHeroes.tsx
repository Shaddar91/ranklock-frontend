//Item detail "Heroes who build it". The RankLock fold carries the share-of-games bar;
//until it serves rows the block falls back to the baked upstream per-hero win rates, which
//have no comparable denominator, so the share column renders its cold state.
import { useQuery } from '@tanstack/react-query';
import QueryProvider from '../QueryProvider';
import { api, queryKeys } from '../../../lib/apiClient';
import { count, DASH } from '../../../lib/format';
import GameIcon from '../ui/GameIcon';
import SectionHeader from '../ui/SectionHeader';
import EmptyState from '../ui/EmptyState';
import WinBar from '../ui/WinBar';

export interface ItemHeroFallbackRow {
  heroId: number;
  name: string;
  icon: string | null;
  href: string;
  games: number;
  winRate: number;
}

export interface ItemHeroesProps {
  itemId: number;
  fallback: ItemHeroFallbackRow[];
  note: string;
  heroes: Record<string, { name: string; icon: string | null; href: string }>;
  rows?: number;
}

function HeroesBlock({ itemId, fallback, note, heroes, rows = 10 }: ItemHeroesProps) {
  const { data } = useQuery({
    queryKey: queryKeys.itemHeroes(itemId),
    queryFn: () => api.getItemHeroes(itemId),
    staleTime: 60 * 60_000,
  });

  const folded = (data?.heroes ?? []).slice(0, rows);
  const hasShare = folded.length > 0;
  const peakShare = Math.max(0, ...folded.map((h) => h.share_of_games ?? 0));

  const list = hasShare
    ? folded.map((h) => {
        const meta = heroes[String(h.hero_id)];
        return {
          key: h.hero_id,
          name: meta?.name ?? `Hero ${h.hero_id}`,
          icon: meta?.icon ?? null,
          href: meta?.href ?? null,
          games: h.games,
          winRate: h.win_rate == null ? null : h.win_rate * 100,
          share: h.share_of_games,
        };
      })
    : fallback.slice(0, rows).map((h) => ({
        key: h.heroId,
        name: h.name,
        icon: h.icon,
        href: h.href,
        games: h.games,
        winRate: h.winRate,
        share: null as number | null,
      }));

  return (
    <section id="builders">
      <SectionHeader kicker="Who wants it" title="Heroes who build it" note={note} />
      {list.length === 0 ? (
        <EmptyState
          tone="cold"
          title="Computing"
          message="No hero has a folded row for this item yet. This block refreshes hourly."
        />
      ) : (
        <div className="itemd-card itemd-heroes">
          <div className="itemd-hrow itemd-hhead">
            <span>Hero</span>
            <span>Share of games</span>
            <span>Win rate with it</span>
            <span>Games</span>
          </div>
          {list.map((h) => (
            <div className="itemd-hrow" key={h.key}>
              <a className="itemd-hero" href={h.href ?? undefined}>
                <GameIcon kind="hero" name={h.name} src={h.icon} size={26} />
                <span className="display itemd-hero-name">{h.name}</span>
              </a>
              {h.share == null ? (
                <span className="mono muted itemd-cold">{DASH}</span>
              ) : (
                <span className="itemd-share">
                  <span className="mono tnum itemd-share-val">{(h.share * 100).toFixed(1)}%</span>
                  <span className="wbar wbar-flex itemd-share-bar">
                    <i style={{ width: `${peakShare > 0 ? (h.share / peakShare) * 100 : 0}%` }} />
                  </span>
                </span>
              )}
              <span>{h.winRate == null ? DASH : <WinBar wr={h.winRate} flex />}</span>
              <span className="mono tnum muted">{count(h.games)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function ItemHeroes(props: ItemHeroesProps) {
  return (
    <QueryProvider>
      <HeroesBlock {...props} />
    </QueryProvider>
  );
}
