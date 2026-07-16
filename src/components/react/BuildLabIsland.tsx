//============================================================================
//Build Lab island (C9) — wires the warmed-but-unconsumed Build Lab endpoints
//(§A.4): GET /heroes/base-stats (versioned starting-stats snapshot), GET
///heroes/:id/builds (top community builds) and GET /items/modifiers (the
//buildable items + their modifier rows). ONE island mounted on /build-lab,
//three tabs: Hero base stats · Builds · Item modifiers.
//
//Build-ahead caveat (§A.4): analytics.hero_base_stats is EMPTY locally until the
//patch snapshot hook runs, so /heroes/base-stats may 502 / return []. Every tab
//empty-states instead of crashing (requirements §8.1).
//============================================================================
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../lib/apiClient';
import QueryProvider from './QueryProvider';
import { DataTable, type DataTableColumn, EmptyState, GameIcon } from './ui/index';
import { count, DASH, fixed } from '../../lib/format';
import type { HeroBaseStats, ItemModifier, TrimmedBuild } from '../../types/api';

type Tab = 'heroes' | 'builds' | 'items';

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

//---- shared playable-hero roster -------------------------------------------
//The /heroes/base-stats snapshot restricted to currently-playable heroes
//(Component 1's server-side fix). Belt-and-suspenders: drop any row whose
//hero_name is empty/whitespace BEFORE sort/map, so the <select> can never render
//a blank <option> even if the base-stats API ever regresses. Shared by the base
//-stats and builds tabs — react-query dedupes the single /heroes/base-stats
//fetch across both consumers.
function useHeroRoster() {
  const q = useQuery<HeroBaseStats[]>({
    queryKey: queryKeys.heroBaseStats(),
    queryFn: () => api.getHeroBaseStats(),
  });
  const heroes = useMemo(
    () =>
      [...(q.data ?? [])]
        .filter((h) => h.hero_name?.trim())
        .sort((a, b) => a.hero_name.localeCompare(b.hero_name)),
    [q.data],
  );
  return { heroes, isPending: q.isPending, isError: q.isError };
}

//Shared hero <select> — the same control on the base-stats and builds tabs,
//writing the picked hero into the island-level selection so it persists across
//tab switches.
function HeroSelect({
  heroes,
  activeId,
  onHero,
}: {
  heroes: HeroBaseStats[];
  activeId: number;
  onHero: (id: number) => void;
}) {
  return (
    <label className="flex" style={{ alignItems: 'center', gap: 8 }}>
      <span className="label-xs">Hero</span>
      <select
        className="field"
        style={{ width: 'auto', padding: '8px 12px' }}
        value={activeId}
        onChange={(e) => onHero(Number(e.target.value))}
        aria-label="Select a hero"
      >
        {heroes.map((h) => (
          <option key={h.hero_id} value={h.hero_id}>{h.hero_name}</option>
        ))}
      </select>
    </label>
  );
}

//---- hero base stats --------------------------------------------------------

