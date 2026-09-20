//Heroes meta table island (mount with client:load on /heroes): the design's list-table card.
//Rank comes from the sticky bar and sort from the page-head presets or the column heads, both
//through heroesIndexState. SSG-friendly: the page passes the build-time all-ranks rows as
//`initialRows`, so the first (server) render already carries the real table.
import { useMemo } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, isComputing, queryKeys } from '../../lib/apiClient';
import { computingMessage } from '../../lib/apiStates';
import { useGameMode } from '../../lib/useGameMode';
import { activeHeroPreset, useHeroesBracket, useHeroesSort } from '../../lib/heroesIndexState';
import QueryProvider from './QueryProvider';
import { DataTable, type DataTableColumn, GameIcon, WinBar, TierPill } from './ui/index';
import type { BracketValue } from './ui/BracketFilter';
import { getRank } from '../../lib/ranks';
import { heroPath, heroSlug } from '../../lib/heroSlugs';
import { count, DASH, fixed, kda, metaTier, pct, pickShare } from '../../lib/format';
import type { HeroSummary } from '../../types/api';

//A BracketValue → the API's `band` param (absent for 'all' so the backend serves the all-ranks view).
const bandParam = (v: BracketValue): number | undefined => (v === 'all' ? undefined : v);

//A roster hero the stats pipeline has never tracked: picks=0 and every stat null. Rendered as a
//dimmed "no tracked matches yet" row instead of fabricated zeros.
const isRosterOnly = (h: HeroSummary): boolean => h.win_rate == null && (h.picks ?? 0) === 0;

function HeroCell({ hero }: { hero: HeroSummary }) {
  const rosterOnly = isRosterOnly(hero);
  return (
    <a className="itemsx-item" href={heroPath(hero.hero_name)} style={rosterOnly ? { opacity: 0.55 } : undefined}>
      <GameIcon kind="hero" name={hero.hero_name} src={hero.icon_url} size={30} />
      <span className="itemsx-item-text">
        <span className="display itemsx-name">{hero.hero_name}</span>
        {rosterOnly && <span className="itemsx-sub">no tracked matches yet</span>}
      </span>
    </a>
  );
}

interface HeroesTableProps {
  initialRows: HeroSummary[];
  guideSlugs: string[];
  statsThrough?: string | null;
}

function HeroesTableInner({ initialRows, guideSlugs, statsThrough }: HeroesTableProps) {
  const { mode } = useGameMode();
  const { bracket } = useHeroesBracket();
  const { sort, setSort } = useHeroesSort();

  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.heroes({ band: bracket === 'all' ? 'all' : bracket, game_mode: mode }),
    queryFn: () => api.getHeroes({ band: bandParam(bracket), game_mode: mode }),
    //The SSG seed is the default-mode all-ranks page; a `?mode=brawl` deep link never paints
    //Brawl-keyed rows from a Normal seed.
    initialData: bracket === 'all' && mode === 'Normal' ? initialRows : undefined,
    placeholderData: keepPreviousData,
  });

  const rows = data ?? [];
  const totalPicks = useMemo(() => rows.reduce((sum, h) => sum + (h.picks ?? 0), 0), [rows]);
  const tracked = useMemo(() => rows.filter((h) => !isRosterOnly(h)).length, [rows]);

  const guides = useMemo(() => new Set(guideSlugs), [guideSlugs]);
  const columns = useMemo<DataTableColumn<HeroSummary>[]>(() => {
    const cols: DataTableColumn<HeroSummary>[] = [
      { key: 'hero', header: 'Hero', sortValue: (h) => h.hero_name, render: (h) => <HeroCell hero={h} /> },
      {
        key: 'tier',
        header: 'Tier',
        sortValue: (h) => h.win_rate,
        render: (h) => {
          const t = metaTier(h.win_rate);
          return t ? <TierPill tier={t} /> : <span className="faint">{DASH}</span>;
        },
      },
      {
        key: 'wr',
        header: 'Win rate',
        numeric: true,
        sortValue: (h) => h.win_rate,
        render: (h) => (h.win_rate == null ? <span className="faint">{DASH}</span> : <WinBar wr={h.win_rate} />),
      },
      {
        key: 'pick',
        header: 'Pick rate',
        numeric: true,
        sortValue: (h) => h.picks,
        render: (h) =>
          isRosterOnly(h) ? (
            <span className="faint">{DASH}</span>
          ) : (
            <span className="tnum">{pct(pickShare(h.picks, totalPicks))}</span>
          ),
      },
      {
        key: 'kda',
        header: 'KDA',
        numeric: true,
        sortValue: (h) => kda(h.avg_kills, h.avg_deaths, h.avg_assists),
        render: (h) => <span className="tnum">{fixed(kda(h.avg_kills, h.avg_deaths, h.avg_assists))}</span>,
      },
      {
        key: 'games',
        header: 'Games',
        numeric: true,
        sortValue: (h) => h.picks,
        render: (h) =>
          isRosterOnly(h) ? <span className="faint">{DASH}</span> : <span className="tnum itemsx-dim">{count(h.picks)}</span>,
      },
      {
        key: 'play',
        header: '',
        //Guide-gated route: a hero with no guide file gets an empty cell, never a link to a 404.
        render: (h) =>
          guides.has(heroSlug(h.hero_name)) ? (
            <a className="kicker" href={`${heroPath(h.hero_name)}guide/`} aria-label={`How to play ${h.hero_name}`}>
              How to play
            </a>
          ) : null,
      },
    ];
    return guides.size > 0 ? cols : cols.filter((c) => c.key !== 'play');
  }, [totalPicks, guides]);

  const rankLabel = bracket === 'all' ? 'All ranks' : getRank(bracket).name;
  const sortLabel = activeHeroPreset(sort)?.label ?? 'column';

  return (
    <>
      <div className="itemsx-card">
        <div className="itemsx-head">
          <span className="display itemsx-title">{rankLabel}</span>
          <span className="mono itemsx-meta">
            {tracked} heroes · {mode === 'Normal' ? 'Normal' : 'Brawl'} · sorted by {sortLabel}
          </span>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(h) => h.hero_id}
          loading={isPending}
          sort={sort}
          onSortChange={setSort}
          caption="Hero meta: win rate, pick rate, KDA and games by the player's own rank"
          emptyTitle={
            isComputing(error) ? 'Hero meta is computing' : isError ? 'Hero meta unavailable' : 'No heroes for this rank yet'
          }
          emptyMessage={
            isComputing(error)
              ? computingMessage('the hero meta table is being generated', error)
              : isError
                ? 'The stats API is offline. The meta table fills in when it comes back online.'
                : 'No data for players at this rank yet. Try another rank or check back after the next refresh. Low ranks are sampled thinly.'
          }
        />
      </div>
      <p className="itemsx-foot">
        Win rate, pick rate and KDA: RankLock public matches, ranked, players at the rank bar's tier
        {statsThrough ? `, through ${statsThrough}` : ''}. Tier is RankLock's own cut on win rate. Rank = the
        player's own Valve rank, ranked games since 7 Aug 2026.
      </p>
    </>
  );
}

export default function HeroesTable(props: HeroesTableProps) {
  return (
    <QueryProvider>
      <HeroesTableInner {...props} />
    </QueryProvider>
  );
}
