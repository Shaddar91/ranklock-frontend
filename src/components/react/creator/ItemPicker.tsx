//Catalog browser for the Build Creator: every buildable item from GET /items/modifiers,
//filtered by slot category / tier / name, click to add or remove. Hover/focus/tap on a row
//opens the shared item overlay card (full modifier list + upgrade lineage). The default
//list is the competitive shop only; the Street Brawl set sits behind a labeled toggle as a
//reference list — brawl items use a placeholder economy, so they can't join a build.
import { useMemo, useState } from 'react';
import { EmptyState, GameIcon, ItemOverlayCard, Tooltip } from '../ui/index';
import { count } from '../../../lib/format';
import { overlayFromCatalog, splitBrawl } from '../../../lib/itemOverlay';
import { BUCKETS, BUCKET_LABEL, bucketOf, modifierSummary, type Bucket, type CatalogItem } from './buildModel';

interface ItemPickerProps {
  catalog: CatalogItem[];
  picked: number[];
  boardFull: boolean;
  isPending: boolean;
  isError: boolean;
  onAdd: (itemId: number) => void;
  onRemove: (itemId: number) => void;
}

//Competitive shop tiers. Tier 5 exists only on Street Brawl placeholder rows, so the
//competitive tier filter stops at 4 and the brawl view carries no tier filter at all.
const TIERS = [1, 2, 3, 4];

function RowBody({ it }: { it: CatalogItem }) {
  return (
    <span className="flex" style={{ alignItems: 'center', gap: 10, minWidth: 0 }}>
      <GameIcon kind="item" name={it.item_name ?? 'Item'} src={it.icon} size={30} />
      <span style={{ minWidth: 0 }}>
        <span
          className="display"
          style={{ display: 'block', fontWeight: 600, color: 'var(--text)', fontSize: 13.5 }}
        >
          {it.item_name ?? `Item ${it.item_id}`}
        </span>
        <span className="faint" style={{ display: 'block', fontSize: 11.5, overflowWrap: 'anywhere' }}>
          {it.modifiers.slice(0, 2).map(modifierSummary).join(' · ') || 'No listed modifiers'}
        </span>
      </span>
    </span>
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
  const [bucket, setBucket] = useState<Bucket | 'all'>('all');
  const [tier, setTier] = useState(0);
  const [term, setTerm] = useState('');
  const [brawlView, setBrawlView] = useState(false);

  const pickedSet = useMemo(() => new Set(picked), [picked]);
  const { competitive, brawl } = useMemo(() => splitBrawl(catalog, (it) => it.icon), [catalog]);
  const source = brawlView ? brawl : competitive;

  const availableBuckets = useMemo(
    () => BUCKETS.filter((b) => source.some((it) => bucketOf(it.item_slot_type) === b)),
    [source],
  );

  const rows = useMemo(() => {
    const needle = term.trim().toLowerCase();
    return source
      .filter((it) => bucket === 'all' || bucketOf(it.item_slot_type) === bucket)
      .filter((it) => brawlView || tier === 0 || it.item_tier === tier)
      .filter((it) => needle === '' || (it.item_name ?? '').toLowerCase().includes(needle))
      .sort(
        (a, b) =>
          (a.item_tier ?? 0) - (b.item_tier ?? 0) ||
          (a.cost ?? 0) - (b.cost ?? 0) ||
          (a.item_name ?? '').localeCompare(b.item_name ?? ''),
      );
  }, [source, brawlView, bucket, tier, term]);

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
          title="Item catalog not served yet"
          message="The buildable-item modifier blob warms from the assets API — items appear here once the cache is primed."
          icon="inbox"
        />
      </div>
    );
  }

  return (
    <div className="panel panel-pad">
      <div className="between" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <span className="label-xs">Items · {count(rows.length)}</span>
        <div className="flex" style={{ alignItems: 'center', gap: 10 }}>
          {!brawlView && (
            <label className="flex" style={{ alignItems: 'center', gap: 8 }}>
              <span className="label-xs">Tier</span>
              <select
                className="field"
                style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}
                value={tier}
                onChange={(e) => setTier(Number(e.target.value))}
                aria-label="Filter items by tier"
              >
                <option value={0}>All</option>
                {TIERS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
          )}
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
      </div>

      <div className="flex" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 10 }} role="group" aria-label="Filter items by slot category">
        <button
          type="button"
          className={'tab' + (bucket === 'all' ? ' on' : '')}
          style={{ padding: '6px 12px', fontSize: 13 }}
          aria-pressed={bucket === 'all'}
          onClick={() => setBucket('all')}
        >
          All
        </button>
        {availableBuckets.map((b) => (
          <button
            key={b}
            type="button"
            className={'tab' + (bucket === b ? ' on' : '')}
            style={{ padding: '6px 12px', fontSize: 13 }}
            aria-pressed={bucket === b}
            onClick={() => setBucket(b)}
          >
            {BUCKET_LABEL[b]}
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

      {rows.length === 0 ? (
        <EmptyState title="No items match" message="Clear the search or pick another slot / tier." icon="filter" />
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 520, overflowY: 'auto' }}>
          {rows.map((it) => {
            if (brawlView) {
              return (
                <li key={it.item_id}>
                  <Tooltip asChild content={<ItemOverlayCard data={overlayFromCatalog(it)} />}>
                    <div
                      className="statrow"
                      tabIndex={0}
                      style={{ borderBottom: '1px solid var(--border-soft)', gap: 10 }}
                    >
                      <RowBody it={it} />
                      <span className="chip" style={{ flex: 'none' }}>Street Brawl</span>
                    </div>
                  </Tooltip>
                </li>
              );
            }
            const isPicked = pickedSet.has(it.item_id);
            const blocked = !isPicked && boardFull;
            return (
              <li key={it.item_id}>
                <Tooltip asChild content={<ItemOverlayCard data={overlayFromCatalog(it)} />}>
                  <button
                    type="button"
                    className="statrow"
                    style={{
                      width: '100%',
                      background: isPicked ? 'var(--overlay)' : 'transparent',
                      border: 'none',
                      borderBottom: '1px solid var(--border-soft)',
                      textAlign: 'left',
                      cursor: blocked ? 'not-allowed' : 'pointer',
                      opacity: blocked ? 0.45 : 1,
                      gap: 10,
                    }}
                    aria-pressed={isPicked}
                    disabled={blocked}
                    title={blocked ? 'Every slot is filled — remove an item first' : undefined}
                    onClick={() => (isPicked ? onRemove(it.item_id) : onAdd(it.item_id))}
                  >
                    <RowBody it={it} />
                    <span className="flex" style={{ alignItems: 'center', gap: 10, flex: 'none' }}>
                      <span className="chip" style={{ padding: '2px 7px' }}>T{it.item_tier ?? '?'}</span>
                      <span className="tnum amber-c" style={{ fontSize: 12.5, minWidth: 52, textAlign: 'right' }}>
                        {count(it.cost)}
                      </span>
                      <span aria-hidden="true" className={isPicked ? 'cyan-c' : 'faint'} style={{ fontSize: 15, width: 12 }}>
                        {isPicked ? '−' : '+'}
                      </span>
                    </span>
                  </button>
                </Tooltip>
              </li>
            );
          })}
        </ul>
      )}
      {!brawlView && (
        <p className="faint" style={{ fontSize: 11.5, margin: '10px 0 0' }}>
          Costs are souls, from the live item catalog.
        </p>
      )}
    </div>
  );
}
