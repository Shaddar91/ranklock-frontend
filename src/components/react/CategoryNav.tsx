//Items index §2 category nav: Weapon / Vitality / Spirit, each with its tier buttons
//I-V (V = apex). Re-clicking the active slot or tier clears back to every item.
import {
  CATEGORY_TIERS,
  ITEM_SLOTS,
  slotActive,
  tierActive,
  toggleSlot,
  toggleTier,
  type CategorySelection,
} from '../../lib/itemsIndex';
import { itemTierLabel, itemTierNumeral } from '../../lib/itemTiers';

interface CategoryNavProps {
  value: CategorySelection;
  onChange: (next: CategorySelection) => void;
}

export default function CategoryNav({ value, onChange }: CategoryNavProps) {
  return (
    <div className="catnav" role="group" aria-label="Filter items by category and tier">
      {ITEM_SLOTS.map((slot) => {
        const on = slotActive(value, slot.key);
        return (
          <div className={`catnav-row ${slot.cls}`} key={slot.key}>
            <button
              type="button"
              className={'catnav-slot' + (on ? ' on' : '')}
              aria-pressed={on}
              onClick={() => onChange(toggleSlot(value, slot.key))}
            >
              <span className="catnav-swatch" aria-hidden="true" />
              {slot.label}
            </button>
            <div className="catnav-tiers">
              {CATEGORY_TIERS.map((tier) => {
                const tierOn = tierActive(value, slot.key, tier);
                return (
                  <button
                    type="button"
                    key={tier}
                    className={'catnav-tier' + (tierOn ? ' on' : '')}
                    aria-pressed={tierOn}
                    title={`${slot.label} · ${itemTierLabel(tier)}`}
                    onClick={() => onChange(toggleTier(value, slot.key, tier))}
                  >
                    {itemTierNumeral(tier)}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
