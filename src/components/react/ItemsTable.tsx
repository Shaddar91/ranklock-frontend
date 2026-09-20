//Items index island (/items, client:load): the slot x tier category nav and the
//win-rate table card. The rank bar and the sort presets are sibling islands sharing
//itemsIndexState. The rows are deadlock-api.com aggregates, whose rank filter is the
//match's average rank (the bar's tier maps to the bracket it falls in).
import { useCallback, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, isComputing, queryKeys } from '../../lib/apiClient';
import { computingMessage } from '../../lib/apiStates';
import { useGameMode } from '../../lib/useGameMode';
import { bracketBucket, servedBandLabel, upstreamRankScope } from '../../lib/heroBracket';
import { useItemsBracket, useItemsSort } from '../../lib/itemsIndexState';
import { itemPath } from '../../lib/itemSlugs';
import QueryProvider from './QueryProvider';
import CategoryNav from './CategoryNav';
import { DataTable, type DataTableColumn, GameIcon, ItemHoverCard, WinBar } from './ui/index';
import {
  activePreset,
  ALL_CATEGORIES,
  categoryTitle,
  filterByCategory,
  hasTopHero,
  slotClass,
  type CategorySelection,
  type ItemIndexRow,
  itemIndexRows,
} from '../../lib/itemsIndex';
import { count, DASH, duration, pct } from '../../lib/format';
import { itemAbility } from '../../lib/itemDescriptions';
import { overlayFromWire, upgradesFor, type ItemOverlayData } from '../../lib/itemOverlay';
import type { ItemModifier, ItemStat } from '../../types/api';

export interface ItemsHeroOption {
  hero_id: number;
  hero_name: string;
  icon_url?: string | null;
}

function itemLabel(it: ItemStat): string {
  return it.item_name ?? `Item ${it.item_id}`;
}

