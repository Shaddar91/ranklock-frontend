//Build Lab Analyze tab (design Lab §3-§6): import or start from a served set, then read that
//board's purchase order, ability progression and stat rail. Every query here is served; the
//tab computes nothing the model and C24's calculators do not hand it.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../../lib/apiClient';
import { computeStats, type BaseStats, type BuildInput } from '../../../lib/computeStats';
import { useViewer } from '../player/usePlayer';
import { authorLabel, formatUpdated, isUpdatedThisPatch, signatureIcons, signatureSlots } from '../../../lib/buildMeta';
import { EmptyState } from '../ui/index';
import { indexCatalog, normalizeCatalog } from '../creator/buildModel';
import { useHeroRoster } from './HeroBar';
import ImportPanel, { type ImportedHeader } from './ImportPanel';
import PurchaseOrder from './PurchaseOrder';
import AbilityProgression from './AbilityProgression';
import AnalyzeRail from './AnalyzeRail';
import {
  cohortCurvePoints,
  ownCurvePoints,
  startFromPresets,
  timelineRows,
  type StartFromPreset,
  type TimelinePace,
} from './createModel';
import {
  abilitySteps,
  abilitySummaries,
  boardItems,
  buildContents,
  buildModifiers,
  matchServedOrder,
  phaseGroups,
  purchaseRows,
  stepsFromSequence,
  tierAbilities,
  type BuildEntry,
  type ImportRef,
} from './analyzeModel';
import type { LabBoard } from '../BuildLabIsland';
import type {
  AbilityOrdersResponse,
  BuildById,
  HeroAbility,
  HeroAssetsResponse,
  HeroBuildStats,
  HeroSummary,
  ItemModifier,
  LaneCurveResponse,
  PlayerEconomyCurveResponse,
  TrimmedBuild,
} from '../../../types/api';

const NO_BASE: BaseStats = {};
const NO_ENTRIES: BuildEntry[] = [];
const DAY_MS = 24 * 60 * 60_000;
//Both lab tabs read the hero at the same level, so the two boards stay comparable.
const LAB_LEVEL = 20;
//The design opens on a loaded board; live does the same from the best-scoring served preset.
const DEFAULT_PRESET = 'best-wr';
//The tier switch opens where the design's does — the fully-levelled kit.
const DEFAULT_TIER = 3;

const PACE_LABEL: Record<TimelinePace, string> = {
  p25: 'slow · p25',
  p50: 'median · p50',
  p75: 'fast · p75',
  you: 'your own',
};

interface AnalyzeTabProps {
  heroId: number | null;
  onHero: (id: number) => void;
  pace: TimelinePace;
  onBoard: (board: LabBoard) => void;
  timeline: ReactNode;
  onEditCopy: (build: BuildInput) => void;
  //Handed over by a Community-tab Import row; cleared through onImportConsumed so the same
  //row can be imported again after the board has been replaced here.
  importBuildId: number | null;
  onImportConsumed: () => void;
}

function catalogEntries(ids: readonly number[], category: string): BuildEntry[] {
  return ids.map((itemId) => ({ itemId, category }));
}

