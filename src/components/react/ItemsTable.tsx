//Items win-rate table island (mount with client:load on /items).
//
//Carries THE BUG FIX (requirements §B.5 / §7.7): the rank bracket is selected
//with BucketFilter, whose options are labelled by BADGE TIERS / emblems
//("Ascendant – Eternus"), never the MMR-score ranges the old UI showed. The
//selected bucket maps straight to the integer the backend expects
//(/items/stats?bracket=0..5).
//
//SSG-friendly like HeroesTable: build-time "all ranks" rows seed React Query as
//initialData so the server render already holds the real item rows (SEO without
//JS); changing the bracket refetches that bucket client-side.
import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../lib/apiClient';
import QueryProvider from './QueryProvider';
import { DataTable, type DataTableColumn, GameIcon, WinBar } from './ui/index';
import BucketFilter from './ui/BucketFilter';
import { ITEM_BUCKETS, itemBracketParam, type RankBucket } from '../../lib/brackets';
import { count, DASH } from '../../lib/format';
import type { ItemStat } from '../../types/api';

function itemLabel(it: ItemStat): string {
  return it.item_name ?? `Item ${it.item_id}`;
}

function ItemsTableInner({ initialRows }: { initialRows: ItemStat[] }) {
  const [bucket, setBucket] = useState<RankBucket['key']>(0);

  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.items(itemBracketParam(bucket)),
    queryFn: () => api.getItems(itemBracketParam(bucket)),
    initialData: bucket === 0 ? initialRows : undefined,
    placeholderData: keepPreviousData,
  });

  const rows = data ?? [];

  const columns = useMemo<DataTableColumn<ItemStat>[]>(
    () => [
      {
        key: 'item',
        header: 'Item',
        sortValue: (it) => itemLabel(it),
        render: (it) => (
          <div className="flex" style={{ alignItems: 'center', gap: 10 }}>
            <GameIcon kind="item" name={itemLabel(it)} src={it.icon_url} size={28} />
            <span className="display" style={{ fontWeight: 600, color: 'var(--text)' }}>
              {itemLabel(it)}
            </span>
          </div>
        ),
      },
      {
        key: 'wr',
        header: 'Win rate',
        numeric: true,
        sortValue: (it) => it.win_rate ?? null,
        render: (it) => (it.win_rate == null ? <span className="faint">{DASH}</span> : <WinBar wr={it.win_rate} />),
      },
      {
        key: 'matches',
        header: 'Matches',
        numeric: true,
        sortValue: (it) => it.matches ?? it.picks ?? null,
        render: (it) => <span className="tnum">{count(it.matches ?? it.picks)}</span>,
      },
    ],
    [],
  );

  return (
    <div>
      <div className="between" style={{ marginBottom: 14, gap: 16, flexWrap: 'wrap' }}>
        <span className="label-xs">Win rate at your rank</span>
        {/* Labels are rank tiers/emblems — the documented bracket-label fix. */}
        <BucketFilter buckets={ITEM_BUCKETS} value={bucket} onChange={setBucket} ariaLabel="Item win-rate by rank" />
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(it) => it.item_id}
        loading={isPending}
        initialSort={{ key: 'wr', dir: -1 }}
        caption="Item win-rates by rank bracket (badge tiers)"
        emptyTitle={isError ? 'Item stats unavailable' : 'No items for this bracket yet'}
        emptyMessage={
          isError
            ? 'The stats API is offline — item win-rates fill in when it comes back online.'
            : 'Nothing served for this rank band yet. Try another bracket or check back after the next data refresh.'
        }
      />
    </div>
  );
}

export default function ItemsTable({ initialRows }: { initialRows: ItemStat[] }) {
  return (
    <QueryProvider>
      <ItemsTableInner initialRows={initialRows} />
    </QueryProvider>
  );
}
