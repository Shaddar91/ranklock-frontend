//Build Creator (statlocker parity, scope a): pick a hero, fill the item board, imbue items onto
//abilities, flip conditionals, and read the calculated Weapon / Vitality / Spirit panels + souls
//spend. All math is computeStats'; this component only assembles the BuildInput and renders.
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../../lib/apiClient';
import { computeStats, type BaseStats } from '../../../lib/computeStats';
import { readBuildFromHash } from '../../../lib/buildShare';
import { count } from '../../../lib/format';
import { EmptyState } from '../ui/index';
import type { HeroAbility, HeroBaseStats, ItemModifier } from '../../../types/api';
import BuildBoard from './BuildBoard';
import BuildToolbar from './BuildToolbar';
import CalculatedPanels from './CalculatedPanels';
import ItemPicker from './ItemPicker';
import { imbueAbilities, indexCatalog, layoutBuild, MAX_ITEMS, normalizeCatalog } from './buildModel';
import { useBuildDraft } from './useBuildDraft';

const NO_BASE: BaseStats = {};

function HeroSelect({
  heroes,
  heroId,
  onHero,
}: {
  heroes: HeroBaseStats[];
  heroId: number | null;
  onHero: (id: number) => void;
}) {
  const known = heroes.some((h) => h.hero_id === heroId);
  return (
    <label className="flex" style={{ alignItems: 'center', gap: 8 }}>
      <span className="label-xs">Hero</span>
      <select
        className="field"
        style={{ width: 'auto', padding: '8px 12px' }}
        value={known && heroId != null ? heroId : ''}
        onChange={(e) => onHero(Number(e.target.value))}
        aria-label="Select a hero"
      >
        {!known && <option value="" disabled>Select a hero…</option>}
        {heroes.map((h) => (
          <option key={h.hero_id} value={h.hero_id}>{h.hero_name}</option>
        ))}
      </select>
    </label>
  );
}

export default function BuildCreator() {
  const roster = useQuery<HeroBaseStats[]>({
    queryKey: queryKeys.heroBaseStats(),
    queryFn: () => api.getHeroBaseStats(),
  });
  const catalogQuery = useQuery<ItemModifier[]>({
    queryKey: queryKeys.itemModifiers(),
    queryFn: () => api.getItemModifiers(),
  });

  const heroes = useMemo(
    () =>
      [...(roster.data ?? [])]
        .filter((h) => h.hero_name?.trim())
        .sort((a, b) => a.hero_name.localeCompare(b.hero_name)),
    [roster.data],
  );
  const catalog = useMemo(() => normalizeCatalog(catalogQuery.data), [catalogQuery.data]);
  const byId = useMemo(() => indexCatalog(catalog), [catalog]);

  const {
    heroId,
    build,
    conditionalsEnabled,
    selectHero,
    addItem,
    removeItem,
    setImbue,
    toggleConditional,
    setConditionalsEnabled,
    loadBuild,
    clearItems,
  } = useBuildDraft();

  const abilityQuery = useQuery<HeroAbility[]>({
    queryKey: queryKeys.heroAbilities(heroId ?? -1),
    queryFn: () => api.getHeroAbilities(heroId ?? -1),
    enabled: heroId != null,
  });
  const abilities = useMemo(() => imbueAbilities(abilityQuery.data), [abilityQuery.data]);

  //A shared link round-trips through the fragment; read it once, after hydration.
  const [sharedLoaded, setSharedLoaded] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const shared = readBuildFromHash(window.location.hash);
    if (shared) {
      loadBuild(shared);
      setSharedLoaded(true);
    }
  }, [loadBuild]);

  useEffect(() => {
    if (heroId != null) return;
    const first = heroes[0];
    if (first) selectHero(first.hero_id, first.patch_id);
  }, [heroId, heroes, selectHero]);

  const hero = heroes.find((h) => h.hero_id === heroId) ?? null;
  const layout = useMemo(() => layoutBuild(build.items, byId), [build.items, byId]);
  const stats = useMemo(
    () => computeStats(hero?.stats ?? NO_BASE, catalog, build),
    [hero, catalog, build],
  );

  //Name the hero in the tab title on a shared-build landing — the /build/ shell is
  //server-rendered before the fragment is known, so only the client can name the hero.
  const heroName = hero?.hero_name ?? null;
  useEffect(() => {
    if (!sharedLoaded || typeof document === 'undefined' || !heroName) return;
    document.title = `${heroName} build — RankLock`;
  }, [sharedLoaded, heroName]);

  if (roster.isPending) {
    return <p className="muted" style={{ padding: '14px 2px' }}>Loading heroes…</p>;
  }
  if (roster.isError || heroes.length === 0) {
    return (
      <EmptyState
        title="Heroes not served yet"
        message="Hero base-stats are snapshotted per patch — the creator opens once that snapshot serves."
        icon="chart"
      />
    );
  }

  const patchDrift = build.patch != null && hero != null && build.patch !== hero.patch_id;
  const flagged = build.conditionalItems?.length ?? 0;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="between" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div className="flex" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <HeroSelect
            heroes={heroes}
            heroId={heroId}
            onHero={(id) => selectHero(id, heroes.find((h) => h.hero_id === id)?.patch_id)}
          />
          <label
            className="flex"
            style={{ alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--muted)' }}
            title="Count every item flagged conditional. Off excludes them whole — no uptime is simulated."
          >
            <input
              type="checkbox"
              checked={conditionalsEnabled}
              onChange={(e) => setConditionalsEnabled(e.target.checked)}
            />
            Enable conditionals
            {flagged > 0 && <span className="faint tnum">({flagged} flagged)</span>}
          </label>
        </div>
        <div className="flex" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="label-xs">
            {build.items.length} / {MAX_ITEMS} items ·{' '}
            <span className="tnum amber-c">{count(stats.spend.total)}</span> souls
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '6px 14px' }}
            disabled={build.items.length === 0}
            onClick={clearItems}
          >
            Clear
          </button>
        </div>
      </div>

      {patchDrift && (
        <p className="faint" style={{ fontSize: 12, margin: 0 }}>
          Built on patch {build.patch} · scored against the current snapshot ({hero?.patch_id}).
        </p>
      )}

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 16 }}>
        <ItemPicker
          catalog={catalog}
          picked={build.items}
          boardFull={build.items.length >= MAX_ITEMS}
          isPending={catalogQuery.isPending}
          isError={catalogQuery.isError}
          onAdd={addItem}
          onRemove={removeItem}
        />
        <div className="grid" style={{ gap: 16, alignContent: 'start' }}>
          <BuildBoard
            layout={layout}
            byId={byId}
            abilities={abilities}
            abilitiesPending={abilityQuery.isPending && heroId != null}
            imbueTargets={build.imbueTargets ?? {}}
            conditionalItems={build.conditionalItems ?? []}
            conditionalsEnabled={conditionalsEnabled}
            onImbue={setImbue}
            onToggleConditional={toggleConditional}
            onRemove={removeItem}
          />
          <BuildToolbar build={build} canShare={build.items.length > 0} onLoad={loadBuild} />
        </div>
      </div>

      <CalculatedPanels stats={stats} abilities={abilities} hasItems={build.items.length > 0} />
    </div>
  );
}
