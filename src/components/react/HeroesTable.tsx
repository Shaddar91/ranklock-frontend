//Heroes meta table island (mount with client:load on /heroes).
//
//SSG-friendly: the page fetches the default ("all ranks") rows at BUILD time and
//passes them as `initialRows`; React Query is seeded with them as `initialData`,
//so this island's FIRST (server) render already contains the real table markup —
//the SEO HTML has hero names + win-rates present without JS (the success
//criterion). Switching the rank bucket then refetches that bracket client-side
//(api.getHeroes(low|mid|high|top)); `keepPreviousData` avoids a flash.
import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../lib/apiClient';
import QueryProvider from './QueryProvider';
import { DataTable, type DataTableColumn, GameIcon, WinBar, Delta, TierPill } from './ui/index';
import BucketFilter from './ui/BucketFilter';
import { HERO_BUCKETS, heroBracketParam, type RankBucket } from '../../lib/brackets';
import { DASH, fixed, kda, metaTier, pct, pickShare } from '../../lib/format';
import type { HeroSummary } from '../../types/api';

function HeroCell({ hero }: { hero: HeroSummary }) {
  return (
    <a className="flex" href={`/heroes/${hero.hero_id}`} style={{ alignItems: 'center', gap: 10, textDecoration: 'none' }}>
      <GameIcon kind="hero" name={hero.hero_name} src={hero.icon_url} size={30} />
      <span className="display" style={{ fontWeight: 600, color: 'var(--text)' }}>
        {hero.hero_name}
      </span>
    </a>
  );
}

function HeroesTableInner({ initialRows }: { initialRows: HeroSummary[] }) {
  const [bucket, setBucket] = useState<RankBucket['key']>('all');

  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.heroes({ bracket: bucket === 'all' ? 'all' : bucket }),
    queryFn: () => api.getHeroes({ bracket: heroBracketParam(bucket) }),
    initialData: bucket === 'all' ? initialRows : undefined,
    placeholderData: keepPreviousData,
  });

  const rows = data ?? [];
  const totalPicks = useMemo(() => rows.reduce((sum, h) => sum + (h.picks ?? 0), 0), [rows]);

  const columns = useMemo<DataTableColumn<HeroSummary>[]>(
    () => [
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
        key: 'd7',
        header: '7d',
        numeric: true,
        sortValue: (h) => h.delta_win_rate_7d ?? null,
        render: (h) =>
          h.delta_win_rate_7d == null ? <span className="faint">{DASH}</span> : <Delta value={h.delta_win_rate_7d} />,
      },
      {
        key: 'pick',
        header: 'Pick %',
        numeric: true,
        sortValue: (h) => h.picks,
        render: (h) => <span className="tnum">{pct(pickShare(h.picks, totalPicks))}</span>,
      },
      {
        key: 'kda',
        header: 'KDA',
        numeric: true,
        sortValue: (h) => kda(h.avg_kills, h.avg_deaths, h.avg_assists),
        render: (h) => <span className="tnum">{fixed(kda(h.avg_kills, h.avg_deaths, h.avg_assists))}</span>,
      },
    ],
    [totalPicks],
  );

  return (
    <div>
      <div className="between" style={{ marginBottom: 14, gap: 16, flexWrap: 'wrap' }}>
        <span className="label-xs">Meta at your rank</span>
        <BucketFilter buckets={HERO_BUCKETS} value={bucket} onChange={setBucket} ariaLabel="Hero win-rate by rank" />
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(h) => h.hero_id}
        loading={isPending}
        initialSort={{ key: 'wr', dir: -1 }}
        caption="Hero meta — win rate, momentum, pick rate and KDA by rank bracket"
        emptyTitle={isError ? 'Hero meta unavailable' : 'No heroes for this bracket yet'}
        emptyMessage={
          isError
            ? 'The stats API is offline — the meta table fills in when it comes back online.'
            : 'Nothing served for this rank band yet. Try another bracket or check back after the next data refresh.'
        }
      />
    </div>
  );
}

export default function HeroesTable({ initialRows }: { initialRows: HeroSummary[] }) {
  return (
    <QueryProvider>
      <HeroesTableInner initialRows={initialRows} />
    </QueryProvider>
  );
}
