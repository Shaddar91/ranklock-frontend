//Build Lab Analyze tab (design Lab §3-§6): import or start from a served set, then read that
//board's purchase order, ability progression and stat rail. Every query here is served; the
//tab computes nothing the model and C24's calculators do not hand it.
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../../lib/apiClient';
import { computeStats, type BaseStats, type BuildInput } from '../../../lib/computeStats';
import { affordableWindow, type AffordableAt } from '../../../lib/labCalc';
import { authorLabel, formatUpdated, isUpdatedThisPatch } from '../../../lib/buildMeta';
import { statLabel } from '../../../lib/statLabel';
import { EmptyState } from '../ui/index';
import { indexCatalog, normalizeCatalog } from '../creator/buildModel';
import { HeroSelect, HowToPlayLink, useHeroRoster, type RosterSlug } from './HeroBar';
import ImportPanel, { type ImportedHeader, type StartFromPreset } from './ImportPanel';
import PurchaseOrder from './PurchaseOrder';
import AbilityProgression from './AbilityProgression';
import AnalyzeRail from './AnalyzeRail';
import {
  abilitySteps,
  abilitySummaries,
  boardItems,
  buildContents,
  buildModifiers,
  matchServedOrder,
  phaseGroups,
  purchaseRows,
  tierAbilities,
  type BuildEntry,
  type ImportRef,
} from './analyzeModel';
import type {
  AbilityOrdersResponse,
  BuildById,
  HeroAbility,
  HeroAssetsResponse,
  HeroBuildStats,
  ItemModifier,
  LaneCurveResponse,
  TrimmedBuild,
} from '../../../types/api';

const NO_BASE: BaseStats = {};
const DAY_MS = 24 * 60 * 60_000;
const PACES = [
  { key: 'slow', label: 'Slow', factor: '×1.2' },
  { key: 'median', label: 'Median', factor: '×1' },
  { key: 'fast', label: 'Fast', factor: '×0.85' },
] as const;
type Pace = (typeof PACES)[number]['key'];

type BaseStatValue = { value: number; display_stat_name?: string };

interface AnalyzeTabProps {
  heroId: number | null;
  onHero: (id: number) => void;
  roster: RosterSlug[];
  onEditCopy: (build: BuildInput) => void;
  //Design §14 mounts here on Analyze; the timeline component itself is C26's.
  soulsTimeline?: React.ReactNode;
}

const minute = (at: AffordableAt | null): string => (at == null ? '—' : `${Math.round(at.tSeconds / 60)}′`);

function catalogEntries(ids: readonly number[], category: string): BuildEntry[] {
  return ids.map((itemId) => ({ itemId, category }));
}

