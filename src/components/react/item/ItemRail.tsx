//Item detail §7 rail: upgrade path, the editorial "Buy it against" block, pairs-with,
//win rate by rank and same-slot peers. Pairs and per-rank rows arrive client-side; the
//other three are baked by the page. Every item tile carries the shared hover card.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import QueryProvider from '../QueryProvider';
import { api, queryKeys } from '../../../lib/apiClient';
import { itemMeta } from '../../../lib/itemCatalog';
import { itemAbility } from '../../../lib/itemDescriptions';
import { overlayFromWire, upgradesFor, type ItemOverlayData } from '../../../lib/itemOverlay';
import { itemTierNumeral } from '../../../lib/itemTiers';
import { rankImg } from '../../../lib/ranks';
import { count, DASH } from '../../../lib/format';
import type { CounterNote } from '../../../lib/itemEditorial';
import type { PeerRow } from '../../../lib/itemDetail';
import GameIcon from '../ui/GameIcon';
import Chip from '../ui/Chip';
import EmptyState from '../ui/EmptyState';
import Skeleton from '../ui/Skeleton';
import ItemHoverCard from '../ui/ItemHoverCard';

export interface EdgeView {
  itemId: number;
  name: string;
  icon: string | null;
  cost: number | null;
  slotTier: string;
}

export interface ItemRailProps {
  itemId: number;
  itemName: string;
  itemIcon: string | null;
  itemSlotTier: string;
  cost: number | null;
  components: EdgeView[];
  buildsInto: EdgeView[];
  discount: number | null;
  peers: PeerRow[];
  peerTitle: string;
  against: readonly CounterNote[];
}

function RailHead({ title, note, flag }: { title: string; note?: string; flag?: string }) {
  return (
    <div className="itemd-railhead">
      <span className="itemd-railtop">
        <span className="display itemd-railtitle">{title}</span>
        {flag && <Chip>{flag}</Chip>}
      </span>
      {note && <span className="itemd-railnote">{note}</span>}
    </div>
  );
}

