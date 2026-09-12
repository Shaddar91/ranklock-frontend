//Lab §4 — the imported build's items in purchase order, grouped by the phase a median-farming
//lobby reaches their running total in, with the upgrade-difference paid column and the slot note.
import { GameIcon, ItemHoverCard, SectionHeader } from '../ui/index';
import { count, DASH } from '../../../lib/format';
import { overlayFromCatalog, type ItemOverlayData } from '../../../lib/itemOverlay';
import { slotNote, type PhaseGroup, type PurchaseRow } from './analyzeModel';

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
    <div className="statrow" style={{ gap: 10, alignItems: 'center' }}>
      <span className="mono faint tnum" style={{ fontSize: 11, width: 22, flex: 'none' }}>{row.pos}</span>
      <ItemHoverCard data={row.item ? overlayFromCatalog(row.item) : bareOverlay(row.itemId, row.name)}>
        <span className="flex" style={{ alignItems: 'center', gap: 9, flex: 1, minWidth: 0 }}>
          <GameIcon kind="item" name={row.name} src={row.item?.icon} size={28} />
          <span style={{ minWidth: 0 }}>
            <span className="flex" style={{ alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              <span className="display" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{row.name}</span>
              {row.upgradeFrom && (
                <span className="chip" style={{ padding: '1px 7px', fontSize: 10.5 }} title={`Assumed: upgraded from ${row.upgradeFrom.name} (${count(row.upgradeFrom.cost)} souls already sunk)`}>
                  upgrade · assumed
                </span>
              )}
            </span>
            <span className="faint" style={{ fontSize: 11 }}>
              {[row.slotTier, row.category, row.annotation].filter(Boolean).join(' · ')}
            </span>
          </span>
        </span>
      </ItemHoverCard>
      <span className="tnum amber-c" style={{ fontSize: 12.5, flex: 'none', minWidth: 74, textAlign: 'right' }}>
        {row.paid == null ? DASH : count(row.paid)}
      </span>
      <span className="tnum faint" style={{ fontSize: 12, flex: 'none', minWidth: 78, textAlign: 'right' }}>
        {count(row.running)}
      </span>
    </div>
  );
}

export default function PurchaseOrder({ groups, total, owned, phased, band }: PurchaseOrderProps) {
  const note = phased
    ? `Paid pays the upgrade difference when a component is already owned — the build states no upgrade route, so that is assumed. Phase = the band holding the minute a median-farming lobby affords the running total (RankLock public matches p50, all heroes, ${band}); the build carries no timings of its own.`
    : 'Paid pays the upgrade difference when a component is already owned — the build states no upgrade route, so that is assumed. No economy curve is served right now, so the rows are not split into phases.';

  return (
    <section className="grid" style={{ gap: 10 }}>
      <SectionHeader kicker="In what order" title="Items in purchase order" note={note} />
      {groups.map((g) => (
        <section key={g.name} className="panel catpanel">
          <div className="cat-h">
            <span className="display" style={{ flex: 1 }}>{g.name}</span>
            <span className="label-xs tnum">{g.range} · {g.rows.length} items · {count(g.souls)} souls</span>
          </div>
          {g.rows.map((row) => <Row key={row.itemId} row={row} />)}
        </section>
      ))}
      <div className="statrow" style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        <span className="display" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
          Total · {owned} items owned, {slotNote(owned)}
        </span>
        <span className="sv tnum amber-c">{count(total)} souls</span>
      </div>
    </section>
  );
}
