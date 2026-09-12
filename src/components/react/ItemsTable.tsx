//Items index island (/items, client:load) — design 01 Items §1-§4: the sort presets,
//the sticky 12-emblem rank bar, the slot x tier category nav and the win-rate table.
//Rank is a badge tier (the filter serves the band it falls in), never an MMR score.
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, isComputing, queryKeys } from '../../lib/apiClient';
import { computingMessage } from '../../lib/apiStates';
import { useGameMode } from '../../lib/useGameMode';
import { bracketBucket, servedBandLabel } from '../../lib/heroBracket';
import QueryProvider from './QueryProvider';
import CategoryNav from './CategoryNav';
import {
  type BracketValue,
  DataTable,
  type DataTableColumn,
  FilterBar,
  GameIcon,
  Tooltip,
  WinBar,
} from './ui/index';
import type { SortState } from './ui/DataTable';
import {
  activePreset,
  ALL_CATEGORIES,
  categoryTitle,
  filterByCategory,
  hasTopHero,
  type CategorySelection,
  type ItemIndexRow,
  itemIndexRows,
  SORT_PRESETS,
} from '../../lib/itemsIndex';
import { itemTierLabel } from '../../lib/itemTiers';
import { count, DASH, duration, pct } from '../../lib/format';
import { itemDescription } from '../../lib/itemDescriptions';
import type { ItemModifier, ItemStat } from '../../types/api';