export default function AnalyzeTab({
  heroId,
  onHero,
  pace,
  onBoard,
  timeline: timelineNode,
  onEditCopy,
  importBuildId,
  onImportConsumed,
}: AnalyzeTabProps) {
  const { heroes, isPending: rosterPending, isError: rosterError } = useHeroRoster();
  const active = heroes.find((h) => h.hero_id === heroId) ?? heroes[0] ?? null;
  const hero = active?.hero_id ?? null;

  const [buildId, setBuildId] = useState<number | null>(null);
  const [board, setBoard] = useState<{ title: string; source: string; entries: BuildEntry[] } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [seededFor, setSeededFor] = useState<number | null>(null);
  const [tier, setTier] = useState(DEFAULT_TIER);

  //The signed-in viewer's own souls curve backs the timeline's "You" pace; signed out, it is absent.
  const { viewer } = useViewer();
  const accountId = viewer?.deadlock_account_id ?? null;

  const rosterArt = useQuery<HeroSummary[]>({ queryKey: queryKeys.heroes(), queryFn: () => api.getHeroes() });
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
  const ownCurveQuery = useQuery<PlayerEconomyCurveResponse>({
    queryKey: queryKeys.playerEconomyCurve(accountId ?? -1, { metric: 'souls' }),
    queryFn: () => api.getPlayerEconomyCurve(accountId!, { metric: 'souls' }),
    enabled: accountId != null && accountId > 0,
    retry: false,
    staleTime: DAY_MS,
  });

  const catalog = useMemo(() => normalizeCatalog(catalogQuery.data), [catalogQuery.data]);
  const byId = useMemo(() => indexCatalog(catalog), [catalog]);
  const curve = useMemo(
    () => (curveQuery.data?.points ?? []).filter((p) => p.p50 != null && p.t_seconds <= 3600),
    [curveQuery.data],
  );
  const soulsCurve = useMemo(() => cohortCurvePoints(curve), [curve]);

  const imported = importQuery.data ?? null;

  useEffect(() => {
    if (imported && imported.hero_id > 0 && imported.hero_id !== heroId) onHero(imported.hero_id);
  }, [imported, heroId, onHero]);

  useEffect(() => {
    if (importQuery.isError) setImportError('No build with that id — check the number and try again.');
  }, [importQuery.isError]);

  useEffect(() => {
    if (importBuildId == null) return;
    setImportError(null);
    setActivePreset(null);
    setBoard(null);
    setBuildId(importBuildId);
    onImportConsumed();
  }, [importBuildId, onImportConsumed]);

  const presets = useMemo<StartFromPreset[]>(
    () => startFromPresets(buildStatsQuery.data, communityQuery.data?.[0], byId),
    [buildStatsQuery.data, communityQuery.data, byId],
  );

  //Open on a board, as the design does: a served preset per hero, until a real import replaces it.
  useEffect(() => {
    if (hero == null || buildId != null || seededFor === hero || byId.size === 0) return;
    const first =
      presets.find((p) => p.key === DEFAULT_PRESET && p.itemIds.length > 0) ??
      presets.find((p) => p.itemIds.length > 0);
    if (!first) return;
    setSeededFor(hero);
    setActivePreset(first.key);
    setBoard({ title: first.label, source: first.hint, entries: catalogEntries(first.itemIds, first.label) });
  }, [hero, presets, buildId, seededFor, byId]);

  const contents = useMemo(() => (imported ? buildContents(imported) : null), [imported]);
  const entries = contents?.entries ?? board?.entries ?? NO_ENTRIES;
  const items = useMemo(() => boardItems(entries, byId), [entries, byId]);
  const rows = useMemo(() => purchaseRows(entries, byId), [entries, byId]);
  const groups = useMemo(() => phaseGroups(rows, curve), [rows, curve]);
  const total = rows[rows.length - 1]?.running ?? 0;

  const buildInput = useMemo<BuildInput>(
    () => ({ heroId: hero ?? 0, patch: active?.patch_id, items }),
    [hero, active, items],
  );
  const stats = useMemo(
    () => computeStats(active?.stats ?? NO_BASE, catalog, buildInput, { assets: assetsQuery.data ?? null, level: LAB_LEVEL }),
    [active, catalog, buildInput, assetsQuery.data],
  );
  const mods = useMemo(() => buildModifiers(stats, items, byId), [stats, items, byId]);
  const tierRows = useMemo(() => tierAbilities(assetsQuery.data?.abilities, tier), [assetsQuery.data, tier]);

  //An imported build carries its own order; a served-preset board reads the hero's most-played one.
  const topOrder = useMemo(
    () => [...(ordersQuery.data?.orders ?? [])].sort((a, b) => b.matches - a.matches)[0] ?? null,
    [ordersQuery.data],
  );
  const steps = useMemo(
    () => (imported ? abilitySteps(imported.ability_order) : stepsFromSequence(topOrder?.abilities ?? [])),
    [imported, topOrder],
  );
  const summaries = useMemo(() => abilitySummaries(steps), [steps]);
  const orderMatch = useMemo(() => matchServedOrder(steps, ordersQuery.data?.orders), [steps, ordersQuery.data]);
  const abilityById = useMemo(
    () => new Map((abilitiesQuery.data ?? []).map((a) => [a.ability_id, a])),
    [abilitiesQuery.data],
  );
  const slots = useMemo(() => signatureSlots(abilitiesQuery.data), [abilitiesQuery.data]);
  const icons = useMemo(() => signatureIcons(abilitiesQuery.data), [abilitiesQuery.data]);

  const ownCurve = useMemo(() => ownCurvePoints(ownCurveQuery.data?.you ?? []), [ownCurveQuery.data]);
  const ownCurveAvailable = accountId != null && ownCurve.length > 0;
  const timeline = useMemo(
    () => timelineRows(rows, soulsCurve, pace, ownCurve),
    [rows, soulsCurve, pace, ownCurve],
  );

  useEffect(() => {
    onBoard({ rows: timeline, ownCurve: ownCurveAvailable, share: items.length > 0 ? buildInput : null });
  }, [timeline, ownCurveAvailable, items.length, buildInput, onBoard]);

  const affordAt = timeline[timeline.length - 1]?.at ?? null;
  const afford =
    affordAt == null
      ? 'past 40′'
      : `${Math.floor(Math.round(affordAt.tSeconds) / 60)}:${String(Math.round(affordAt.tSeconds) % 60).padStart(2, '0')}`;

  const nowS = Math.floor(Date.now() / 1000);
  const heroIcon = useMemo(
    () => (rosterArt.data ?? []).find((h) => h.hero_id === hero)?.icon_url ?? null,
    [rosterArt.data, hero],
  );
  const header = useMemo<ImportedHeader | null>(() => {
    if (!imported && !board) return null;
    const affordNote = `at ${PACE_LABEL[pace]} farm`;
    const common = { heroName: active?.hero_name ?? null, heroIcon, price: total, owned: entries.length, afford, affordNote };
    if (imported && contents) {
      return {
        ...common,
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
      };
    }
    return {
      ...common,
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
    };
  }, [imported, board, contents, active, heroIcon, entries.length, total, afford, pace, nowS]);

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
      />

      <div className="lab-cols">
        <div className="lab-col">
          {rows.length > 0 && (
            <PurchaseOrder
              groups={groups}
              total={total}
              owned={entries.length}
              phased={curve.length > 0}
              band="all ranks"
            />
          )}
          <AbilityProgression
            steps={steps}
            summaries={summaries}
            abilities={abilityById}
            slots={slots}
            served={imported == null}
            match={orderMatch}
            minMatches={ordersQuery.data?.min_matches ?? null}
            window={ordersQuery.data?.window ?? null}
          />
        </div>
        <AnalyzeRail
          stats={stats}
          mods={mods}
          tierAbilities={tierRows}
          slots={slots}
          icons={icons}
          heroName={active.hero_name}
          level={LAB_LEVEL}
          hasBoard={items.length > 0}
          boardCount={items.length}
          tier={tier}
          onTier={setTier}
        />
      </div>

      {timelineNode}
    </div>
  );
}
