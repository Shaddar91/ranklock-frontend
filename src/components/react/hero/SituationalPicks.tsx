//Hero Build §3 right — the four modifier families and the items to swap in. An island because
//each pick chip carries the app-wide item hover card, which needs a React root + QueryProvider.
import { overlayFromMeta, type OverlayMeta } from '../../../lib/itemOverlay';
import type { SituationalGroup } from '../../../lib/heroBuild';
import QueryProvider from '../QueryProvider';
import GameIcon from '../ui/GameIcon';
import EmptyState from '../ui/EmptyState';
import ItemHoverCard from '../ui/ItemHoverCard';

export interface SituationalPicksProps {
  groups: SituationalGroup[];
  catalog: Record<string, OverlayMeta>;
}

export default function SituationalPicks(props: SituationalPicksProps) {
  return (
    <QueryProvider>
      <Groups {...props} />
    </QueryProvider>
  );
}

function Groups({ groups, catalog }: SituationalPicksProps) {
  if (groups.length === 0) {
    return <EmptyState title="Computing" message="No item in these families has a measured win rate on this hero yet." />;
  }
  return (
    <div className="bp-sit">
      {groups.map((g) => (
        <div className="panel panel-pad bp-sit-row" key={g.key}>
          <div>
            <div className="display bp-sit-label">{g.label}</div>
            <div className="bp-sit-effect">{g.effect}</div>
          </div>
          <div className="bp-sit-picks">
            {g.picks.map((p) => (
              <ItemHoverCard data={overlayFromMeta(p.itemId, catalog[String(p.itemId)])} asChild key={p.itemId}>
                <a className="bp-chip" href={`/items/${p.itemId}/`}>
                  <GameIcon kind="item" name={p.name} src={p.iconUrl} size={24} />
                  <span className="bp-chip-text">
                    <span className="display">{p.name}</span>
                    <span className="bp-chip-mod mono">{p.modifier}</span>
                  </span>
                  <span className="mono tnum" style={{ color: p.winRate >= 50 ? 'var(--win)' : 'var(--loss)' }}>
                    {p.winRate.toFixed(1)}%
                  </span>
                </a>
              </ItemHoverCard>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