function RailBlocks({
  itemId,
  itemName,
  itemIcon,
  itemSlotTier,
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
  const slotTiers = useMemo(
    () =>
      new Map(
        (modifiers ?? []).map(
          (r) =>
            [
              r.item_id,
              [r.item_slot_type && r.item_slot_type.charAt(0).toUpperCase() + r.item_slot_type.slice(1), itemTierNumeral(r.item_tier)]
                .filter(Boolean)
                .join(' · '),
            ] as const,
        ),
      ),
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

  const ItemTile = ({ id, name, icon, sub }: { id: number; name: string; icon: string | null; sub?: string }) => (
    <ItemHoverCard data={overlayFor(id, name, icon)} asChild>
      <a className="itemd-tile" href={`/items/${id}/`}>
        <GameIcon kind="item" name={name} src={icon} size={26} />
        <span className="itemd-tile-text">
          <span className="display itemd-tile-name">{name}</span>
          {sub && <span className="itemd-tile-sub">{sub}</span>}
        </span>
      </a>
    </ItemHoverCard>
  );

  const pairRows = (pairs?.pairs ?? []).map((p) => ({
    ...p,
    name: overlays.get(p.item_id)?.name ?? itemMeta(p.item_id)?.name ?? `Item ${p.item_id}`,
    icon: overlays.get(p.item_id)?.icon ?? itemMeta(p.item_id)?.icon ?? null,
    slotTier: slotTiers.get(p.item_id) ?? '',
  }));

  return (
    <aside className="itemd-rail">
      <section className="panel panel-pad">
        <RailHead title="Upgrade path" note={components.length > 0 ? 'What it is built from' : 'Where it leads'} />
        <div className="itemd-path">
          {components.map((c) => (
            <div className="itemd-pathnode" key={c.itemId}>
              <ItemTile id={c.itemId} name={c.name} icon={c.icon} sub={c.slotTier} />
              <span className="itemd-pathrole">
                Component{c.cost == null ? '' : ` · ${count(c.cost)} souls`}
              </span>
            </div>
          ))}
          <div className="itemd-pathnode itemd-pathself">
            <span className="itemd-tile">
              <GameIcon kind="item" name={itemName} src={itemIcon} size={26} />
              <span className="itemd-tile-text">
                <span className="display itemd-tile-name">{itemName}</span>
                <span className="itemd-tile-sub">{itemSlotTier}</span>
              </span>
            </span>
            <span className="itemd-pathrole">This item{cost == null ? '' : ` · ${count(cost)} souls`}</span>
          </div>
        </div>
        {buildsInto.length > 0 && (
          <div className="itemd-into">
            <span className="label-xs">Builds into</span>
            {buildsInto.map((b) => (
              <ItemTile key={b.itemId} id={b.itemId} name={b.name} icon={b.icon} sub={b.slotTier} />
            ))}
          </div>
        )}
        <p className="itemd-railfoot">
          {discount == null
            ? 'This item has no components in the catalog, so there is no upgrade discount to state.'
            : `Owning the component is assumed to discount the upgrade to ${count(discount)} souls. `}
          {discount != null && <Chip>assumed</Chip>}
          {discount != null && ' The shop’s pay-the-difference arithmetic is in no patch note or asset field.'}
          {buildsInto.length === 0 && ' Nothing builds from it.'}
        </p>
      </section>

      {against.length > 0 && (
        <section className="panel panel-pad">
          <RailHead title="Buy it against" note="Written by the content program, not derived" flag="Editorial" />
          <ul className="itemd-against">
            {against.map((a) => (
              <li key={a.hero}>
                <span className="display itemd-against-hero">{a.hero}</span>
                <span className="itemd-against-why">{a.why}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel panel-pad">
        <RailHead
          title="Pairs with"
          note={pairs ? `Δ win rate when both are on the board · ${pairs.window}` : 'Δ win rate when both are on the board'}
        />
        {pairsPending ? (
          <Skeleton height={140} />
        ) : pairRows.length === 0 ? (
          <EmptyState title="Computing" message="No partner clears the sample floor yet." />
        ) : (
          <>
            <div className="itemd-pairs">
              {pairRows.map((p) => (
                <div className="itemd-pair" key={p.item_id}>
                  <ItemTile id={p.item_id} name={p.name} icon={p.icon} sub={p.slotTier} />
                  <span
                    className="tnum num itemd-pair-lift"
                    style={{ color: (p.win_rate_delta ?? 0) >= 0 ? 'var(--win)' : 'var(--loss)' }}
                  >
                    {p.win_rate_delta == null
                      ? DASH
                      : `${p.win_rate_delta >= 0 ? '▲' : '▼'} ${Math.abs(p.win_rate_delta * 100).toFixed(1)}`}
                  </span>
                  <span className="tnum num muted">{count(p.matches)}</span>
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

      <section className="panel panel-pad">
        <RailHead title="Win rate by rank" note={byRank ? `Badge tier of the match · ${byRank.window}` : 'Badge tier of the match'} />
        {rankPending ? (
          <Skeleton height={200} />
        ) : !byRank || byRank.tiers.length === 0 ? (
          <EmptyState title="Computing" message="Per-rank rows for this item are still folding." />
        ) : (
          <>
            <div className="itemd-ranks">
              {byRank.tiers.map((t) => (
                <div className="itemd-rank" key={t.tier}>
                  <img className="itemd-rank-emblem" src={rankImg(t.tier)} alt="" width="20" height="20" loading="lazy" />
                  <span className="itemd-rank-name">{t.name}</span>
                  <span className="itemd-rank-bar">
                    <i
                      style={{
                        width: `${Math.max(0, Math.min(100, (((t.win_rate ?? 0) * 100 - 40) / 20) * 100))}%`,
                        background: (t.win_rate ?? 0) >= 0.5 ? 'var(--win)' : 'var(--loss)',
                      }}
                    />
                  </span>
                  <span
                    className="tnum num"
                    style={{ color: (t.win_rate ?? 0) >= 0.5 ? 'var(--win)' : 'var(--loss)' }}
                  >
                    {t.win_rate == null ? DASH : `${(t.win_rate * 100).toFixed(1)}%`}
                  </span>
                  <span className="tnum num muted itemd-rank-games">
                    {count(t.matches)}
                    {t.thin && <span className="itemd-thin" title={`Under ${count(byRank.thin_below)} matches`}>thin</span>}
                  </span>
                </div>
              ))}
            </div>
            <p className="itemd-railfoot">
              Tiers under {count(byRank.thin_below)} matches are marked thin and their rate is noise, not a reading.{' '}
              {byRank.source}
            </p>
          </>
        )}
      </section>

      <section className="panel panel-pad">
        <RailHead title={`Peers · ${peerTitle}`} note="Same slot, same tier" />
        {peers.length === 0 ? (
          <EmptyState title="No peers" message="No other catalog item shares this slot and tier." />
        ) : (
          <div className="itemd-peers">
            {peers.map((p) => (
              <div className="itemd-peer" key={p.itemId}>
                <ItemTile id={p.itemId} name={p.name} icon={p.icon} />
                <span
                  className="tnum num"
                  style={{ color: (p.winRate ?? 0) >= 50 ? 'var(--win)' : 'var(--loss)' }}
                >
                  {p.winRate == null ? DASH : `${p.winRate.toFixed(1)}%`}
                </span>
                <span className="tnum num muted">{p.matches == null ? DASH : count(p.matches)}</span>
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
