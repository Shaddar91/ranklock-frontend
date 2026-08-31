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
import { statLabel } from '../../lib/statLabel';
import { groupBaseStats, statUnit } from '../../lib/baseStatGroups';
import { abilityOrderSequence, formatUpdated, isUpdatedThisPatch, SORT_MODES, type BuildSort } from '../../lib/buildMeta';
import BuildCreator from './creator/BuildCreator';
import type { HeroAbility, HeroBaseStats, ItemModifier, TrimmedBuild } from '../../types/api';

type Tab = 'creator' | 'builds' | 'heroes' | 'items';

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

  //Only entries whose nested value is numeric are display-worthy; grouped into
  //gameplay sections with the engine scalers/zero-defaults collapsed (§presentation).
  const statEntries = Object.entries(active.stats)
    .filter((e): e is [string, BaseStatValue] => typeof (e[1] as { value?: unknown } | null)?.value === 'number')
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, v]) => ({ key, value: v.value, label: statLabel(key, v.display_stat_name) }));
  const { groups, raw } = groupBaseStats(statEntries);

  const tile = (s: { key: string; value: number; label: string }) => {
    const unit = statUnit(s.key);
    return (
      <div key={s.key} className="tile statile">
        <div className="label-xs" title={s.label} style={{ overflowWrap: 'anywhere', overflow: 'hidden' }}>{s.label}</div>
        <div className="display tnum" style={{ fontSize: 22, fontWeight: 700 }}>
          {fmtStat(s.value)}
          {unit && <span className="muted" style={{ fontSize: 13, fontWeight: 600, marginLeft: 3 }}>{unit}</span>}
        </div>
      </div>
    );
  };

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
        <div style={{ display: 'grid', gap: 18 }}>
          {groups.map((g) => (
            <section key={g.key}>
              <div className="label-xs" style={{ marginBottom: 8, color: 'var(--cyan)', letterSpacing: '0.1em' }}>{g.label}</div>
              <div className="stat-grid">{g.stats.map(tile)}</div>
            </section>
          ))}
          {raw.length > 0 && (
            <details>
              <summary className="label-xs" style={{ cursor: 'pointer', color: 'var(--muted)' }}>
                Raw engine values · {raw.length}
              </summary>
              <div className="stat-grid" style={{ marginTop: 12 }}>{raw.map(tile)}</div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

//---- meta tab (builds) ------------------------------------------------------
//The hero's meta builds — GET /heroes/:id/builds?sort=weekly|favorites. Default is the
//server's recency-weighted weekly sort (stale-favorites giants demoted); the FE never
//re-sorts by lifetime favorites. Each card shows only signals the wire carries — weekly +
//all-time favorites, last update, an "updated this patch" badge, and the learn order drawn
//with the abilities-route icons. NO win-rate: our matches can't rank builds (items anonymized).

function AbilityOrderRow({ build, abilities }: { build: TrimmedBuild; abilities: Map<number, HeroAbility> }) {
  const seq = abilityOrderSequence(build.ability_order)
    .map((id) => abilities.get(id))
    .filter((a): a is HeroAbility => !!a);
  if (seq.length === 0) return null;
  return (
    <div className="flex" style={{ alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
      <span className="label-xs" style={{ marginRight: 2 }}>Order</span>
      {seq.map((a, i) => (
        <span key={`${a.ability_id}-${i}`} className="flex" style={{ alignItems: 'center', gap: 4 }}>
          <GameIcon kind="item" name={a.name} src={a.icon_url} size={24} />
          {i < seq.length - 1 && <span className="faint" aria-hidden="true">›</span>}
        </span>
      ))}
    </div>
  );
}

function HeroBuildsTab({ heroId, onHero }: { heroId: number | null; onHero: (id: number) => void }) {
  const { heroes, isPending: rosterPending, isError: rosterError } = useHeroRoster();
  const active = heroes.find((h) => h.hero_id === heroId) ?? heroes[0] ?? null;
  const [sort, setSort] = useState<BuildSort>('weekly');

  const { data, isPending, isError } = useQuery<TrimmedBuild[]>({
    queryKey: queryKeys.heroBuilds(active?.hero_id ?? -1, sort),
    queryFn: () => api.getHeroBuilds(active!.hero_id, sort),
    enabled: active != null,
  });
  const abilitiesQ = useQuery<HeroAbility[]>({
    queryKey: queryKeys.heroAbilities(active?.hero_id ?? -1),
    queryFn: () => api.getHeroAbilities(active!.hero_id),
    enabled: active != null,
  });
  const abilities = useMemo(() => {
    const m = new Map<number, HeroAbility>();
    for (const a of abilitiesQ.data ?? []) m.set(a.ability_id, a);
    return m;
  }, [abilitiesQ.data]);

  //Server order is authoritative (the recency model lives server-side); the FE only caps the list.
  const builds = useMemo(() => (data ?? []).slice(0, 20), [data]);
  const nowS = Math.floor(Date.now() / 1000);
  const patch = active?.patch_id ?? null;

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
        <div className="tabs" role="tablist" aria-label="Sort builds">
          {SORT_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              role="tab"
              aria-selected={sort === m.value}
              className={'tab' + (sort === m.value ? ' on' : '')}
              title={m.hint}
              onClick={() => setSort(m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      {isPending ? (
        <p className="muted" style={{ padding: '14px 2px' }}>Loading builds…</p>
      ) : isError || builds.length === 0 ? (
        <EmptyState
          title="No community builds for this hero yet"
          message="Published community builds for this hero will appear here — trending first."
          icon="book"
        />
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: '4px 0', display: 'grid', gap: 10 }}>
          {builds.map((b, i) => {
            const fresh = isUpdatedThisPatch(b.last_updated_timestamp, patch);
            return (
              <li key={`${b.hero_build_id || b.name}-${i}`} className="tile" style={{ padding: '12px 14px' }}>
                <div className="between" style={{ gap: 10, alignItems: 'baseline', marginBottom: 8 }}>
                  <span className="display" style={{ fontWeight: 600, color: 'var(--text)' }}>{b.name}</span>
                  {fresh && (
                    <span
                      className="label-xs"
                      style={{ padding: '2px 8px', borderRadius: 999, border: '1px solid var(--cyan)', color: 'var(--cyan)', whiteSpace: 'nowrap' }}
                    >
                      Updated this patch
                    </span>
                  )}
                </div>
                <AbilityOrderRow build={b} abilities={abilities} />
                <div className="between" style={{ gap: 12, marginTop: 8, fontSize: 12 }}>
                  <span className="mono" title="Weekly favorites — the recency signal" style={{ color: 'var(--gold)' }}>
                    ♥ {b.num_weekly_favorites == null ? DASH : count(b.num_weekly_favorites)} weekly
                  </span>
                  <span className="faint mono">
                    {b.num_favorites == null ? DASH : count(b.num_favorites)} all-time · updated {formatUpdated(b.last_updated_timestamp, nowS)}
                  </span>
                </div>
              </li>
            );
          })}
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

const TABS: { value: Tab; label: string }[] = [
  { value: 'creator', label: 'Creator' },
  { value: 'builds', label: 'Meta builds' },
  { value: 'heroes', label: 'Hero base stats' },
  { value: 'items', label: 'Item modifiers' },
];

function BuildLabInner() {
  //Default to the creator so a shared `#b1:` link lands on it (the creator reads the fragment
  //itself). Fixed for server + client render — no hydration mismatch.
  const [tab, setTab] = useState<Tab>('creator');
  //Island-level hero selection, shared by the base-stats and meta-builds tabs so a hero picked
  //on one stays picked on the other.
  const [heroId, setHeroId] = useState<number | null>(null);
  return (
    <div>
      <div className="tabs" role="tablist" aria-label="Build Lab">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            className={'tab' + (tab === t.value ? ' on' : '')}
            onClick={() => setTab(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ paddingTop: 12 }}>
        {tab === 'creator' && <BuildCreator />}
        {tab === 'builds' && <HeroBuildsTab heroId={heroId} onHero={setHeroId} />}
        {tab === 'heroes' && <HeroBaseStatsTab heroId={heroId} onHero={setHeroId} />}
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
