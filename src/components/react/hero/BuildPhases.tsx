//Hero Build §1-§2: what to buy in each phase and the order the board fills, both driven by the
//sticky rank filter. /items/stats is a deadlock-api.com aggregate filtered by the match's average
//rank; the affordability curve is RankLock's own, keyed on the player's rank tier.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../../lib/apiClient';
import { useGameMode } from '../../../lib/useGameMode';
import { bracketBucket, upstreamRankScope, useHeroBracket } from '../../../lib/heroBracket';
import { bracketLabel } from '../ui/FilterBar';
import { buildByPhase, buyOrderTrack, type CatalogEntry } from '../../../lib/heroBuild';
import { overlayFromMeta } from '../../../lib/itemOverlay';
import { itemPath } from '../../../lib/itemSlugs';
import { count, minuteClock } from '../../../lib/format';
import QueryProvider from '../QueryProvider';
import GameIcon from '../ui/GameIcon';
import SectionHeader from '../ui/SectionHeader';
import EmptyState from '../ui/EmptyState';
import ItemHoverCard from '../ui/ItemHoverCard';
import type { ItemStat, LaneCurvePoint } from '../../../types/api';

export interface BuildPhasesProps {
  heroId: number;
  initialItemStats: ItemStat[];
  catalog: CatalogEntry[];
  curve: LaneCurvePoint[];
  slots?: number;
}

const wrColor = (wr: number) => ({ color: wr >= 50 ? 'var(--win)' : 'var(--loss)' });

export default function BuildPhases(props: BuildPhasesProps) {
  return (
    <QueryProvider>
      <Sections {...props} />
    </QueryProvider>
  );
}

function Sections({ heroId, initialItemStats, catalog, curve, slots = 12 }: BuildPhasesProps) {
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

  //The affordability baseline follows the rank pick; the baked all-ranks curve stands in
  //until the rank's own curve lands, so a slot never renders an empty affordable-at column.
  const { data: ranked } = useQuery({
    queryKey: queryKeys.laneFarmCurve({ tier: bracket === 'all' ? null : bracket, metric: 'souls' }),
    queryFn: () => api.getLaneFarmCurve({ tier: bracket === 'all' ? undefined : bracket, metric: 'souls' }),
    enabled: bracket !== 'all',
    staleTime: 60 * 60_000,
  });

  const index = useMemo(() => new Map(catalog.map((c) => [c.itemId, c])), [catalog]);
  const points = bracket === 'all' ? curve : (ranked?.points ?? curve);
  const phases = useMemo(() => buildByPhase(itemStats, index), [itemStats, index]);
  const track = useMemo(() => buyOrderTrack(itemStats, index, points, slots), [itemStats, index, points, slots]);
  const overlay = (itemId: number) => overlayFromMeta(itemId, index.get(itemId));
  const scope = upstreamRankScope(bracket);
  const paceLabel = bracket === 'all' ? 'all ranks' : `${bracketLabel(bracket)} rank`;

  return (
    <>
      <section id="phases">
        <SectionHeader
          kicker="What to buy and when"
          title="The build by phase"
          note={`Minute = average buy time · WR = games where the item was bought in that phase · ${scope} · Core is RankLock editorial`}
          action={
            <a className="btn btn-brass btn-caps" href="/build-lab/">
              Open in Build Lab
            </a>
          }
        />
        {phases.every((p) => p.items.length === 0) ? (
          <EmptyState tone="cold" title="Computing" message="Item buys for this rank are still folding. This block refreshes hourly." />
        ) : (
          <div className="phase-grid">
            {phases.map((p) => (
              <div className="panel panel-pad phase-card" key={p.name}>
                <div className="phase-head">
                  <span className="display">{p.name}</span>
                  <span className="mono muted">
                    {p.range}
                    {p.souls == null ? '' : ` · ≈ ${count(p.souls)} souls`}
                  </span>
                </div>
                <div className="bp-phase-head">
                  <span />
                  <span>Item</span>
                  <span className="num">Min</span>
                  <span className="num">WR</span>
                  <span className="num">Games</span>
                </div>
                {p.items.length === 0 ? (
                  <p className="muted phase-empty">No item lands in this phase yet.</p>
                ) : (
                  p.items.map((it) => (
                    <ItemHoverCard data={overlay(it.itemId)} asChild key={it.itemId}>
                      <a className="phase-row bp-phase-row" href={itemPath(it.itemId)}>
                        <GameIcon kind="item" name={it.name} src={it.iconUrl} size={32} />
                        <span className="phase-item">
                          <span className="bp-phase-title">
                            <span className="display phase-name">{it.name}</span>
                            <span className={it.core ? 'bp-pill bp-pill-core' : 'bp-pill'}>
                              {it.core ? 'Core' : 'Situational'}
                            </span>
                          </span>
                          <span className="phase-sub">
                            {it.cost == null ? it.slotTier : `${it.slotTier} · ${count(it.cost)} souls`}
                          </span>
                        </span>
                        <span className="mono tnum phase-min">{minuteClock(it.minute)}</span>
                        <span className="mono tnum wr" style={wrColor(it.winRate)}>
                          {it.winRate.toFixed(1)}%
                        </span>
                        <span className="mono tnum muted bp-phase-games">{count(it.games)}</span>
                      </a>
                    </ItemHoverCard>
                  ))
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="buy-order">
        <SectionHeader
          kicker="In what order"
          title="Buy order by slot"
          note={`Souls = cumulative board cost · minute = when a median-farming player (${paceLabel}) can afford the slot`}
        />
        {track.length === 0 ? (
          <EmptyState tone="cold" title="Computing" message="Item costs and buy times are still folding. This block refreshes hourly." />
        ) : (
          <div className="bp-track">
            {track.map((s) => (
              <ItemHoverCard data={overlay(s.itemId)} asChild key={s.itemId}>
                <a className="panel bp-slot" href={itemPath(s.itemId)}>
                  <span className="mono bp-slot-n">SLOT {s.pos}</span>
                  <GameIcon kind="item" name={s.name} src={s.iconUrl} size={38} />
                  <span className="display bp-slot-name">{s.name}</span>
                  <span className="mono tnum bp-slot-min">{minuteClock(s.affordMinute)}</span>
                  <span className="mono tnum bp-slot-souls">{count(s.cumulative)}</span>
                  <span className="mono tnum bp-slot-wr" style={wrColor(s.winRate)}>
                    {s.winRate.toFixed(1)}%
                  </span>
                </a>
              </ItemHoverCard>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