export default function AnalyzeTab({ heroId, onHero, roster, onEditCopy, soulsTimeline }: AnalyzeTabProps) {
  const { heroes, isPending: rosterPending, isError: rosterError } = useHeroRoster();
  const active = heroes.find((h) => h.hero_id === heroId) ?? heroes[0] ?? null;
  const hero = active?.hero_id ?? null;

  const [buildId, setBuildId] = useState<number | null>(null);
  const [board, setBoard] = useState<{ title: string; source: string; entries: BuildEntry[] } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [pace, setPace] = useState<Pace>('median');
  const [tier, setTier] = useState(1);

  const catalogQuery = useQuery<ItemModifier[]>({
    queryKey: queryKeys.itemModifiers(),
    queryFn: () => api.getItemModifiers(),
  });
  const assetsQuery = useQuery<HeroAssetsResponse>({
    queryKey: queryKeys.heroAssets(hero ?? -1),
    queryFn: () => api.getHeroAssets(hero!),
    enabled: hero != null,
    retry: false,
  });
  const abilitiesQuery = useQuery<HeroAbility[]>({
    queryKey: queryKeys.heroAbilities(hero ?? -1),
    queryFn: () => api.getHeroAbilities(hero!),
    enabled: hero != null,
  });
  const ordersQuery = useQuery<AbilityOrdersResponse>({
    queryKey: queryKeys.heroAbilityOrders(hero ?? -1),
    queryFn: () => api.getAbilityOrders(hero!),
    enabled: hero != null,
    retry: false,
  });
  const buildStatsQuery = useQuery<HeroBuildStats>({
    queryKey: queryKeys.heroBuildStats(hero ?? -1),
    queryFn: () => api.getHeroBuildStats(hero!),
    enabled: hero != null,
    retry: false,
  });
  const communityQuery = useQuery<TrimmedBuild[]>({
    queryKey: queryKeys.heroBuilds(hero ?? -1, 'weekly'),
    queryFn: () => api.getHeroBuilds(hero!, 'weekly'),
    enabled: hero != null,
    retry: false,
  });
  const curveQuery = useQuery<LaneCurveResponse>({
    queryKey: queryKeys.laneFarmCurve({ metric: 'souls' }),
    queryFn: () => api.getLaneFarmCurve({ metric: 'souls' }),
    staleTime: DAY_MS,
    retry: false,
  });
  const importQuery = useQuery<BuildById>({
    queryKey: queryKeys.build(buildId ?? -1),
    queryFn: () => api.getBuildById(buildId!),
    enabled: buildId != null,
    retry: false,
  });

  const catalog = useMemo(() => normalizeCatalog(catalogQuery.data), [catalogQuery.data]);
  const byId = useMemo(() => indexCatalog(catalog), [catalog]);
  const curve = useMemo(
    () => (curveQuery.data?.points ?? []).filter((p) => p.p50 != null && p.t_seconds <= 3600),
    [curveQuery.data],
  );
  //The farm curve serves THOUSANDS of souls; C24's affordable-at compares against item costs.
  const soulsCurve = useMemo(
    () => curve.map((p) => ({ t_seconds: p.t_seconds, p50: (p.p50 as number) * 1000 })),
    [curve],
  );

  const imported = importQuery.data ?? null;

  useEffect(() => {
    if (imported && imported.hero_id > 0 && imported.hero_id !== heroId) onHero(imported.hero_id);
  }, [imported, heroId, onHero]);

  useEffect(() => {
    if (importQuery.isError) setImportError('No build with that id — check the number and try again.');
  }, [importQuery.isError]);

  const presets = useMemo<StartFromPreset[]>(() => {
    const shop = (ids: number[]) => [...new Set(ids)].filter((id) => byId.has(id)).slice(0, 12);
    const buyOrder = buildStatsQuery.data?.buy_order ?? [];
    const sets = [...(buildStatsQuery.data?.item_sets ?? [])].sort((a, b) => b.wilson_lower - a.wilson_lower);
    const community = communityQuery.data?.[0];
    return [
      {
        key: 'most-bought',
        label: 'Most bought',
        hint: 'The items bought most often on this hero — RankLock public matches',
        itemIds: shop([...buyOrder].sort((a, b) => b.games - a.games).map((r) => r.item_id)),
      },
      {
        key: 'best-wr',
        label: 'Best-WR items',
        hint: 'Highest Wilson-lower win rate among the same buys — RankLock public matches',
        itemIds: shop([...buyOrder].sort((a, b) => b.wilson_lower - a.wilson_lower).map((r) => r.item_id)),
      },
      {
        key: 'winning-set',
        label: 'Winning set #1',
        hint: 'The best-scoring served item set for this hero',
        itemIds: shop((sets[0]?.items ?? []).map((i) => i.item_id)),
      },
      {
        key: 'community',
        label: 'Community build',
        hint: community ? `Trending published build: ${community.name}` : 'No published build served yet',
        itemIds: shop(community ? buildContents(community).entries.map((e) => e.itemId) : []),
      },
    ];
  }, [buildStatsQuery.data, communityQuery.data, byId]);

  const contents = useMemo(() => (imported ? buildContents(imported) : null), [imported]);
  const entries = contents?.entries ?? board?.entries ?? [];
  const items = useMemo(() => boardItems(entries, byId), [entries, byId]);
  const rows = useMemo(() => purchaseRows(entries, byId), [entries, byId]);
  const groups = useMemo(() => phaseGroups(rows, curve), [rows, curve]);
  const total = rows[rows.length - 1]?.running ?? 0;

  const buildInput = useMemo<BuildInput>(
    () => ({ heroId: hero ?? 0, patch: active?.patch_id, items }),
    [hero, active, items],
  );
  const stats = useMemo(
    () => computeStats(active?.stats ?? NO_BASE, catalog, buildInput, { assets: assetsQuery.data ?? null }),
    [active, catalog, buildInput, assetsQuery.data],
  );
  const mods = useMemo(() => buildModifiers(stats, items, byId), [stats, items, byId]);
  const tierRows = useMemo(() => tierAbilities(assetsQuery.data?.abilities, tier), [assetsQuery.data, tier]);

  const steps = useMemo(() => abilitySteps(imported?.ability_order), [imported]);
  const summaries = useMemo(() => abilitySummaries(steps), [steps]);
  const orderMatch = useMemo(() => matchServedOrder(steps, ordersQuery.data?.orders), [steps, ordersQuery.data]);
  const abilityById = useMemo(
    () => new Map((abilitiesQuery.data ?? []).map((a) => [a.ability_id, a])),
    [abilitiesQuery.data],
  );

  const baseStats = useMemo(
    () =>
      Object.entries(active?.stats ?? {})
        .filter((e): e is [string, BaseStatValue] => typeof (e[1] as { value?: unknown } | null)?.value === 'number')
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, v]) => ({ key, value: v.value, label: statLabel(key, v.display_stat_name) })),
    [active],
  );

  const afford = useMemo(() => affordableWindow(soulsCurve, total, 'p50'), [soulsCurve, total]);
  const affordAt = pace === 'slow' ? afford.slow : pace === 'fast' ? afford.fast : afford.mid;

  const nowS = Math.floor(Date.now() / 1000);
  const header = useMemo<ImportedHeader | null>(() => {
    if (!imported && !board) return null;
    const paceRow = PACES.find((p) => p.key === pace)!;
    const affordNote = `at ${paceRow.label.toLowerCase()} pace (${paceRow.factor} on the cost — editorial) · RankLock public matches p50 souls curve, all heroes`;
    if (imported && contents) {
      return {
        heroName: active?.hero_name ?? null,
        title: imported.name || `Build ${imported.hero_build_id}`,
        author: `by ${authorLabel(imported)} · in-game build ${imported.hero_build_id}`,
        updated: formatUpdated(imported.last_updated_timestamp, nowS),
        fresh: isUpdatedThisPatch(imported.last_updated_timestamp, active?.patch_id),
        weekly: imported.num_weekly_favorites,
        categories: contents.categories,
        items: contents.items,
        points: contents.points,
        winRate: imported.win_rate_30d == null ? null : imported.win_rate_30d * 100,
        matches: imported.matches,
        price: total,
        owned: entries.length,
        afford: minute(affordAt),
        affordNote,
      };
    }
    return {
      heroName: active?.hero_name ?? null,
      title: board!.title,
      author: board!.source,
      updated: 'now',
      fresh: false,
      weekly: null,
      categories: 1,
      items: entries.length,
      points: 0,
      winRate: null,
      matches: null,
      price: total,
      owned: entries.length,
      afford: minute(affordAt),
      affordNote,
    };
  }, [imported, board, contents, active, entries.length, total, affordAt, pace, nowS]);

  const onImport = (ref: ImportRef) => {
    setImportError(null);
    setActivePreset(null);
    if (ref.kind === 'error') {
      setImportError(ref.message);
      return;
    }
    if (ref.kind === 'id') {
      setBoard(null);
      setBuildId(ref.buildId);
      return;
    }
    setBuildId(null);
    setBoard({
      title: 'Shared board',
      source: 'from a RankLock share link',
      entries: catalogEntries(ref.build.items, 'Shared board'),
    });
    if (ref.build.heroId > 0) onHero(ref.build.heroId);
  };

  const onPreset = (preset: StartFromPreset) => {
    setImportError(null);
    setBuildId(null);
    setActivePreset(preset.key);
    setBoard({ title: preset.label, source: preset.hint, entries: catalogEntries(preset.itemIds, preset.label) });
  };

  const paceSwitch = (
    <span className="tabs" role="group" aria-label="Farm pace">
      {PACES.map((p) => (
        <button
          key={p.key}
          type="button"
          className={'tab' + (pace === p.key ? ' on' : '')}
          style={{ padding: '2px 8px', fontSize: 11 }}
          onClick={() => setPace(p.key)}
        >
          {p.label}
        </button>
      ))}
    </span>
  );

  if (rosterPending) return <p className="muted" style={{ padding: '14px 2px' }}>Loading heroes…</p>;
  if (rosterError || heroes.length === 0 || !active) {
    return (
      <EmptyState
        title="Base stats not available yet"
        message="Base stats are captured once per patch. This patch's capture hasn't landed yet."
        icon="chart"
      />
    );
  }

  return (
    <div className="grid" style={{ gap: 22 }}>
      <div className="between" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div className="flex" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <HeroSelect heroes={heroes} activeId={active.hero_id} onHero={onHero} />
          <HowToPlayLink hero={active} roster={roster} />
        </div>
        <span className="mono faint" style={{ fontSize: 12 }}>
          patch {active.patch_id} · {active.source}
        </span>
      </div>

      <ImportPanel
        onImport={onImport}
        pending={importQuery.isFetching}
        error={importError}
        presets={presets}
        activePreset={activePreset}
        onPreset={onPreset}
        header={header}
        onEditCopy={() =>
          onEditCopy({
            heroId: hero ?? 0,
            patch: active.patch_id,
            items,
            abilityOrder: steps.map((s) => s.abilityId),
          })
        }
        paceSwitch={paceSwitch}
      />

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(300px, 1fr)', gap: 22 }}>
        <div className="grid" style={{ gap: 22, alignContent: 'start' }}>
          {rows.length > 0 && (
            <PurchaseOrder
              groups={groups}
              total={total}
              owned={entries.length}
              phased={curve.length > 0}
              band="all ranks"
            />
          )}
          {soulsTimeline}
          {imported && (
            <AbilityProgression
              steps={steps}
              summaries={summaries}
              abilities={abilityById}
              match={orderMatch}
              minMatches={ordersQuery.data?.min_matches ?? null}
              window={ordersQuery.data?.window ?? null}
            />
          )}
        </div>
        <AnalyzeRail
          stats={stats}
          mods={mods}
          tierAbilities={tierRows}
          baseStats={baseStats}
          hasBoard={items.length > 0}
          boardCount={items.length}
          tier={tier}
          onTier={setTier}
        />
      </div>
    </div>
  );
}
