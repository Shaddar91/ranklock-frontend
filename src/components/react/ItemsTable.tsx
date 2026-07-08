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
import type { ReactNode } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../lib/apiClient';
import { useGameMode } from '../../lib/useGameMode';
import QueryProvider from './QueryProvider';
import { DataTable, type DataTableColumn, GameIcon, Tooltip, WinBar } from './ui/index';
import BucketFilter from './ui/BucketFilter';
import { ITEM_BUCKETS, itemBracketParam, type RankBucket } from '../../lib/brackets';
import { count, DASH, pct } from '../../lib/format';
import { itemDescription } from '../../lib/itemDescriptions';
import type { ItemStat } from '../../types/api';

function itemLabel(it: ItemStat): string {
  return it.item_name ?? `Item ${it.item_id}`;
}

//One label/value line inside the hover popover.
function TipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="between" style={{ gap: 20 }}>
      <span className="label-xs" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>
        {label}
      </span>
      <span className="tnum" style={{ fontWeight: 600, color: 'var(--text)' }}>
        {children}
      </span>
    </div>
  );
}

//Hover/focus popover body for one item — reads straight off the already-enriched
//row (no fetch). Win-rate is empty-stated with a note while the compute job that
//restores it (ranklock-app-fix-all-and-reprocess C3) is still degraded.
function ItemTooltipContent({ it }: { it: ItemStat }) {
  //"What it does" text from the lean item-descriptions catalog (null for the ~99
  //items with no upstream description — those keep the original stats-only popover).
  const desc = itemDescription(it.item_id);
  return (
    <div style={{ display: 'grid', gap: 9, minWidth: 190 }}>
      <div className="flex" style={{ alignItems: 'center', gap: 9 }}>
        <GameIcon kind="item" name={itemLabel(it)} src={it.icon_url} size={26} />
        <span className="display" style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>
          {itemLabel(it)}
        </span>
      </div>
      {desc && (
        <p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.4 }}>
          {desc}
        </p>
      )}
      <div style={{ height: 1, background: 'var(--border)' }} />
      <div style={{ display: 'grid', gap: 7 }}>
        <TipRow label="Win rate">
          {it.win_rate == null ? (
            <span className="faint">{DASH}</span>
          ) : (
            <span style={{ color: it.win_rate >= 50 ? 'var(--win)' : 'var(--loss)' }}>{pct(it.win_rate)}</span>
          )}
        </TipRow>
        <TipRow label="Matches">{count(it.matches ?? it.picks)}</TipRow>
      </div>
      {it.win_rate == null && (
        <div className="faint" style={{ fontSize: 11, lineHeight: 1.3 }}>
          Win rate fills in after the next data refresh.
        </div>
      )}
    </div>
  );
}

function ItemsTableInner({ initialRows }: { initialRows: ItemStat[] }) {
  const { mode } = useGameMode();
  const [bucket, setBucket] = useState<RankBucket['key']>(0);

  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.items(itemBracketParam(bucket), mode),
    queryFn: () => api.getItems(itemBracketParam(bucket), mode),
    //Seed only the default-mode "all ranks" view (see HeroesTable for the rationale).
    initialData: bucket === 0 && mode === 'Normal' ? initialRows : undefined,
    placeholderData: keepPreviousData,
  });

  const rows = data ?? [];

  const columns = useMemo<DataTableColumn<ItemStat>[]>(
    () => [
      {
        key: 'item',
        header: 'Item',
        sortValue: (it) => itemLabel(it),
        //The item name is BOTH a stats-tooltip trigger AND a link to /items/{id}
        //(mirrors HeroCell). `asChild` makes the <a> the tooltip trigger itself, so
        //there's one tab stop and aria-describedby lands on the link (see Tooltip).
        render: (it) => (
          <Tooltip asChild content={<ItemTooltipContent it={it} />}>
            <a
              className="flex"
              href={`/items/${it.item_id}`}
              style={{ alignItems: 'center', gap: 10, textDecoration: 'none', cursor: 'pointer' }}
            >
              <GameIcon kind="item" name={itemLabel(it)} src={it.icon_url} size={28} />
              <span className="display" style={{ fontWeight: 600, color: 'var(--text)' }}>
                {itemLabel(it)}
              </span>
            </a>
          </Tooltip>
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
