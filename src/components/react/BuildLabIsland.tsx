//============================================================================
//Build Lab island (C9) — wires the warmed-but-unconsumed Build Lab endpoints
//(§A.4): GET /heroes/base-stats (versioned starting-stats snapshot) and
//GET /items/modifiers (the 251 buildable items + their modifier rows). ONE island
//mounted on /build-lab, two tabs.
//
//Build-ahead caveat (§A.4): analytics.hero_base_stats is EMPTY locally until the
//patch snapshot hook runs, so /heroes/base-stats may 502 / return []. Both tabs
//empty-state instead of crashing (requirements §8.1).
//============================================================================
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../lib/apiClient';
import QueryProvider from './QueryProvider';
import { DataTable, type DataTableColumn, EmptyState, GameIcon } from './ui/index';
import { count, DASH, fixed } from '../../lib/format';
import type { HeroBaseStats, ItemModifier } from '../../types/api';

type Tab = 'heroes' | 'items';

//snake_case stat key → "Title Case" label. The raw starting_stats keys are an
//upstream concern; this is a presentational humanization, not invented data.
function humanize(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtStat(v: number): string {
  return Number.isInteger(v) ? count(v) : fixed(v);
}

//A base-stats entry is a nested object carrying a numeric `value` plus an
//upstream display label — NOT a bare number. See GET /heroes/base-stats
//(builds.rs HeroBaseStats); the shared `stats: Record<string, unknown>` masks
//this, so we narrow it here at the point of consumption.
type BaseStatValue = { value: number; display_stat_name?: string };

//Prefer the upstream display label carried on each stat value (e.g.
//"EMaxHealth"), stripping the single leading "E" enum-tag prefix. Fall back to
//humanizing the snake_case key when the API omits display_stat_name.
function statLabel(key: string, v: BaseStatValue): string {
  const dsn = v.display_stat_name;
  return dsn ? dsn.replace(/^E/, '') : humanize(key);
}

//---- hero base stats --------------------------------------------------------

function HeroBaseStatsTab() {
  const { data, isPending, isError } = useQuery<HeroBaseStats[]>({
    queryKey: queryKeys.heroBaseStats(),
    queryFn: () => api.getHeroBaseStats(),
  });
  const heroes = useMemo(
    () => [...(data ?? [])].sort((a, b) => a.hero_name.localeCompare(b.hero_name)),
    [data],
  );
  const [heroId, setHeroId] = useState<number | null>(null);
  const active = heroes.find((h) => h.hero_id === heroId) ?? heroes[0] ?? null;

  if (isPending) return <p className="muted" style={{ padding: '14px 2px' }}>Loading base stats…</p>;
  if (isError || heroes.length === 0 || !active) {
    return (
      <EmptyState
        title="Base stats not served yet"
        message="Hero base-stats are snapshotted per patch — the table is empty until the patch snapshot hook runs."
        icon="chart"
      />
    );
  }

  //Only entries whose nested value is numeric are display-worthy stat tiles.
  const statEntries = Object.entries(active.stats)
    .filter((e): e is [string, BaseStatValue] => typeof (e[1] as any)?.value === 'number')
    .sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div>
      <div className="between" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <label className="flex" style={{ alignItems: 'center', gap: 8 }}>
          <span className="label-xs">Hero</span>
          <select
            className="field"
            style={{ width: 'auto', padding: '8px 12px' }}
            value={active.hero_id}
            onChange={(e) => setHeroId(Number(e.target.value))}
            aria-label="Select a hero"
          >
            {heroes.map((h) => (
              <option key={h.hero_id} value={h.hero_id}>{h.hero_name}</option>
            ))}
          </select>
        </label>
        <span className="mono faint" style={{ fontSize: 12 }}>
          patch {active.patch_id} · {active.source}
        </span>
      </div>
      {statEntries.length === 0 ? (
        <EmptyState title="No numeric base stats" message="This hero's snapshot carries no numeric starting stats." icon="inbox" />
      ) : (
        <div className="stat-grid">
          {statEntries.map(([k, v]) => (
            <div key={k} className="tile statile">
              <div className="label-xs">{statLabel(k, v)}</div>
              <div className="display tnum" style={{ fontSize: 22, fontWeight: 700 }}>{fmtStat(v.value)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

//---- item modifiers ---------------------------------------------------------

function ItemModifiersTab() {
  const { data, isPending, isError } = useQuery<ItemModifier[]>({
    queryKey: queryKeys.itemModifiers(),
    queryFn: () => api.getItemModifiers(),
  });
  const items = data ?? [];
  const [slot, setSlot] = useState<string>('');

  const slots = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => it.item_slot_type && set.add(it.item_slot_type));
    return [...set].sort();
  }, [items]);

  const rows = useMemo(
    () => (slot === '' ? items : items.filter((it) => it.item_slot_type === slot)),
    [items, slot],
  );

  const columns = useMemo<DataTableColumn<ItemModifier>[]>(
    () => [
      {
        key: 'item',
        header: 'Item',
        sortValue: (it) => it.item_name ?? '',
        render: (it) => (
          <div className="flex" style={{ alignItems: 'center', gap: 10 }}>
            <GameIcon kind="item" name={it.item_name ?? 'Item'} src={it.shop_image_webp} size={28} />
            <span className="display" style={{ fontWeight: 600, color: 'var(--text)' }}>{it.item_name ?? `Item ${it.item_id ?? ''}`}</span>
          </div>
        ),
      },
      { key: 'slot', header: 'Slot', sortValue: (it) => it.item_slot_type ?? '', render: (it) => <span className="faint">{it.item_slot_type ?? DASH}</span> },
      { key: 'tier', header: 'Tier', numeric: true, sortValue: (it) => it.item_tier, render: (it) => <span className="tnum">{it.item_tier ?? DASH}</span> },
      { key: 'cost', header: 'Cost', numeric: true, sortValue: (it) => it.cost, render: (it) => <span className="tnum gold-c">{it.cost == null ? DASH : count(it.cost)}</span> },
      { key: 'mods', header: 'Modifiers', numeric: true, sortValue: (it) => it.modifiers.length, render: (it) => <span className="tnum">{count(it.modifiers.length)}</span> },
    ],
    [],
  );

  if (isPending) return <p className="muted" style={{ padding: '14px 2px' }}>Loading item modifiers…</p>;
  if (isError || items.length === 0) {
    return (
      <EmptyState
        title="Item modifiers not served yet"
        message="The buildable-item modifier blob warms from the assets API — it appears here once the cache is primed."
        icon="inbox"
      />
    );
  }

  return (
    <div>
      <div className="between" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <span className="label-xs">{count(rows.length)} buildable items</span>
        <label className="flex" style={{ alignItems: 'center', gap: 8 }}>
          <span className="label-xs">Slot</span>
          <select
            className="field"
            style={{ width: 'auto', padding: '8px 12px' }}
            value={slot}
            onChange={(e) => setSlot(e.target.value)}
            aria-label="Filter by item slot"
          >
            <option value="">All slots</option>
            {slots.map((s) => (
              <option key={s} value={s}>{humanize(s)}</option>
            ))}
          </select>
        </label>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(it, i) => it.item_id ?? i}
        initialSort={{ key: 'cost', dir: -1 }}
        caption="Buildable item modifiers — slot, tier, cost and modifier count"
        emptyTitle="No items for this slot"
        emptyMessage="Try another slot."
      />
    </div>
  );
}

function BuildLabInner() {
  const [tab, setTab] = useState<Tab>('heroes');
  return (
    <div>
      <div className="tabs" role="tablist" aria-label="Build Lab">
        <button type="button" role="tab" aria-selected={tab === 'heroes'} className={'tab' + (tab === 'heroes' ? ' on' : '')} onClick={() => setTab('heroes')}>
          Hero base stats
        </button>
        <button type="button" role="tab" aria-selected={tab === 'items'} className={'tab' + (tab === 'items' ? ' on' : '')} onClick={() => setTab('items')}>
          Item modifiers
        </button>
      </div>
      <div style={{ paddingTop: 12 }}>{tab === 'heroes' ? <HeroBaseStatsTab /> : <ItemModifiersTab />}</div>
    </div>
  );
}

export default function BuildLabIsland() {
  return (
    <QueryProvider>
      <BuildLabInner />
    </QueryProvider>
  );
}
