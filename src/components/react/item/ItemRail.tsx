//Item detail rail: upgrade path, the editorial "Buy it against" block, pairs-with,
//win rate by rank and same-slot peers. Pairs and per-rank rows arrive client-side; the
//other three are baked by the page. Every item tile carries the shared hover card.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import QueryProvider from '../QueryProvider';
import { api, queryKeys } from '../../../lib/apiClient';
import { itemMeta } from '../../../lib/itemCatalog';
import { itemAbility } from '../../../lib/itemDescriptions';
import { catClass, slotTierLabel, type PeerRow } from '../../../lib/itemDetail';
import { overlayFromWire, upgradesFor, type ItemOverlayData } from '../../../lib/itemOverlay';
import { itemPath } from '../../../lib/itemSlugs';
import { rankImg } from '../../../lib/ranks';
import { count, DASH } from '../../../lib/format';
import type { CounterNote } from '../../../lib/itemEditorial';
import GameIcon from '../ui/GameIcon';
import EmptyState from '../ui/EmptyState';
import Skeleton from '../ui/Skeleton';
import ItemHoverCard from '../ui/ItemHoverCard';

export interface EdgeView {
  itemId: number;
  name: string;
  icon: string | null;
  cost: number | null;
  slot: string | null;
  mods: string;
  role: 'Component' | 'Builds into';
}

export interface ItemRailProps {
  itemId: number;
  itemName: string;
  itemIcon: string | null;
  itemSlot: string | null;
  itemMods: string;
  cost: number | null;
  components: EdgeView[];
  buildsInto: EdgeView[];
  discount: number | null;
  peers: PeerRow[];
  peerTitle: string;
  against: readonly CounterNote[];
}

//The design scales every win-rate bar across the meaningful 30–70% band.
const barWidth = (wr: number) => `${Math.max(2, Math.min(100, ((wr - 30) / 40) * 100))}%`;
const barColor = (wr: number) => (wr >= 50 ? 'var(--win)' : 'var(--loss)');
const monogram = (name: string) => {
  const words = name.replace(/&/g, '').split(/\s+/).filter(Boolean);
  const two = words.length > 1 ? `${words[0]![0]}${words[1]![0]}` : name.slice(0, 2);
  return two.toUpperCase();
};

function RailHead({ title, note }: { title: string; note?: string }) {
  return (
    <div className="itemd-railhead">
      <span className="kicker">{title}</span>
      {note && <span className="itemd-railnote">{note}</span>}
    </div>
  );
}

