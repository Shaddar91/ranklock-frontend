//The picked build laid out over the game's board: 9 inventory slots plus one flex slot per
//enemy Walker destroyed, any item in any slot, with the per-item imbue target and conditional
//flag that feed BuildInput. Slot placement is presentational — the souls spend below is always
//computeStats' own per-category figure.
import { EmptyState, GameIcon, ItemHoverCard } from '../ui/index';
import { count } from '../../../lib/format';
import { overlayFromCatalog, type ItemOverlayData } from '../../../lib/itemOverlay';
import { itemTierNumeral } from '../../../lib/itemTiers';
import type { HeroAbility } from '../../../types/api';
import {
  categoryOf,
  CATEGORY_LABEL,
  FLEX_SLOTS,
  hasAbilityScopedMods,
  INVENTORY_SLOTS,
  itemLabel,
  TOTAL_SLOTS,
  type BoardLayout,
  type CatalogItem,
} from './buildModel';

interface BuildBoardProps {
  layout: BoardLayout;
  byId: Map<number, CatalogItem>;
  heroName: string | null;
  soulsSpent: number;
  abilities: HeroAbility[];
  abilitiesPending: boolean;
  imbueTargets: Record<number, number>;
  conditionalItems: number[];
  conditionalsEnabled: boolean;
  onImbue: (itemId: number, abilityId: number | null) => void;
  onToggleConditional: (itemId: number) => void;
  onRemove: (itemId: number) => void;
}

interface SlotCardProps {
  itemId: number;
  item: CatalogItem | undefined;
  abilities: HeroAbility[];
  abilitiesPending: boolean;
  imbuedTo: number | undefined;
  flagged: boolean;
  excluded: boolean;
  onImbue: (itemId: number, abilityId: number | null) => void;
  onToggleConditional: (itemId: number) => void;
  onRemove: (itemId: number) => void;
}

//An id this patch's catalog does not carry: the hover card still names it and fetches its detail.
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

function slotLine(item: CatalogItem | undefined): string {
  const cat = categoryOf(item?.item_slot_type);
  const numeral = itemTierNumeral(item?.item_tier);
  return [cat ? CATEGORY_LABEL[cat] : null, numeral ? `Tier ${numeral}` : null, `${count(item?.cost)} souls`]
    .filter(Boolean)
    .join(' · ');
}

