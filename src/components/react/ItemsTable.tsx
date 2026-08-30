//Items win-rate table island (/items, client:load): rank bracket by badge tier (never MMR score),
//hero scope (All heroes by default, per-hero ranking on explicit select) and the average buy time
//from the upstream row. Build-time "all ranks / all heroes" rows seed React Query for SEO.
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, isComputing, queryKeys } from '../../lib/apiClient';
import { computingMessage } from '../../lib/apiStates';
import { useGameMode } from '../../lib/useGameMode';
import QueryProvider from './QueryProvider';
import { DataTable, type DataTableColumn, GameIcon, Tooltip, WinBar } from './ui/index';
import BucketFilter from './ui/BucketFilter';
import { ITEM_BUCKETS, itemBracketParam, itemHeroParam, type RankBucket } from '../../lib/brackets';
import { count, DASH, duration, pct } from '../../lib/format';
import { itemDescription } from '../../lib/itemDescriptions';
import type { ItemStat } from '../../types/api';

export interface ItemsHeroOption {
  hero_id: number;
  hero_name: string;
}

function itemLabel(it: ItemStat): string {
  return it.item_name ?? `Item ${it.item_id}`;
}

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

function ItemTooltipContent({ it }: { it: ItemStat }) {
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
        <TipRow label="Avg buy time">
          {it.avg_buy_time_s == null ? <span className="faint">{DASH}</span> : duration(it.avg_buy_time_s)}
        </TipRow>
        {it.avg_buy_time_relative != null && (
          <TipRow label="Bought at">{pct(it.avg_buy_time_relative, 0)} of the match</TipRow>
        )}
      </div>
      {it.win_rate == null && (
        <div className="faint" style={{ fontSize: 11, lineHeight: 1.3 }}>
          Win rate fills in after the next data refresh.
        </div>
      )}
    </div>
  );
}

function ItemsTableInner({ initialRows, heroes }: { initialRows: ItemStat[]; heroes: ItemsHeroOption[] }) {
  const { mode } = useGameMode();
  const [bucket, setBucket] = useState<RankBucket['key']>(0);
  const [hero, setHero] = useState(0);

  const heroOptions = useMemo(
    () => heroes.filter((h) => h.hero_name?.trim()).sort((a, b) => a.hero_name.localeCompare(b.hero_name)),
    [heroes],
  );
  const heroName = hero > 0 ? heroOptions.find((h) => h.hero_id === hero)?.hero_name : undefined;

  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.items(itemBracketParam(bucket), mode, itemHeroParam(hero)),
    queryFn: () => api.getItems(itemBracketParam(bucket), mode, itemHeroParam(hero)),
    //Seed only the default view (all ranks, Normal, all heroes); every other combination fetches.
    initialData: bucket === 0 && mode === 'Normal' && hero === 0 ? initialRows : undefined,
    placeholderData: keepPreviousData,
  });

  const rows = data ?? [];

  const columns = useMemo<DataTableColumn<ItemStat>[]>(
    () => [
      {
        key: 'item',
        header: 'Item',
        sortValue: (it) => itemLabel(it),
        //`asChild`: the link itself is the tooltip trigger (one tab stop, aria-describedby on the <a>).
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
      {
        key: 'buy',
        header: 'Avg buy time',
        numeric: true,
        sortValue: (it) => it.avg_buy_time_s ?? null,
        render: (it) =>
          it.avg_buy_time_s == null ? (
            <span className="faint">{DASH}</span>
          ) : (
            <span className="tnum">{duration(it.avg_buy_time_s)}</span>
          ),
      },
    ],
    [],
  );

  const scope = heroName ? `on ${heroName}` : 'across all heroes';

  return (
    <div>
      <div className="between" style={{ marginBottom: 14, gap: 16, flexWrap: 'wrap' }}>
        <span className="label-xs">{heroName ? `Win rate on ${heroName} at your rank` : 'Win rate at your rank'}</span>
        <div className="flex" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <label className="flex" style={{ alignItems: 'center', gap: 8 }}>
            <span className="label-xs">Hero</span>
            <select
              className="field"
              style={{ width: 'auto', padding: '8px 12px' }}
              value={hero}
              onChange={(e) => setHero(Number(e.target.value))}
              aria-label="Rank items on a hero"
            >
              <option value={0}>All heroes</option>
              {heroOptions.map((h) => (
                <option key={h.hero_id} value={h.hero_id}>
                  {h.hero_name}
                </option>
              ))}
            </select>
          </label>
          <BucketFilter buckets={ITEM_BUCKETS} value={bucket} onChange={setBucket} ariaLabel="Item win-rate by rank" />
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(it) => it.item_id}
        loading={isPending}
        initialSort={{ key: 'wr', dir: -1 }}
        caption={`Item win-rates ${scope} by rank bracket (badge tiers), with the average buy time`}
        emptyTitle={
          //202 = healthy, deliberately gating; "offline" is reserved for real network/5xx failure.
          isComputing(error)
            ? 'Item stats are computing'
            : isError
              ? 'Item stats unavailable'
              : heroName
                ? `No items for ${heroName} in this bracket yet`
                : 'No items for this bracket yet'
        }
        emptyMessage={
          isComputing(error)
            ? computingMessage('item win-rates are being generated', error)
            : isError
              ? 'The stats API is offline — item win-rates fill in when it comes back online.'
              : 'Nothing served for this hero and rank band yet. Try another bracket or hero, or check back after the next data refresh.'
        }
      />
    </div>
  );
}

export default function ItemsTable({ initialRows, heroes = [] }: { initialRows: ItemStat[]; heroes?: ItemsHeroOption[] }) {
  return (
    <QueryProvider>
      <ItemsTableInner initialRows={initialRows} heroes={heroes} />
    </QueryProvider>
  );
}
