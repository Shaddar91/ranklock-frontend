//Hero Overview §5 — the recommended build by phase. An island rather than SSR markup because
//every tile carries the app-wide item hover card, which needs a React root + QueryProvider.
import { overlayFromMeta, type OverlayMeta } from '../../../lib/itemOverlay';
import type { PhaseCard } from '../../../lib/heroOverview';
import QueryProvider from '../QueryProvider';
import GameIcon from '../ui/GameIcon';
import EmptyState from '../ui/EmptyState';
import ItemHoverCard from '../ui/ItemHoverCard';

export interface PhaseGridProps {
  phases: PhaseCard[];
  catalog: Record<string, OverlayMeta>;
}

export default function PhaseGrid(props: PhaseGridProps) {
  return (
    <QueryProvider>
      <Grid {...props} />
    </QueryProvider>
  );
}

function Grid({ phases, catalog }: PhaseGridProps) {
  if (phases.every((p) => p.items.length === 0)) {
    return <EmptyState title="Computing" message="Item buy times are still folding. This block refreshes hourly." />;
  }
  return (
    <div className="phase-grid">
      {phases.map((p) => (
        <div className="panel panel-pad phase-card" key={p.name}>
          <div className="phase-head">
            <span className="display">{p.name}</span>
            <span className="mono muted">{p.range}</span>
          </div>
          {p.items.length === 0 ? (
            <p className="muted phase-empty">No item clears this band yet.</p>
          ) : (
            p.items.map((it) => (
              <ItemHoverCard data={overlayFromMeta(it.itemId, catalog[String(it.itemId)])} asChild key={it.itemId}>
                <a className="phase-row" href={`/items/${it.itemId}/`}>
                  <GameIcon kind="item" name={it.name} src={it.iconUrl} size={32} />
                  <span className="phase-item">
                    <span className="display phase-name">{it.name}</span>
                    <span className="phase-sub">{it.slotTier}</span>
                  </span>
                  <span className="mono tnum phase-min">{Math.round(it.minute)}′</span>
                  <span className="mono tnum" style={{ color: it.winRate >= 50 ? 'var(--win)' : 'var(--loss)' }}>
                    {it.winRate.toFixed(1)}%
                  </span>
                </a>
              </ItemHoverCard>
            ))
          )}
        </div>
      ))}
    </div>
  );
}
