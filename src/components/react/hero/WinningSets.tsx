//Hero Build §3 left — the folded six-purchase sets. An island rather than SSR markup because
//every shop tile carries the app-wide item hover card, which needs a React root + QueryProvider.
import { overlayFromMeta, type OverlayMeta } from '../../../lib/itemOverlay';
import { count } from '../../../lib/format';
import type { SetEntry, SetRow } from '../../../lib/heroBuild';
import QueryProvider from '../QueryProvider';
import GameIcon from '../ui/GameIcon';
import EmptyState from '../ui/EmptyState';
import ItemHoverCard from '../ui/ItemHoverCard';

export interface WinningSetsProps {
  sets: SetRow[];
  catalog: Record<string, OverlayMeta>;
}

export default function WinningSets(props: WinningSetsProps) {
  return (
    <QueryProvider>
      <Table {...props} />
    </QueryProvider>
  );
}

function Table({ sets, catalog }: WinningSetsProps) {
  if (sets.length === 0) {
    return (
      <EmptyState title="Computing" message="No purchase set has been folded for this hero yet. This block refreshes hourly." />
    );
  }
  const art = (e: SetEntry) => (
    <>
      <GameIcon kind="item" name={e.name} src={e.iconUrl} size={30} />
      {e.count > 1 && <span className="bp-mult">x{e.count}</span>}
    </>
  );
  return (
    <div className="panel bp-table">
      <div className="bp-srow bp-bhead">
        <span className="label-xs">Set</span>
        <span className="label-xs num">Games</span>
        <span className="label-xs num">WR</span>
        <span className="label-xs num">Wilson</span>
      </div>
      {sets.map((s, i) => (
        <div className="bp-srow" key={i}>
          <span className="bp-set">
            {s.entries.map((e) =>
              //An ability entry has no item page to link to and no catalog card behind it.
              e.shopItem ? (
                <ItemHoverCard data={overlayFromMeta(e.itemId, catalog[String(e.itemId)])} asChild key={e.itemId}>
                  <a className="bp-tile" href={`/items/${e.itemId}/`} title={e.name}>
                    {art(e)}
                  </a>
                </ItemHoverCard>
              ) : (
                <a className="bp-tile bp-tile-ability" title={`${e.name} - ability upgrade`} key={e.itemId}>
                  {art(e)}
                </a>
              ),
            )}
          </span>
          <span className="mono tnum num muted">{count(s.games)}</span>
          <span className="mono tnum num" style={{ color: s.winRate >= 50 ? 'var(--win)' : 'var(--loss)' }}>
            {s.winRate.toFixed(1)}%
          </span>
          <span className="mono tnum num muted">{s.wilson.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}