export interface ItemsHeroOption {
  hero_id: number;
  hero_name: string;
  icon_url?: string | null;
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

function ItemTooltipContent({ it }: { it: ItemIndexRow }) {
  const desc = itemDescription(it.item_id);
  const tier = itemTierLabel(it.tier);
  return (
    <div style={{ display: 'grid', gap: 9, minWidth: 190 }}>
      <div className="flex" style={{ alignItems: 'center', gap: 9 }}>
        <GameIcon kind="item" name={itemLabel(it)} src={it.icon_url} size={26} />
        <span className="display" style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>
          {itemLabel(it)}
        </span>
      </div>
      {tier && (
        <div className="faint" style={{ fontSize: 11.5 }}>
          {it.slot ? `${it.slotTier.split(' · ')[0]} · ` : ''}
          {tier}
          {it.cost != null ? ` · ${count(it.cost)} souls` : ''}
        </div>
      )}
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

function ItemsTableInner({
  initialRows,
  initialCatalog,
  heroes,
  currentPath,
  statsThrough,
}: {
  initialRows: ItemStat[];
  initialCatalog: ItemModifier[];
  heroes: ItemsHeroOption[];
  currentPath: string;
  statsThrough?: string;
}) {
  const { mode } = useGameMode();
  const [bracket, setBracket] = useState<BracketValue>('all');
  const [category, setCategory] = useState<CategorySelection>(ALL_CATEGORIES);
  const [sort, setSort] = useState<SortState>(SORT_PRESETS[0]!.sort);
  const bucket = bracketBucket(bracket);

  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.items(bucket, mode),
    queryFn: () => api.getItems(bucket, mode),
    //Seed only the view the rows were baked for (all ranks, Normal); every other band fetches.
    initialData: bucket == null && mode === 'Normal' ? initialRows : undefined,
    placeholderData: keepPreviousData,
  });

  //Slot, tier and cost live in the shop catalog, not in the stats row.
  const { data: catalog = initialCatalog } = useQuery({
    queryKey: queryKeys.itemModifiers(),
    queryFn: () => api.getItemModifiers(),
    initialData: initialCatalog.length > 0 ? initialCatalog : undefined,
    staleTime: 60 * 60_000,
  });

  const heroById = useMemo(() => new Map(heroes.map((h) => [h.hero_id, h])), [heroes]);
  const joined = useMemo(() => itemIndexRows(data ?? [], catalog), [data, catalog]);
  const rows = useMemo(() => filterByCategory(joined, category), [joined, category]);
  const showTopHero = hasTopHero(joined);

  const columns = useMemo<DataTableColumn<ItemIndexRow>[]>(() => {
    const cols: DataTableColumn<ItemIndexRow>[] = [
      {
        key: 'item',
        header: 'Item',
        sortValue: (it) => itemLabel(it),
        //`asChild`: the link itself is the tooltip trigger (one tab stop, aria-describedby on the <a>).
        render: (it) => (
          <Tooltip asChild content={<ItemTooltipContent it={it} />}>
            <a className="itemsx-item" href={`/items/${it.item_id}/`}>
              <GameIcon kind="item" name={itemLabel(it)} src={it.icon_url} size={28} />
              <span className="itemsx-item-text">
                <span className="display itemsx-name">{itemLabel(it)}</span>
                {(it.slotTier || it.cost != null) && (
                  <span className="itemsx-sub">
                    {[it.slotTier, it.cost != null ? `${count(it.cost)} souls` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                )}
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
        key: 'buy',
        header: 'Avg buy',
        numeric: true,
        sortValue: (it) => it.avg_buy_time_s ?? null,
        render: (it) =>
          it.avg_buy_time_s == null ? (
            <span className="faint">{DASH}</span>
          ) : (
            <span className="tnum">{duration(it.avg_buy_time_s)}</span>
          ),
      },
    ];
    if (showTopHero) {
      cols.push({
        key: 'on',
        header: 'Most bought on',
        sortValue: (it) => (it.top_hero ? (heroById.get(it.top_hero.hero_id)?.hero_name ?? null) : null),
        render: (it) => {
          const top = it.top_hero;
          const hero = top ? heroById.get(top.hero_id) : undefined;
          if (!top) return <span className="faint">{DASH}</span>;
          const name = hero?.hero_name ?? `Hero ${top.hero_id}`;
          return (
            <span className="itemsx-on">
              <GameIcon kind="hero" name={name} src={hero?.icon_url} size={22} />
              <span className="itemsx-on-text">
                <span className="display itemsx-name">{name}</span>
                <span className="itemsx-sub tnum">{pct(top.share_of_games, 0)} of buys</span>
              </span>
            </span>
          );
        },
      });
    }
    cols.push({
      key: 'matches',
      header: 'Matches',
      numeric: true,
      sortValue: (it) => it.matches ?? it.picks ?? null,
      render: (it) => <span className="tnum">{count(it.matches ?? it.picks)}</span>,
    });
    return cols;
  }, [heroById, showTopHero]);

  const band = servedBandLabel(bracket);
  const preset = activePreset(sort);
  const modeLabel = mode === 'StreetBrawl' ? 'Street Brawl' : 'Normal';

  return (
    <div>
      <FilterBar bracket={bracket} onBracketChange={setBracket} currentPath={currentPath} />

      <div className="itemsx-presets">
        <span className="label-xs">Sort</span>
        <div className="sortpresets" role="group" aria-label="Sort the item table">
          {SORT_PRESETS.map((p) => {
            const on = preset?.key === p.key;
            return (
              <button
                type="button"
                key={p.key}
                className={'sortpreset' + (on ? ' on' : '')}
                aria-pressed={on}
                onClick={() => setSort(p.sort)}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <CategoryNav value={category} onChange={setCategory} />

      <div className="itemsx-head">
        <span className="display itemsx-title">{categoryTitle(category)}</span>
        <span className="mono itemsx-meta">
          {count(rows.length)} items · sorted by {preset ? preset.label : 'this column'} · {band}
        </span>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(it) => it.item_id}
        loading={isPending}
        sort={sort}
        onSortChange={setSort}
        caption={`Item win rates for ${categoryTitle(category)} at ${band} (badge tiers), with the average buy time`}
        emptyTitle={
          //202 = healthy, deliberately gating; "offline" is reserved for real network/5xx failure.
          isComputing(error)
            ? 'Item stats are computing'
            : isError
              ? 'Item stats unavailable'
              : category.slot
                ? `No ${categoryTitle(category)} rows in this band yet`
                : 'No items for this band yet'
        }
        emptyMessage={
          isComputing(error)
            ? computingMessage('item win-rates are being generated', error)
            : isError
              ? 'The stats API is offline — item win-rates fill in when it comes back online.'
              : 'No data for this category and rank band yet. Try another band or category, or check back after the next refresh.'
        }
      />

      <p className="itemsx-foot">
        Win rate, matches and average buy time: deadlock-api.com item aggregates, {modeLabel} · {band}
        {statsThrough ? `, through ${statsThrough}` : ''}. Category, tier and cost: the item catalog (
        {count(catalog.length)} buildable items; {count(joined.length)} carry win-rate rows this band).
        {!showTopHero && ' "Most bought on" appears once the item-hero fold serves its first rows.'} Rank means
        badge tier, never an MMR number.
      </p>
    </div>
  );
}

export default function ItemsTable({
  initialRows,
  initialCatalog = [],
  heroes = [],
  currentPath = '/items',
  statsThrough,
}: {
  initialRows: ItemStat[];
  initialCatalog?: ItemModifier[];
  heroes?: ItemsHeroOption[];
  currentPath?: string;
  statsThrough?: string;
}) {
  return (
    <QueryProvider>
      <ItemsTableInner
        initialRows={initialRows}
        initialCatalog={initialCatalog}
        heroes={heroes}
        currentPath={currentPath}
        statsThrough={statsThrough}
      />
    </QueryProvider>
  );
}
