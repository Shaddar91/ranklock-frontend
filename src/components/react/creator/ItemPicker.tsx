//Shop-grid catalog browser for the Build Creator: every buildable item from GET /items/modifiers
//as an icon tile, grouped by tier the way the in-game shop is (I-IV plus the Tier V apex row),
//filtered by shop category / name. A brass ring marks the items already on the board; hover,
//focus or tap opens the shared item hover card. The default grid is the competitive shop only;
//the Street Brawl set sits behind a labeled toggle as a reference grid — brawl items use a
//placeholder economy, so they can't join a build.
import { useMemo, useState } from 'react';
import { EmptyState, GameIcon, ItemHoverCard } from '../ui/index';
import { count } from '../../../lib/format';
import { itemAbility } from '../../../lib/itemDescriptions';
import { itemTierLabel } from '../../../lib/itemTiers';
import { overlayFromCatalog, splitBrawl } from '../../../lib/itemOverlay';
import { CATEGORIES, CATEGORY_LABEL, categoryOf, type Category, type CatalogItem } from './buildModel';

interface ItemPickerProps {
  catalog: CatalogItem[];
  picked: number[];
  boardFull: boolean;
  isPending: boolean;
  isError: boolean;
  onAdd: (itemId: number) => void;
  onRemove: (itemId: number) => void;
}

interface TierSection {
  tier: number;
  cost: number | null;
  items: CatalogItem[];
}

function tierSections(rows: CatalogItem[]): TierSection[] {
  const by = new Map<number, CatalogItem[]>();
  for (const it of rows) {
    const tier = it.item_tier ?? 0;
    const bucket = by.get(tier);
    if (bucket) bucket.push(it);
    else by.set(tier, [it]);
  }
  return [...by.entries()]
    .sort((a, b) => a[0] - b[0])
    //Every item of a tier shares one price upstream, so the first row prices the whole section.
    .map(([tier, items]) => ({ tier, cost: items[0]?.cost ?? null, items }));
}

function Tile({
  item,
  picked,
  blocked,
  onClick,
}: {
  item: CatalogItem;
  picked: boolean;
  blocked: boolean;
  onClick?: () => void;
}) {
  const name = item.item_name ?? `Item ${item.item_id}`;
  const cat = categoryOf(item.item_slot_type) ?? 'flex';
  const ability = itemAbility(item.item_id);
  const body = (
    <>
      <span className="shoptile-art">
        <GameIcon kind="item" name={name} src={item.icon} size={44} />
        {ability?.imbue && <span className="shoptile-b imbue">Imbue</span>}
        {ability?.active && !ability.imbue && <span className="shoptile-b">Active</span>}
      </span>
      <span className="shoptile-n">{name}</span>
    </>
  );
  if (!onClick) {
    return (
      <ItemHoverCard asChild data={overlayFromCatalog(item)}>
        <div className={`shoptile cat-${cat}`} tabIndex={0}>{body}</div>
      </ItemHoverCard>
    );
  }
  return (
    <ItemHoverCard asChild data={overlayFromCatalog(item)}>
      <button
        type="button"
        className={`shoptile cat-${cat}` + (picked ? ' on' : '')}
        aria-pressed={picked}
        disabled={blocked}
        title={blocked ? 'Every slot is filled — remove an item first' : undefined}
        onClick={onClick}
      >
        {body}
      </button>
    </ItemHoverCard>
  );
}

