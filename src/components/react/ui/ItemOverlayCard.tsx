//The shared item overlay card (rendered inside a Tooltip): name, slot · tier ·
//souls cost, the FULL modifier list with values, and "Upgrades from" lineage.
//One component for every item-row overlay — Build Lab modifiers table + creator
//catalog. Street Brawl items show a labeled chip instead of the placeholder
//tier-5 / 9,999-souls economy.
import type { ItemOverlayData } from '../../../lib/itemOverlay';
import { count } from '../../../lib/format';
import GameIcon from './GameIcon';
import Chip from './Chip';

function slotLabel(slot: string | null): string | null {
  return slot ? slot.charAt(0).toUpperCase() + slot.slice(1) : null;
}

function modValue(value: number, isPercent: boolean): string {
  const sign = value > 0 ? '+' : '';
  const v = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${sign}${v}${isPercent ? '%' : ''}`;
}

export default function ItemOverlayCard({ data }: { data: ItemOverlayData }) {
  const meta = [
    slotLabel(data.slot),
    !data.brawl && data.tier != null ? `Tier ${data.tier}` : null,
    !data.brawl && data.cost != null ? `${count(data.cost)} souls` : null,
  ].filter(Boolean);

  return (
    <div style={{ display: 'grid', gap: 8, minWidth: 200 }}>
      <div className="flex" style={{ alignItems: 'center', gap: 9 }}>
        <GameIcon kind="item" name={data.name} src={data.icon} size={26} />
        <div style={{ minWidth: 0 }}>
          <div className="display" style={{ fontWeight: 700, color: 'var(--text)', fontSize: 13.5, lineHeight: 1.2 }}>
            {data.name}
          </div>
          <div className="faint" style={{ fontSize: 11.5 }}>{meta.join(' · ')}</div>
        </div>
        {data.brawl && <Chip>Street Brawl</Chip>}
      </div>
      <div style={{ height: 1, background: 'var(--border)' }} />
      {data.modifiers.length === 0 ? (
        <span className="faint" style={{ fontSize: 12 }}>No listed modifiers</span>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
          {data.modifiers.map((m, i) => (
            <li key={`${m.property_type}-${i}`} className="flex" style={{ gap: 7, alignItems: 'baseline' }}>
              <span className="tnum" style={{ fontWeight: 600, color: 'var(--text)', flex: 'none' }}>
                {modValue(m.value, m.is_percent)}
              </span>
              <span style={{ fontSize: 12 }}>{m.label ?? m.property_type}</span>
            </li>
          ))}
        </ul>
      )}
      {data.upgradesFrom.length > 0 && (
        <>
          <div style={{ height: 1, background: 'var(--border)' }} />
          <div>
            <span className="label-xs" style={{ display: 'block', marginBottom: 4 }}>Upgrades from</span>
            {data.upgradesFrom.map((u) => (
              <span key={u.id} className="flex" style={{ alignItems: 'center', gap: 6, fontSize: 12 }}>
                <GameIcon kind="item" name={u.name} src={u.icon} size={16} />
                <span style={{ color: 'var(--text)' }}>{u.name}</span>
              </span>
            ))}
          </div>
        </>
      )}
      {data.brawl && (
        <span className="faint" style={{ fontSize: 11, lineHeight: 1.3 }}>
          Street Brawl shop only — the tier and souls cost in the catalog are placeholders.
        </span>
      )}
    </div>
  );
}
