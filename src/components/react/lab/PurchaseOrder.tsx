//Lab §4 — the board's items in purchase order, grouped by the phase a median-farming lobby
//reaches their running total in, with the upgrade-difference paid column and the slot note.
import { GameIcon, ItemHoverCard, SectionHeader } from '../ui/index';
import { count, DASH } from '../../../lib/format';
import { overlayFromCatalog, type ItemOverlayData } from '../../../lib/itemOverlay';
import { catClass } from '../../../lib/itemDetail';
import { slotNote, type PhaseGroup, type PurchaseRow } from './analyzeModel';

const HEAD_NOTE = 'Hover an item for its card · running total pays the upgrade difference when a component is owned';

interface PurchaseOrderProps {
  groups: PhaseGroup[];
  total: number;
  owned: number;
  phased: boolean;
  band: string;
}

function bareOverlay(itemId: number, name: string): ItemOverlayData {
  return {
    id: itemId,
    name,
    icon: null,
    slot: null,
    tier: null,
    cost: null,
    brawl: false,
    modifiers: [],
    upgradesFrom: [],
    upgradesInto: [],
    cooldown: null,
    ability: null,
  };
}

function Row({ row }: { row: PurchaseRow }) {
  return (
    <div className="lab-porow">
      <span className="lab-po-pos">{row.pos}</span>
      <ItemHoverCard data={row.item ? overlayFromCatalog(row.item) : bareOverlay(row.itemId, row.name)}>
        <span className={`lab-itile ${catClass(row.item?.item_slot_type)}`} style={{ display: 'inline-flex' }}>
          <GameIcon kind="item" name={row.name} src={row.item?.icon} size={32} />
        </span>
      </ItemHoverCard>
      <span style={{ minWidth: 0 }}>
        <span className="flex" style={{ alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span className="lab-po-name">{row.name}</span>
          {row.upgradeFrom && (
            <span
              className="lab-upg"
              title={`Assumed: upgraded from ${row.upgradeFrom.name} (${count(row.upgradeFrom.cost)} souls already sunk)`}
            >
              upgrade
            </span>
          )}
        </span>
        <span className="lab-po-sub">
          {[row.slotTier, row.upgradeFrom ? `Upgrades ${row.upgradeFrom.name}` : null, row.annotation]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
      <span className="lab-po-paid tnum">{row.paid == null ? DASH : count(row.paid)}</span>
      <span className="lab-po-run tnum">{count(row.running)}</span>
    </div>
  );
}

export default function PurchaseOrder({ groups, total, owned, phased, band }: PurchaseOrderProps) {
  const foot = phased
    ? `Paid pays the upgrade difference when a component is already owned. The build states no upgrade route, so that is assumed. Phase = the band holding the minute a median-farming lobby affords the running total (RankLock public matches p50, all heroes, ${band}); the build carries no timings of its own.`
    : 'Paid pays the upgrade difference when a component is already owned. The build states no upgrade route, so that is assumed. No economy curve is served right now, so the rows are not split into phases.';

  return (
    <section>
      <SectionHeader kicker="In what order" title="Items in purchase order" note={HEAD_NOTE} />
      <div className="lab-card lab-card-flush">
        {groups.map((g) => (
          <div key={g.name}>
            <div className="lab-phase">
              <span>
                {g.name} <em>{g.range}</em>
              </span>
              <span className="tnum">
                {g.rows.length} items · {count(g.souls)} souls
              </span>
            </div>
            {g.rows.map((row) => (
              <Row key={row.itemId} row={row} />
            ))}
          </div>
        ))}
        <div className="lab-po-total">
          <span>
            Total · {owned} items owned, {slotNote(owned)}
          </span>
          <span className="lab-po-paid tnum">{count(total)}</span>
          <span />
        </div>
        <p className="lab-tblnote">{foot}</p>
      </div>
    </section>
  );
}
