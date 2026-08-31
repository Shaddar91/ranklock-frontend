//The picked build laid out over the item board: four slots per category plus four flex slots,
//with the per-item imbue target and conditional flag that feed BuildInput. Slot placement is
//presentational — the souls spend below is always computeStats' own per-category figure.
import { EmptyState, GameIcon } from '../ui/index';
import { count } from '../../../lib/format';
import type { HeroAbility } from '../../../types/api';
import {
  BUCKETS,
  BUCKET_LABEL,
  bucketOf,
  hasAbilityScopedMods,
  itemLabel,
  SLOTS_PER_BUCKET,
  type BoardLayout,
  type Bucket,
  type CatalogItem,
} from './buildModel';

interface BuildBoardProps {
  layout: BoardLayout;
  byId: Map<number, CatalogItem>;
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
        <span className="flex" style={{ alignItems: 'center', gap: 8, minWidth: 0 }}>
          <GameIcon kind="item" name={name} src={item?.icon} size={26} />
          <span style={{ minWidth: 0 }}>
            <span className="display" style={{ display: 'block', fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
              {name}
            </span>
            <span className="faint tnum" style={{ fontSize: 11 }}>
              T{item?.item_tier ?? '?'} · {count(item?.cost)} souls · {BUCKET_LABEL[bucketOf(item?.item_slot_type)]}
            </span>
          </span>
        </span>
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

export default function BuildBoard({
  layout,
  byId,
  abilities,
  abilitiesPending,
  imbueTargets,
  conditionalItems,
  conditionalsEnabled,
  onImbue,
  onToggleConditional,
  onRemove,
}: BuildBoardProps) {
  const total = BUCKETS.reduce((n, b) => n + layout.buckets[b].length, 0) + layout.extra.length;

  if (total === 0) {
    return (
      <div className="panel panel-pad">
        <EmptyState
          title="No items yet"
          message="Pick items from the catalog — they fill their own category first, then the flex slots."
          icon="inbox"
        />
      </div>
    );
  }

  return (
    <div className="grid" style={{ gap: 12 }}>
      {BUCKETS.map((bucket: Bucket) => {
        const ids = layout.buckets[bucket];
        return (
          <section key={bucket} className="panel catpanel">
            <div className="cat-h">
              <span className="display" style={{ flex: 1 }}>{BUCKET_LABEL[bucket]}</span>
              <span className="label-xs tnum">{ids.length} / {SLOTS_PER_BUCKET}</span>
            </div>
            <div
              className="grid"
              style={{ padding: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}
            >
              {ids.map((id) => (
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
              ))}
              {Array.from({ length: Math.max(0, SLOTS_PER_BUCKET - ids.length) }, (_, i) => (
                <EmptySlot key={`empty-${i}`} label={`Empty ${BUCKET_LABEL[bucket].toLowerCase()} slot`} />
              ))}
            </div>
          </section>
        );
      })}

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