function SlotCard({
  itemId,
  item,
  abilities,
  abilitiesPending,
  imbuedTo,
  flagged,
  excluded,
  onImbue,
  onToggleConditional,
  onRemove,
}: SlotCardProps) {
  const name = itemLabel(itemId, item);
  const imbueMoves = hasAbilityScopedMods(item);
  const imbueHint = imbueMoves
    ? 'Route this item’s ability stats onto one ability'
    : 'This item carries no ability-scoped stats — an imbue changes nothing';
  const imbued = abilities.find((a) => a.ability_id === imbuedTo);

  return (
    <div className="tile" style={{ padding: '9px 10px', opacity: excluded ? 0.55 : 1 }}>
      <div className="between" style={{ gap: 8 }}>
        <ItemHoverCard data={item ? overlayFromCatalog(item) : bareOverlay(itemId, name)}>
          <span className="flex" style={{ alignItems: 'center', gap: 8, minWidth: 0 }}>
            <GameIcon kind="item" name={name} src={item?.icon} size={26} />
            <span style={{ minWidth: 0 }}>
              <span className="display" style={{ display: 'block', fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
                {name}
              </span>
              <span className="faint tnum" style={{ fontSize: 11 }}>{slotLine(item)}</span>
            </span>
          </span>
        </ItemHoverCard>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ padding: '2px 9px', fontSize: 13, flex: 'none' }}
          onClick={() => onRemove(itemId)}
          aria-label={`Remove ${name} from the build`}
        >
          ×
        </button>
      </div>

      <div className="flex" style={{ alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <label className="flex" style={{ alignItems: 'center', gap: 6, minWidth: 0, flex: '1 1 150px' }} title={imbueHint}>
          <span className="label-xs" style={{ fontSize: 10, opacity: imbueMoves ? 1 : 0.6 }}>Imbue</span>
          <select
            className="field"
            style={{ padding: '4px 8px', fontSize: 12, minWidth: 0 }}
            value={imbuedTo ?? ''}
            disabled={abilities.length === 0}
            onChange={(e) => onImbue(itemId, e.target.value === '' ? null : Number(e.target.value))}
            aria-label={`Imbue target for ${name}`}
          >
            <option value="">
              {abilitiesPending ? 'Loading abilities…' : abilities.length === 0 ? 'No abilities served' : 'None'}
            </option>
            {abilities.map((a) => (
              <option key={a.ability_id} value={a.ability_id}>{a.name}</option>
            ))}
          </select>
        </label>
        <label
          className="flex"
          style={{ alignItems: 'center', gap: 5, flex: 'none', fontSize: 11.5, color: 'var(--muted)' }}
          title="Count this item only while conditionals are enabled"
        >
          <input type="checkbox" checked={flagged} onChange={() => onToggleConditional(itemId)} />
          Conditional
        </label>
      </div>

      {imbued && (
        <div className="flex" style={{ alignItems: 'center', gap: 6, marginTop: 7 }}>
          <GameIcon kind="item" name={imbued.name} src={imbued.icon_url} size={18} />
          <span className="faint" style={{ fontSize: 11.5 }}>Imbued to {imbued.name}</span>
        </div>
      )}
      {excluded && (
        <div className="chip" style={{ marginTop: 7, padding: '1px 7px', fontSize: 10.5 }}>
          Not counted — conditionals off
        </div>
      )}
    </div>
  );
}

function EmptySlot({ label }: { label: string }) {
  return (
    <div
      className="tile"
      style={{
        padding: '9px 10px',
        borderStyle: 'dashed',
        background: 'transparent',
        color: 'var(--faint)',
        fontSize: 12,
      }}
    >
      {label}
    </div>
  );
}

function SlotGroup({
  label,
  ids,
  slots,
  emptyLabel,
  card,
}: {
  label: string;
  ids: number[];
  slots: number;
  emptyLabel: string;
  card: (id: number) => React.ReactNode;
}) {
  return (
    <section className="panel catpanel">
      <div className="cat-h">
        <span className="display" style={{ flex: 1 }}>{label}</span>
        <span className="label-xs tnum">{ids.length} / {slots}</span>
      </div>
      <div className="grid" style={{ padding: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
        {ids.map(card)}
        {Array.from({ length: Math.max(0, slots - ids.length) }, (_, i) => (
          <EmptySlot key={`empty-${i}`} label={emptyLabel} />
        ))}
      </div>
    </section>
  );
}

export default function BuildBoard({
  layout,
  byId,
  heroName,
  soulsSpent,
  abilities,
  abilitiesPending,
  imbueTargets,
  conditionalItems,
  conditionalsEnabled,
  onImbue,
  onToggleConditional,
  onRemove,
}: BuildBoardProps) {
  const filled = layout.inventory.length + layout.flex.length;
  const total = filled + layout.extra.length;

  const card = (id: number) => (
    <SlotCard
      key={id}
      itemId={id}
      item={byId.get(id)}
      abilities={abilities}
      abilitiesPending={abilitiesPending}
      imbuedTo={imbueTargets[id]}
      flagged={conditionalItems.includes(id)}
      excluded={conditionalItems.includes(id) && !conditionalsEnabled}
      onImbue={onImbue}
      onToggleConditional={onToggleConditional}
      onRemove={onRemove}
    />
  );

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="between" style={{ gap: 12, flexWrap: 'wrap' }}>
        <span className="display" style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>
          {heroName ? `Board · ${heroName}` : 'Board'}
        </span>
        <span className="tnum amber-c" style={{ fontSize: 12.5 }}>
          {count(soulsSpent)} souls · {filled} of {TOTAL_SLOTS} slots
        </span>
      </div>

      {total === 0 ? (
        <div className="panel panel-pad">
          <EmptyState
            title="No items yet"
            message="Pick items from the shop — any item fits any slot, the 9 inventory slots first."
            icon="inbox"
          />
        </div>
      ) : (
        <>
          <SlotGroup
            label={`Inventory · ${INVENTORY_SLOTS} slots`}
            ids={layout.inventory}
            slots={INVENTORY_SLOTS}
            emptyLabel="Empty slot"
            card={card}
          />
          <SlotGroup
            label="Flex · 1 per enemy Walker"
            ids={layout.flex}
            slots={FLEX_SLOTS}
            emptyLabel="Empty flex slot"
            card={card}
          />
        </>
      )}

      {layout.extra.length > 0 && (
        <section className="panel catpanel">
          <div className="cat-h">
            <span className="display" style={{ flex: 1 }}>Off the board</span>
            <span className="label-xs tnum">{layout.extra.length}</span>
          </div>
          {layout.extra.map((id) => {
            const known = byId.has(id);
            return (
              <div key={id} className="statrow">
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{itemLabel(id, byId.get(id))}</span>
                <span className="flex" style={{ alignItems: 'center', gap: 10 }}>
                  <span className="faint" style={{ fontSize: 11.5 }}>
                    {known ? 'No open slot — still counted below' : 'Not in this patch’s catalog — not counted'}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: '2px 9px', fontSize: 13 }}
                    onClick={() => onRemove(id)}
                    aria-label={`Remove item ${id} from the build`}
                  >
                    ×
                  </button>
                </span>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
