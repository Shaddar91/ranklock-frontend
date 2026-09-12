//Hero Overview §7 — what players buy (rank-aware) beside what wins (Wilson-ranked).
//The win-rate table joins names/icons from the catalog because the served rows carry
//only item_id, and it stays on the all-rank aggregate: the per-band fold has no rows
//yet, so banding it would empty the table instead of answering the filter.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../../lib/apiClient';
import { useGameMode } from '../../../lib/useGameMode';
import { bracketBucket, servedBandLabel, useHeroBracket } from '../../../lib/heroBracket';
import { overlayFromWire, upgradesFor, type ItemOverlayData } from '../../../lib/itemOverlay';
import { itemAbility } from '../../../lib/itemDescriptions';
import { count, DASH } from '../../../lib/format';
import GameIcon from '../ui/GameIcon';
import SectionHeader from '../ui/SectionHeader';
import EmptyState from '../ui/EmptyState';
import Tooltip from '../ui/Tooltip';
import ItemOverlayCard from '../ui/ItemOverlayCard';
import type { ItemStat } from '../../../types/api';

export interface ItemCatalogEntry {
  name: string;
  icon: string | null;
  slot: string | null;
  tier: number | null;
  cost: number | null;
  slotTier: string;
}

export interface WinRateRow {
  itemId: number;
  name: string;
  winRate: number;
  wilson: number;
  games: number;
}

export interface HeroItemTablesProps {
  heroId: number;
  heroName: string;
  initialItemStats: ItemStat[];
  winRateRows: WinRateRow[];
  catalog: Record<string, ItemCatalogEntry>;
  rows?: number;
}

const EMPTY: ItemCatalogEntry = { name: '', icon: null, slot: null, tier: null, cost: null, slotTier: '' };

export default function HeroItemTables({
  heroId,
  heroName,
  initialItemStats,
  winRateRows,
  catalog,
  rows = 8,
}: HeroItemTablesProps) {
  const { bracket } = useHeroBracket();
  const { mode } = useGameMode();
  const bucket = bracketBucket(bracket);
  const isDefault = bucket == null && mode === 'Normal';

  const { data: itemStats = [] } = useQuery({
    queryKey: queryKeys.items(bucket, mode, heroId),
    queryFn: () => api.getItems(bucket, mode, heroId),
    initialData: isDefault ? initialItemStats : undefined,
    staleTime: 5 * 60_000,
  });

  //Full modifier rows back the hover card; until they land the card renders from the
  //compact catalog entry the page baked, never a blank overlay.
  const { data: modifiers } = useQuery({
    queryKey: queryKeys.itemModifiers(),
    queryFn: () => api.getItemModifiers(),
    staleTime: 60 * 60_000,
  });

  const overlays = useMemo(
    () => new Map((modifiers ?? []).map((r) => [r.item_id, overlayFromWire(r)] as const)),
    [modifiers],
  );

  const meta = (id: number): ItemCatalogEntry => catalog[String(id)] ?? EMPTY;

  const overlayFor = (id: number, name: string, icon: string | null): ItemOverlayData => {
    const full = overlays.get(id);
    if (full) return full;
    const m = meta(id);
    return {
      id,
      name,
      icon: icon ?? m.icon,
      slot: m.slot,
      tier: m.tier,
      cost: m.cost,
      brawl: false,
      modifiers: [],
      upgradesFrom: upgradesFor(id),
      ability: itemAbility(id),
    };
  };

  const ItemCell = ({ id, name, icon }: { id: number; name: string; icon: string | null }) => (
    <Tooltip content={<ItemOverlayCard data={overlayFor(id, name, icon)} />} asChild>
      <a className="itbl-item" href={`/items/${id}/`}>
        <GameIcon kind="item" name={name} src={icon ?? meta(id).icon} size={28} />
        <span className="itbl-item-text">
          <span className="display itbl-name">{name}</span>
          <span className="itbl-sub">{meta(id).slotTier}</span>
        </span>
      </a>
    </Tooltip>
  );

  const popular = useMemo(
    () =>
      [...itemStats]
        .filter((r) => (r.matches ?? 0) > 0)
        .sort((a, b) => (b.matches ?? 0) - (a.matches ?? 0))
        .slice(0, rows),
    [itemStats, rows],
  );

  return (
    <section id="items">
      <SectionHeader
        kicker="What players buy vs what wins"
        title={`Items on ${heroName}`}
        note={
          <>
            {`Buys and average buy minute: RankLock public matches · ${servedBandLabel(bracket)}. Win rates rank by Wilson lower bound over all ranks — the per-rank item fold has no rows yet, so that table does not follow the filter.`}
          </>
        }
      />
      <div className="itbl-grid">
        <div className="panel itbl">
          <div className="itbl-row itbl-head itbl-cols-bought">
            <span className="display itbl-title">Most bought</span>
            <span className="label-xs num">Buys</span>
            <span className="label-xs num">Avg min</span>
            <span className="label-xs num">WR</span>
          </div>
          {popular.length === 0 ? (
            <EmptyState title="Computing" message="Item buys for this rank are still folding. This block refreshes hourly." />
          ) : (
            popular.map((r) => {
              const name = r.item_name ?? meta(r.item_id).name ?? `Item ${r.item_id}`;
              const wr = r.win_rate ?? 0;
              return (
                <div className="itbl-row itbl-cols-bought" key={r.item_id}>
                  <ItemCell id={r.item_id} name={name} icon={r.icon_url ?? null} />
                  <span className="tnum num">{count(r.matches)}</span>
                  <span className="tnum num muted">
                    {r.avg_buy_time_s == null ? DASH : `${Math.round(r.avg_buy_time_s / 60)}′`}
                  </span>
                  <span className="tnum num" style={{ color: wr >= 50 ? 'var(--win)' : 'var(--loss)' }}>
                    {wr.toFixed(1)}%
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div className="panel itbl">
          <div className="itbl-row itbl-head itbl-cols-wr">
            <span className="display itbl-title">Highest win rate</span>
            <span className="label-xs num">WR</span>
            <span className="label-xs num">Wilson</span>
            <span className="label-xs num">Games</span>
          </div>
          {winRateRows.length === 0 ? (
            <EmptyState title="Computing" message="Item win rates are still folding. This block refreshes hourly." />
          ) : (
            winRateRows.slice(0, rows).map((r) => (
              <div className="itbl-row itbl-cols-wr" key={r.itemId}>
                <ItemCell id={r.itemId} name={r.name} icon={meta(r.itemId).icon} />
                <span className="tnum num" style={{ color: r.winRate >= 50 ? 'var(--win)' : 'var(--loss)' }}>
                  {r.winRate.toFixed(1)}%
                </span>
                <span className="tnum num muted">{r.wilson.toFixed(1)}%</span>
                <span className="tnum num muted">{count(r.games)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
