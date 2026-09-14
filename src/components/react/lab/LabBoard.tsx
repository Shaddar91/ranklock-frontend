//Lab §8 — the design's board card: the "start from" presets in the header, then the 9 inventory
//slots beside the 3 flex slots. A filled slot is the item's art with its hover card; clicking it
//takes the item off the board.
import { GameIcon, ItemHoverCard } from '../ui/index';
import { count } from '../../../lib/format';
import { overlayFromCatalog } from '../../../lib/itemOverlay';
import { catClass } from '../../../lib/itemDetail';
import {
  itemLabel,
  FLEX_SLOTS,
  INVENTORY_SLOTS,
  TOTAL_SLOTS,
  type BoardLayout,
  type CatalogItem,
} from '../creator/buildModel';
import type { StartFromPreset } from './createModel';

interface LabBoardProps {
  heroName: string | null;
  layout: BoardLayout;
  byId: ReadonlyMap<number, CatalogItem>;
  souls: number;
  count: number;
  presets: StartFromPreset[];
  activePreset: string | null;
  onPreset: (preset: StartFromPreset) => void;
  onRemove: (itemId: number) => void;
}

function Slots({
  ids,
  size,
  byId,
  onRemove,
}: {
  ids: number[];
  size: number;
  byId: ReadonlyMap<number, CatalogItem>;
  onRemove: (itemId: number) => void;
}) {
  return (
    <div className="lab-slots">
      {Array.from({ length: size }, (_, i) => {
        const id = ids[i];
        const item = id == null ? undefined : byId.get(id);
        if (id == null || !item) return <div key={`e${i}`} className="lab-slot" aria-hidden="true" />;
        const name = itemLabel(id, item);
        return (
          <ItemHoverCard key={id} data={overlayFromCatalog(item)} asChild>
            <button
              type="button"
              className={`lab-slot filled ${catClass(item.item_slot_type)}`}
              title={`${name}: click to remove`}
              aria-label={`Remove ${name}`}
              onClick={() => onRemove(id)}
            >
              <span className="lab-slot-mono">{name.slice(0, 2).toUpperCase()}</span>
              <GameIcon kind="item" name={name} src={item.icon} size={56} />
            </button>
          </ItemHoverCard>
        );
      })}
    </div>
  );
}

export default function LabBoard({
  heroName,
  layout,
  byId,
  souls,
  count: owned,
  presets,
  activePreset,
  onPreset,
  onRemove,
}: LabBoardProps) {
  return (
    <section className="lab-frame lab-board">
      <div className="lab-board-h">
        <span className="lab-board-t">Board · {heroName ?? 'pick a hero'}</span>
        <span className="lab-pickrow">
          <span className="label-xs" style={{ letterSpacing: '0.16em' }}>Start from</span>
          {presets.map((p) => (
            <button
              key={p.key}
              type="button"
              className={'lab-pick lab-pick-sm' + (activePreset === p.key ? ' on' : '')}
              title={p.hint}
              disabled={p.itemIds.length === 0}
              onClick={() => onPreset(p)}
            >
              {p.label}
            </button>
          ))}
        </span>
        <span className="lab-board-souls tnum">
          {count(souls)} souls · {owned} of {TOTAL_SLOTS} slots
        </span>
      </div>
      <div className="lab-board-cols">
        <div>
          <div className="lab-group-l" style={{ '--gc': 'var(--brass-2)' } as React.CSSProperties}>
            <i aria-hidden="true" />
            Inventory · {INVENTORY_SLOTS} slots
          </div>
          <Slots ids={layout.inventory} size={INVENTORY_SLOTS} byId={byId} onRemove={onRemove} />
        </div>
        <div>
          <div className="lab-group-l">
            <i aria-hidden="true" />
            Flex · 1 per enemy Walker
          </div>
          <Slots ids={layout.flex} size={FLEX_SLOTS} byId={byId} onRemove={onRemove} />
        </div>
      </div>
      {layout.extra.length > 0 && (
        <p className="lab-note">
          {layout.extra.length} item{layout.extra.length === 1 ? '' : 's'} past the 12-slot board: a shopping list
          rather than one loadout.
        </p>
      )}
    </section>
  );
}