function HeroBaseStatsTab({ heroId, onHero }: { heroId: number | null; onHero: (id: number) => void }) {
  const { heroes, isPending, isError } = useHeroRoster();
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
    .filter((e): e is [string, BaseStatValue] => typeof (e[1] as { value?: unknown } | null)?.value === 'number')
    .sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div>
      <div className="between" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <HeroSelect heroes={heroes} activeId={active.hero_id} onHero={onHero} />
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

//---- builds -----------------------------------------------------------------
//Top community builds for the selected hero — GET /heroes/:id/builds (Redis-
//cached, ≤20/hero). The endpoint carries no playstyle/role/archetype dimension,
//so this is honestly labelled "by favorites" and sorted num_favorites-desc; NO
//playstyle classifier is invented. Empty-states honestly when a hero has none.

function HeroBuildsTab({ heroId, onHero }: { heroId: number | null; onHero: (id: number) => void }) {
  const { heroes, isPending: rosterPending, isError: rosterError } = useHeroRoster();
  const active = heroes.find((h) => h.hero_id === heroId) ?? heroes[0] ?? null;

  const { data, isPending, isError } = useQuery<TrimmedBuild[]>({
    queryKey: queryKeys.heroBuilds(active?.hero_id ?? -1),
    queryFn: () => api.getHeroBuilds(active!.hero_id),
    enabled: active != null,
  });

  const builds = useMemo(
    () => [...(data ?? [])].sort((a, b) => (b.num_favorites ?? 0) - (a.num_favorites ?? 0)).slice(0, 20),
    [data],
  );

  if (rosterPending) return <p className="muted" style={{ padding: '14px 2px' }}>Loading heroes…</p>;
  if (rosterError || heroes.length === 0 || !active) {
    return (
      <EmptyState
        title="Heroes not served yet"
        message="The playable-hero roster is snapshotted per patch — builds appear once it serves."
        icon="inbox"
      />
    );
  }

  return (
    <div>
      <div className="between" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <HeroSelect heroes={heroes} activeId={active.hero_id} onHero={onHero} />
        <span className="label-xs">Top community builds (by favorites)</span>
      </div>
      {isPending ? (
        <p className="muted" style={{ padding: '14px 2px' }}>Loading builds…</p>
      ) : isError || builds.length === 0 ? (
        <EmptyState
          title="No community builds for this hero yet"
          message="Published community builds for this hero will appear here, most-favorited first."
          icon="book"
        />
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: '8px 0' }}>
          {builds.map((b, i) => (
            <li key={`${b.name}-${i}`} className="statrow">
              <span className="display" style={{ fontWeight: 600, color: 'var(--text)' }}>{b.name}</span>
              <span className="mono" style={{ fontSize: 12, color: 'var(--gold)' }}>
                ♥ {count(b.num_favorites)}
              </span>
            </li>
          ))}
        </ul>
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

  //Plain-language explainer so the tab's purpose is unambiguous — this is a
  //reference CATALOG of every buildable item and the stat bonuses ("modifiers")
  //it grants, NOT a build editor. Rendered in every state (incl. empty/loading).
  const explainer = (
    <p className="muted" style={{ fontSize: 12.5, margin: '0 0 12px' }}>
      {'Every buildable item and the stat bonuses (“modifiers”) it grants — the numeric substrate for builds, not a build editor.'}
    </p>
  );

  return (
    <div>
      {explainer}
      {isPending ? (
        <p className="muted" style={{ padding: '14px 2px' }}>Loading item modifiers…</p>
      ) : isError || items.length === 0 ? (
        <EmptyState
          title="Item modifiers not served yet"
          message="The buildable-item modifier blob warms from the assets API — it appears here once the cache is primed."
          icon="inbox"
        />
      ) : (
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
      )}
    </div>
  );
}

function BuildLabInner() {
  const [tab, setTab] = useState<Tab>('heroes');
  //Island-level hero selection, shared by the base-stats and builds tabs so a
  //hero picked on one tab stays picked on the other.
  const [heroId, setHeroId] = useState<number | null>(null);
  return (
    <div>
      <div className="tabs" role="tablist" aria-label="Build Lab">
        <button type="button" role="tab" aria-selected={tab === 'heroes'} className={'tab' + (tab === 'heroes' ? ' on' : '')} onClick={() => setTab('heroes')}>
          Hero base stats
        </button>
        <button type="button" role="tab" aria-selected={tab === 'builds'} className={'tab' + (tab === 'builds' ? ' on' : '')} onClick={() => setTab('builds')}>
          Builds
        </button>
        <button type="button" role="tab" aria-selected={tab === 'items'} className={'tab' + (tab === 'items' ? ' on' : '')} onClick={() => setTab('items')}>
          Item modifiers
        </button>
      </div>
      <div style={{ paddingTop: 12 }}>
        {tab === 'heroes' && <HeroBaseStatsTab heroId={heroId} onHero={setHeroId} />}
        {tab === 'builds' && <HeroBuildsTab heroId={heroId} onHero={setHeroId} />}
        {tab === 'items' && <ItemModifiersTab />}
      </div>
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