function RailBlocks({
  itemId,
  itemName,
  itemIcon,
  itemSlot,
  itemMods,
  cost,
  components,
  buildsInto,
  discount,
  peers,
  peerTitle,
  against,
}: ItemRailProps) {
  const { data: modifiers } = useQuery({
    queryKey: queryKeys.itemModifiers(),
    queryFn: () => api.getItemModifiers(),
    staleTime: 60 * 60_000,
  });
  const { data: pairs, isPending: pairsPending } = useQuery({
    queryKey: queryKeys.itemPairs(itemId),
    queryFn: () => api.getItemPairs(itemId),
    staleTime: 60 * 60_000,
  });
  const { data: byRank, isPending: rankPending } = useQuery({
    queryKey: queryKeys.itemRankWinRates(itemId),
    queryFn: () => api.getItemRankWinRates(itemId),
    staleTime: 60 * 60_000,
  });

  const overlays = useMemo(
    () => new Map((modifiers ?? []).map((r) => [r.item_id, overlayFromWire(r)] as const)),
    [modifiers],
  );

  const overlayFor = (id: number, name: string, icon: string | null): ItemOverlayData =>
    overlays.get(id) ?? {
      id,
      name,
      icon,
      slot: null,
      tier: null,
      cost: null,
      brawl: false,
      modifiers: [],
      upgradesFrom: upgradesFor(id),
      upgradesInto: [],
      cooldown: null,
      ability: itemAbility(id),
    };

  const ItemTile = ({
    id,
    name,
    icon,
    slot,
    sub,
    size = 28,
  }: {
    id: number;
    name: string;
    icon: string | null;
    slot: string | null;
    sub?: string;
    size?: number;
  }) => (
    <ItemHoverCard data={overlayFor(id, name, icon)} asChild>
      <a className={`itemd-tile ${catClass(slot)}`} href={itemPath(id)}>
        <GameIcon kind="item" name={name} src={icon} size={size} />
        <span className="itemd-tile-text">
          <span className="display itemd-tile-name">{name}</span>
          {sub && <span className="itemd-tile-sub">{sub}</span>}
        </span>
      </a>
    </ItemHoverCard>
  );

  const pairRows = (pairs?.pairs ?? []).map((p) => {
    const o = overlays.get(p.item_id);
    return {
      ...p,
      name: o?.name ?? itemMeta(p.item_id)?.name ?? `Item ${p.item_id}`,
      icon: o?.icon ?? itemMeta(p.item_id)?.icon ?? null,
      slot: o?.slot ?? null,
      slotTier: slotTierLabel(o?.slot, o?.tier),
    };
  });

  //The design draws one node list: the components, this item, then what it upgrades into.
  const pathNodes = [
    ...components,
    { itemId, name: itemName, icon: itemIcon, cost, slot: itemSlot, mods: itemMods, role: 'This item' as const },
    ...buildsInto,
  ];

  return (
    <aside className="itemd-rail">
      <section className="itemd-card itemd-pad">
        <RailHead title="Upgrade path" />
        <div className="itemd-path">
          {pathNodes.map((n) => (
            <div className={n.role === 'This item' ? 'itemd-pathnode itemd-pathself' : 'itemd-pathnode'} key={n.itemId}>
              <span className={`iicon itemd-pathart ${catClass(n.slot)}`}>
                {n.icon ? <img src={n.icon} alt="" loading="lazy" /> : <span className="icon-mono">{monogram(n.name)}</span>}
              </span>
              <span className="itemd-pathtext">
                <span className="itemd-pathname">
                  <a className="display itemd-tile-name" href={itemPath(n.itemId)}>
                    {n.name}
                  </a>
                  <span className="itemd-pathrole">{n.role}</span>
                </span>
                {n.mods && <span className="itemd-tile-sub">{n.mods}</span>}
              </span>
              <span className="mono tnum itemd-pathcost">{n.cost == null ? '' : count(n.cost)}</span>
            </div>
          ))}
        </div>
        <p className="itemd-railfoot">
          {discount == null
            ? 'This item has no components in the catalog, so there is no upgrade discount to state.'
            : `Owning the component is assumed to discount the upgrade to ${count(discount)} souls. The shop’s pay-the-difference arithmetic is in no patch note or asset field.`}
          {buildsInto.length === 0 && ` Nothing builds from ${itemName}.`}
        </p>
      </section>

      {against.length > 0 && (
        <section className="itemd-card itemd-pad">
          <RailHead title="Buy it against" note="Editorial" />
          <div className="itemd-against">
            {against.map((a) => (
              <div className="itemd-againstrow" key={a.hero}>
                <span className="itemd-mono-av">{monogram(a.hero)}</span>
                <span className="itemd-againsttext">
                  <span className="display itemd-against-hero">{a.hero}</span>{' '}
                  <span className="itemd-against-why">{a.why}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="itemd-card itemd-pad">
        <RailHead title="Pairs with" note="Δ WR when both are on the board" />
        {pairsPending ? (
          <Skeleton height={140} />
        ) : pairRows.length === 0 ? (
          <EmptyState tone="cold" title="Computing" message="No partner clears the sample floor yet." />
        ) : (
          <>
            <div className="itemd-pairs">
              {pairRows.map((p) => (
                <div className="itemd-pair" key={p.item_id}>
                  <ItemTile id={p.item_id} name={p.name} icon={p.icon} slot={p.slot} sub={p.slotTier} />
                  <span
                    className="mono tnum itemd-pair-lift"
                    style={{ color: (p.win_rate_delta ?? 0) >= 0 ? 'var(--win)' : 'var(--loss)' }}
                  >
                    {p.win_rate_delta == null
                      ? DASH
                      : `${p.win_rate_delta >= 0 ? '▲ +' : '▼ −'}${Math.abs(p.win_rate_delta * 100).toFixed(1)}`}
                  </span>
                  <span className="mono tnum muted">{count(p.matches)}</span>
                </div>
              ))}
            </div>
            {pairs?.base_win_rate != null && (
              <p className="itemd-railfoot">
                Measured against this item&apos;s own {(pairs.base_win_rate * 100).toFixed(1)}% over the same window,
                partners under {count(pairs.min_matches)} shared games dropped.
              </p>
            )}
          </>
        )}
      </section>

      <section className="itemd-card itemd-pad">
        <RailHead title="Win rate by rank" note="the player's own rank, ranked games" />
        {rankPending ? (
          <Skeleton height={200} />
        ) : !byRank || byRank.tiers.length === 0 ? (
          <EmptyState tone="cold" title="Computing" message="Per-rank rows for this item are still folding." />
        ) : (
          <>
            <div className="itemd-ranks">
              {byRank.tiers.map((t) => (
                <div className="itemd-rank" key={t.tier}>
                  <img className="itemd-rank-emblem" src={rankImg(t.tier)} alt="" width="20" height="20" loading="lazy" />
                  <span className="display itemd-rank-name">{t.name}</span>
                  <span className="itemd-rank-wr">
                    <span className="mono tnum itemd-rank-val" style={{ color: barColor((t.win_rate ?? 0) * 100) }}>
                      {t.win_rate == null ? DASH : `${(t.win_rate * 100).toFixed(1)}%`}
                    </span>
                    <span className="wbar wbar-flex itemd-rank-bar">
                      <i
                        style={{
                          width: barWidth((t.win_rate ?? 0) * 100),
                          background: barColor((t.win_rate ?? 0) * 100),
                        }}
                      />
                    </span>
                  </span>
                  <span
                    className="mono tnum muted"
                    title={t.thin ? `Under ${count(byRank.thin_below)} matches: noise, not a reading` : undefined}
                  >
                    {count(t.matches)}
                  </span>
                </div>
              ))}
            </div>
            <p className="itemd-railfoot">A tier under {count(byRank.thin_below)} matches is noise, not a reading.</p>
          </>
        )}
      </section>

      <section className="itemd-card itemd-pad">
        <RailHead title={`Peers · ${peerTitle}`} note="same slot, same tier" />
        {peers.length === 0 ? (
          <EmptyState tone="cold" title="No peers" message="No other catalog item shares this slot and tier." />
        ) : (
          <div className="itemd-peers">
            {peers.map((p) => (
              <div className="itemd-peer" key={p.itemId}>
                <ItemTile id={p.itemId} name={p.name} icon={p.icon} slot={p.slot} />
                <span className="mono tnum" style={{ color: barColor(p.winRate ?? 0) }}>
                  {p.winRate == null ? DASH : `${p.winRate.toFixed(1)}%`}
                </span>
                <span className="mono tnum muted">{p.matches == null ? DASH : count(p.matches)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </aside>
  );
}

export default function ItemRail(props: ItemRailProps) {
  return (
    <QueryProvider>
      <RailBlocks {...props} />
    </QueryProvider>
  );
}