function ItemsTableInner({
  initialRows,
  initialCatalog,
  heroes,
  statsThrough,
}: {
  initialRows: ItemStat[];
  initialCatalog: ItemModifier[];
  heroes: ItemsHeroOption[];
  statsThrough?: string;
}) {
  const { mode } = useGameMode();
  const { bracket } = useItemsBracket();
  const { sort, setSort } = useItemsSort();
  const [category, setCategory] = useState<CategorySelection>(ALL_CATEGORIES);
  const bucket = bracketBucket(bracket);

  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.items(bucket, mode),
    queryFn: () => api.getItems(bucket, mode),
    //Seed only the view the rows were baked for (all ranks, Normal); every other bracket fetches.
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

  //One card model per item from the modifiers payload — the stats row carries no modifiers.
  const overlays = useMemo(
    () => new Map((catalog ?? []).filter((r) => r.item_id != null).map((r) => [r.item_id as number, overlayFromWire(r)])),
    [catalog],
  );

  const heroById = useMemo(() => new Map(heroes.map((h) => [h.hero_id, h])), [heroes]);
  const cardFor = useCallback(
    (it: ItemIndexRow): ItemOverlayData =>
      overlays.get(it.item_id) ?? {
        id: it.item_id,
        name: itemLabel(it),
        icon: it.icon_url ?? null,
        slot: it.slot,
        tier: it.tier,
        cost: it.cost,
        brawl: false,
        modifiers: [],
        upgradesFrom: upgradesFor(it.item_id),
        upgradesInto: [],
        cooldown: null,
        ability: itemAbility(it.item_id),
      },
    [overlays],
  );
  const joined = useMemo(() => itemIndexRows(data ?? [], catalog), [data, catalog]);
  const rows = useMemo(() => filterByCategory(joined, category), [joined, category]);
  const topHeroServed = hasTopHero(joined);

  const columns = useMemo<DataTableColumn<ItemIndexRow>[]>(
    () => [
      {
        key: 'item',
        header: 'Item',
        sortValue: (it) => itemLabel(it),
        //`asChild`: the link itself is the card trigger (one tab stop, aria-describedby on the <a>).
        render: (it) => (
          <ItemHoverCard asChild data={cardFor(it)}>
            <a className={`itemsx-item ${slotClass(it.slot)}`} href={itemPath(it.item_id)}>
              <GameIcon kind="item" name={itemLabel(it)} src={it.icon_url} size={32} />
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
          </ItemHoverCard>
        ),
      },
      {
        key: 'players',
        header: 'Players',
        numeric: true,
        width: 92,
        sortValue: (it) => it.players ?? null,
        render: (it) =>
          it.players == null ? <span className="faint">{DASH}</span> : <span className="tnum">{count(it.players)}</span>,
      },
      {
        key: 'wr',
        header: 'Win rate',
        width: 182,
        sortValue: (it) => it.win_rate ?? null,
        render: (it) => (it.win_rate == null ? <span className="faint">{DASH}</span> : <WinBar wr={it.win_rate} />),
      },
      {
        key: 'buy',
        header: 'Avg buy',
        numeric: true,
        width: 92,
        sortValue: (it) => it.avg_buy_time_s ?? null,
        render: (it) =>
          it.avg_buy_time_s == null ? (
            <span className="faint">{DASH}</span>
          ) : (
            <span className="tnum itemsx-dim">{duration(it.avg_buy_time_s)}</span>
          ),
      },
      {
        key: 'on',
        header: 'Most bought on',
        width: 162,
        sortable: topHeroServed,
        sortValue: (it) => (it.top_hero ? (heroById.get(it.top_hero.hero_id)?.hero_name ?? null) : null),
        render: (it) => {
          const top = it.top_hero;
          if (!top) return <span className="faint">{DASH}</span>;
          const hero = heroById.get(top.hero_id);
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
      },
      {
        key: 'matches',
        header: 'Matches',
        numeric: true,
        width: 108,
        sortValue: (it) => it.matches ?? it.picks ?? null,
        render: (it) => <span className="tnum itemsx-dim">{count(it.matches ?? it.picks)}</span>,
      },
    ],
    [cardFor, heroById, topHeroServed],
  );

  const band = servedBandLabel(bracket);
  const scope = upstreamRankScope(bracket);
  const preset = activePreset(sort);
  const modeLabel = mode === 'StreetBrawl' ? 'Street Brawl' : 'Normal';

  return (
    <>
      <CategoryNav value={category} onChange={setCategory} />

      <div className="itemsx-card">
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
          caption={`Item win rates for ${categoryTitle(category)}, ${scope}, with the average buy time`}
          emptyTitle={
            //202 = healthy, deliberately gating; "offline" is reserved for real network/5xx failure.
            isComputing(error)
              ? 'Item stats are computing'
              : isError
                ? 'Item stats unavailable'
                : category.slot
                  ? `No ${categoryTitle(category)} rows at this rank yet`
                  : 'No items at this rank yet'
          }
          emptyMessage={
            isComputing(error)
              ? computingMessage('item win-rates are being generated', error)
              : isError
                ? 'The stats API is offline. Item win-rates fill in when it comes back online.'
                : 'No data for this category at this rank yet. Try another rank or category, or check back after the next refresh.'
          }
        />
      </div>

      <p className="itemsx-foot">
        Players, win rate, matches and average buy time: deadlock-api.com item aggregates, {modeLabel} · {band}
        {statsThrough ? `, through ${statsThrough}` : ''}. Category, tier and cost: the item catalog (
        {count(catalog.length)} buildable items; {count(joined.length)} carry win-rate rows at this rank).
        {!topHeroServed && ' Most bought on is computing. The item-hero fold has served no rows yet.'} The rank
        filter here is deadlock-api.com&apos;s, keyed on the match&apos;s average rank; RankLock&apos;s own stats
        use each player&apos;s own Valve rank.
      </p>
    </>
  );
}

export default function ItemsTable({
  initialRows,
  initialCatalog = [],
  heroes = [],
  statsThrough,
}: {
  initialRows: ItemStat[];
  initialCatalog?: ItemModifier[];
  heroes?: ItemsHeroOption[];
  statsThrough?: string;
}) {
  return (
    <QueryProvider>
      <ItemsTableInner
        initialRows={initialRows}
        initialCatalog={initialCatalog}
        heroes={heroes}
        statsThrough={statsThrough}
      />
    </QueryProvider>
  );
}
