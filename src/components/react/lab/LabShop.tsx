//Lab §8 — the design's shop: one category at a time, one row per tier, items as text chips with
//a brass ring when they are already on the board.
import { useMemo, useState } from 'react';
import { GameIcon, ItemHoverCard } from '../ui/index';
import { count } from '../../../lib/format';
import { overlayFromCatalog } from '../../../lib/itemOverlay';
import { itemTierLabel } from '../../../lib/itemTiers';
import { itemLabel, CATEGORIES, CATEGORY_LABEL, type CatalogItem, type Category } from '../creator/buildModel';

interface LabShopProps {
  catalog: CatalogItem[];
  picked: number[];
  boardFull: boolean;
  isPending: boolean;
  isError: boolean;
  patch: string | null;
  onAdd: (itemId: number) => void;
  onRemove: (itemId: number) => void;
}

interface TierRow {
  tier: number;
  cost: number | null;
  items: CatalogItem[];
}

function tierRows(catalog: CatalogItem[], category: Category): TierRow[] {
  const byTier = new Map<number, CatalogItem[]>();
  for (const item of catalog) {
    if (item.item_slot_type !== category || item.item_tier == null) continue;
    const list = byTier.get(item.item_tier);
    if (list) list.push(item);
    else byTier.set(item.item_tier, [item]);
  }
  return [...byTier.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([tier, items]) => ({
      tier,
      cost: items.find((i) => i.cost != null)?.cost ?? null,
      items: [...items].sort((a, b) => itemLabel(a.item_id, a).localeCompare(itemLabel(b.item_id, b))),
    }));
}

export default function LabShop({
  catalog,
  picked,
  boardFull,
  isPending,
  isError,
  patch,
  onAdd,
  onRemove,
}: LabShopProps) {
  const [category, setCategory] = useState<Category>('weapon');
  const rows = useMemo(() => tierRows(catalog, category), [catalog, category]);
  const on = useMemo(() => new Set(picked), [picked]);

  return (
    <section className="lab-card">
      <div className="lab-card-h">
        <span className="display" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Shop</span>
        <span className="flex" style={{ gap: 4 }}>
          {CATEGORIES.map((c: Category) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              className={`lab-pick lab-pick-sm lab-pick-dot cat-${c}` + (category === c ? ' on' : '')}
              onClick={() => setCategory(c)}
            >
              <i aria-hidden="true" />
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </span>
      </div>

      {isPending ? (
        <p className="lab-note" style={{ marginTop: 0 }}>Loading the item catalog…</p>
      ) : isError || rows.length === 0 ? (
        <p className="lab-note" style={{ marginTop: 0 }}>
          The item catalog has not been served. Nothing to shop from.
        </p>
      ) : (
        rows.map((row) => (
          <div key={row.tier} className="lab-shop-row">
            <div>
              <div className="lab-shop-t">{itemTierLabel(row.tier) ?? `Tier ${row.tier}`}</div>
              <div className="lab-shop-c tnum">{row.cost == null ? '—' : `${count(row.cost)} souls`}</div>
            </div>
            <div className="lab-shop-items">
              {row.items.map((item) => {
                const owned = on.has(item.item_id);
                const name = itemLabel(item.item_id, item);
                return (
                  <ItemHoverCard key={item.item_id} data={overlayFromCatalog(item)} asChild>
                    <button
                      type="button"
                      aria-pressed={owned}
                      disabled={!owned && boardFull}
                      className={`lab-sitem cat-${category}` + (owned ? ' on' : '')}
                      title={owned ? `${name}: on the board` : name}
                      onClick={() => (owned ? onRemove(item.item_id) : onAdd(item.item_id))}
                    >
                      <GameIcon kind="item" name={name} src={item.icon} size={24} />
                      <span className="lab-sitem-n">{name}</span>
                    </button>
                  </ItemHoverCard>
                );
              })}
            </div>
          </div>
        ))
      )}
      <p className="lab-note">
        Brass ring = on the board · hover for the item card
        {patch ? ` · shop and modifiers from patch ${patch}` : ''}
      </p>
    </section>
  );
}