export default function ItemPicker({
  catalog,
  picked,
  boardFull,
  isPending,
  isError,
  onAdd,
  onRemove,
}: ItemPickerProps) {
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [term, setTerm] = useState('');
  const [brawlView, setBrawlView] = useState(false);

  const pickedSet = useMemo(() => new Set(picked), [picked]);
  const { competitive, brawl } = useMemo(() => splitBrawl(catalog, (it) => it.icon), [catalog]);
  const source = brawlView ? brawl : competitive;

  const availableCategories = useMemo(
    () => CATEGORIES.filter((c) => source.some((it) => categoryOf(it.item_slot_type) === c)),
    [source],
  );

  const sections = useMemo(() => {
    const needle = term.trim().toLowerCase();
    const rows = source
      .filter((it) => category === 'all' || categoryOf(it.item_slot_type) === category)
      .filter((it) => needle === '' || (it.item_name ?? '').toLowerCase().includes(needle))
      .sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0) || (a.item_name ?? '').localeCompare(b.item_name ?? ''));
    return tierSections(rows);
  }, [source, category, term]);

  const shown = sections.reduce((n, s) => n + s.items.length, 0);

  if (isPending) {
    return (
      <div className="panel panel-pad">
        <p className="muted" style={{ padding: '14px 2px', margin: 0 }}>Loading items…</p>
      </div>
    );
  }
  if (isError || catalog.length === 0) {
    return (
      <div className="panel panel-pad">
        <EmptyState
          title="Item catalog not available yet"
          message="The item list is still loading on the server. Check back in a few minutes."
          icon="inbox"
        />
      </div>
    );
  }

  return (
    <div className="panel panel-pad">
      <div className="between" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <span className="label-xs">Items · {count(shown)}</span>
        {brawl.length > 0 && (
          <button
            type="button"
            className={'tab' + (brawlView ? ' on' : '')}
            style={{ padding: '6px 12px', fontSize: 13 }}
            aria-pressed={brawlView}
            onClick={() => setBrawlView((v) => !v)}
          >
            Street Brawl
          </button>
        )}
      </div>

      <div className="flex" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 10 }} role="group" aria-label="Filter items by shop category">
        <button
          type="button"
          className={'tab' + (category === 'all' ? ' on' : '')}
          style={{ padding: '6px 12px', fontSize: 13 }}
          aria-pressed={category === 'all'}
          onClick={() => setCategory('all')}
        >
          All
        </button>
        {availableCategories.map((c) => (
          <button
            key={c}
            type="button"
            className={'tab' + (category === c ? ' on' : '')}
            style={{ padding: '6px 12px', fontSize: 13 }}
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      <input
        className="field"
        type="search"
        value={term}
        placeholder="Search items…"
        onChange={(e) => setTerm(e.target.value)}
        aria-label="Search items by name"
        style={{ marginBottom: 10 }}
      />

      {brawlView && (
        <p className="muted" style={{ fontSize: 12, margin: '0 0 10px' }}>
          Street Brawl shop set — reference only. The catalog prices them at a placeholder 9,999 souls, so they can't join a build.
        </p>
      )}

      {sections.length === 0 ? (
        <EmptyState title="No items match" message="Clear the search or pick another shop category." icon="filter" />
      ) : (
        <div style={{ maxHeight: 560, overflowY: 'auto' }}>
          {sections.map((s) => (
            <section key={s.tier} style={{ marginBottom: 14 }}>
              <div className="shoptier">
                <span className="label-xs">{itemTierLabel(s.tier) ?? `Tier ${s.tier}`}</span>
                <span className="tnum amber-c" style={{ fontSize: 12 }}>{count(s.cost)}</span>
                <span className="faint" style={{ fontSize: 11 }}>souls</span>
              </div>
              <div className="shopgrid">
                {s.items.map((it) => {
                  const isPicked = pickedSet.has(it.item_id);
                  return (
                    <Tile
                      key={it.item_id}
                      item={it}
                      picked={isPicked}
                      blocked={!isPicked && boardFull}
                      onClick={
                        brawlView ? undefined : () => (isPicked ? onRemove(it.item_id) : onAdd(it.item_id))
                      }
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
      {!brawlView && (
        <p className="faint" style={{ fontSize: 11.5, margin: '4px 0 0' }}>
          Costs are souls, from the live item catalog. A brass ring marks an item already on the board; hover one for its card.
        </p>
      )}
    </div>
  );
}
