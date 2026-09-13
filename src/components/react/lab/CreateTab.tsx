//Build Lab Create tab (design Lab §7-§12 + §14): the board beside the shop, the target panel and
//the computed stat cards on the rail, then the souls timeline, the abilities table beside the
//order editor and the A-vs-B compare — all read off the one draft this tab owns.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../../lib/apiClient';
import { computeStats, type BaseStats, type BuildInput } from '../../../lib/computeStats';
import { readBuildFromHash } from '../../../lib/buildShare';
import { signatureSlots } from '../../../lib/buildMeta';
import { indexCatalog, layoutBuild, normalizeCatalog, TOTAL_SLOTS } from '../creator/buildModel';
import { useBuildDraft } from '../creator/useBuildDraft';
import { useViewer } from '../player/usePlayer';
import { buildModifiers, purchaseRows, tierAbilities, type BuildEntry } from './analyzeModel';
import {
  cohortCurvePoints,
  initialOrder,
  ownCurvePoints,
  startFromPresets,
  timelineRows,
  type StartFromPreset,
  type TimelinePace,
} from './createModel';
import { useHeroRoster } from './HeroBar';
import LabBoard from './LabBoard';
import LabShop from './LabShop';
import TargetPanel from './TargetPanel';
import BoardStatPanels from './BoardStatPanels';
import BoardAbilities from './BoardAbilities';
import OrderEditor from './OrderEditor';
import CompareBoards from './CompareBoards';
import type { LabBoard as LabBoardState } from '../BuildLabIsland';
import type {
  AbilityOrdersResponse,
  HeroAbility,
  HeroAssetsResponse,
  HeroBuildStats,
  HeroSummary,
  ItemModifier,
  LaneCurveResponse,
  Patch,
  PlayerEconomyCurveResponse,
  TrimmedBuild,
} from '../../../types/api';

const NO_BASE: BaseStats = {};
const DAY_MS = 24 * 60 * 60_000;
const DEFAULT_LEVEL = 20;
//The board, the tier switch and Board B open where the design's do.
const DEFAULT_TIER = 3;
const DEFAULT_PRESET = 'best-wr';
const DEFAULT_COMPARE = 'winning-set';

interface CreateTabProps {
  initial?: BuildInput | null;
  heroId: number | null;
  onHero: (id: number) => void;
  pace: TimelinePace;
  onBoard: (board: LabBoardState) => void;
  timeline: ReactNode;
}

export default function CreateTab({ initial, heroId, onHero, pace, onBoard, timeline }: CreateTabProps) {
  const draft = useBuildDraft();
  const { heroes } = useHeroRoster();
  const [level, setLevel] = useState(DEFAULT_LEVEL);
  const [tier, setTier] = useState(DEFAULT_TIER);
  const [targetId, setTargetId] = useState<number | null>(null);
  const [order, setOrder] = useState<number[]>(initialOrder);
  const [compareKey, setCompareKey] = useState<string | null>(DEFAULT_COMPARE);
  const [presetKey, setPresetKey] = useState<string | null>(null);
  const [seededFor, setSeededFor] = useState<number | null>(null);

  const hero = heroes.find((h) => h.hero_id === heroId) ?? null;

  const rosterArt = useQuery<HeroSummary[]>({ queryKey: queryKeys.heroes(), queryFn: () => api.getHeroes() });
  const catalogQuery = useQuery<ItemModifier[]>({
    queryKey: queryKeys.itemModifiers(),
    queryFn: () => api.getItemModifiers(),
  });
  const patchQuery = useQuery<Patch>({
    queryKey: queryKeys.patchCurrent(),
    queryFn: () => api.getCurrentPatch(),
    staleTime: DAY_MS,
    retry: false,
  });
  const assetsQuery = useQuery<HeroAssetsResponse>({
    queryKey: queryKeys.heroAssets(heroId ?? -1),
    queryFn: () => api.getHeroAssets(heroId!),
    enabled: heroId != null,
    retry: false,
  });
  const abilitiesQuery = useQuery<HeroAbility[]>({
    queryKey: queryKeys.heroAbilities(heroId ?? -1),
    queryFn: () => api.getHeroAbilities(heroId!),
    enabled: heroId != null,
  });
  const ordersQuery = useQuery<AbilityOrdersResponse>({
    queryKey: queryKeys.heroAbilityOrders(heroId ?? -1),
    queryFn: () => api.getAbilityOrders(heroId!),
    enabled: heroId != null,
    retry: false,
  });
  const buildStatsQuery = useQuery<HeroBuildStats>({
    queryKey: queryKeys.heroBuildStats(heroId ?? -1),
    queryFn: () => api.getHeroBuildStats(heroId!),
    enabled: heroId != null,
    retry: false,
  });
  const communityQuery = useQuery<TrimmedBuild[]>({
    queryKey: queryKeys.heroBuilds(heroId ?? -1, 'weekly'),
    queryFn: () => api.getHeroBuilds(heroId!, 'weekly'),
    enabled: heroId != null,
    retry: false,
  });
  const curveQuery = useQuery<LaneCurveResponse>({
    queryKey: queryKeys.laneFarmCurve({ metric: 'souls' }),
    queryFn: () => api.getLaneFarmCurve({ metric: 'souls' }),
    staleTime: DAY_MS,
    retry: false,
  });
  const targetAssetsQuery = useQuery<HeroAssetsResponse>({
    queryKey: queryKeys.heroAssets(targetId ?? -1),
    queryFn: () => api.getHeroAssets(targetId!),
    enabled: targetId != null,
    retry: false,
  });

  //The signed-in viewer's own souls curve backs the "You" pace; a signed-out viewer never sees it.
  const { viewer } = useViewer();
  const accountId = viewer?.deadlock_account_id ?? null;
  const ownCurveQuery = useQuery<PlayerEconomyCurveResponse>({
    queryKey: queryKeys.playerEconomyCurve(accountId ?? -1, { metric: 'souls' }),
    queryFn: () => api.getPlayerEconomyCurve(accountId!, { metric: 'souls' }),
    enabled: accountId != null && accountId > 0,
    retry: false,
    staleTime: DAY_MS,
  });

  const catalog = useMemo(() => normalizeCatalog(catalogQuery.data), [catalogQuery.data]);
  const byId = useMemo(() => indexCatalog(catalog), [catalog]);
  const icons = useMemo(
    () => new Map((rosterArt.data ?? []).map((h) => [h.hero_id, h.icon_url] as const)),
    [rosterArt.data],
  );
  const picks = useMemo(
    () => new Map((rosterArt.data ?? []).map((h) => [h.hero_id, h.picks] as const)),
    [rosterArt.data],
  );
  const cohortCurve = useMemo(() => cohortCurvePoints(curveQuery.data?.points), [curveQuery.data]);
  const ownCurve = useMemo(() => ownCurvePoints(ownCurveQuery.data?.you ?? []), [ownCurveQuery.data]);

  const presets = useMemo(
    () => startFromPresets(buildStatsQuery.data, communityQuery.data?.[0], byId),
    [buildStatsQuery.data, communityQuery.data, byId],
  );

  const { loadBuild, selectHero } = draft;
  //A shared link round-trips through the fragment; read it once, after hydration.
  const [sharedLoaded, setSharedLoaded] = useState(false);
  useEffect(() => {
    const shared = readBuildFromHash(window.location.hash);
    if (!shared) return;
    loadBuild(shared);
    setSharedLoaded(true);
    if (shared.heroId > 0) onHero(shared.heroId);
  }, [loadBuild, onHero]);

  //"Edit a copy" on Analyze hands the board over; it wins over the empty draft, never over a link.
  useEffect(() => {
    if (initial && !sharedLoaded) loadBuild(initial);
  }, [initial, sharedLoaded, loadBuild]);

  //The page owns the hero; the draft follows it and rebuilds from empty on a real switch.
  useEffect(() => {
    if (sharedLoaded || heroId == null) return;
    selectHero(heroId, heroes.find((h) => h.hero_id === heroId)?.patch_id);
  }, [heroId, heroes, selectHero, sharedLoaded]);

  //Open on a board, as the design does, unless a share link or an "edit a copy" already filled one.
  useEffect(() => {
    if (sharedLoaded || initial || heroId == null || seededFor === heroId || byId.size === 0) return;
    const first =
      presets.find((p) => p.key === DEFAULT_PRESET && p.itemIds.length > 0) ??
      presets.find((p) => p.itemIds.length > 0);
    if (!first) return;
    setSeededFor(heroId);
    setPresetKey(first.key);
    loadBuild({ heroId, patch: heroes.find((h) => h.hero_id === heroId)?.patch_id, items: first.itemIds });
  }, [sharedLoaded, initial, heroId, seededFor, presets, heroes, byId, loadBuild]);

  const board = draft.build;
  const layout = useMemo(() => layoutBuild(board.items, byId), [board.items, byId]);
  const stats = useMemo(
    () => computeStats(hero?.stats ?? NO_BASE, catalog, board, { assets: assetsQuery.data ?? null, level }),
    [hero, catalog, board, assetsQuery.data, level],
  );
  const mods = useMemo(() => buildModifiers(stats, board.items, byId), [stats, board.items, byId]);
  const tierRows = useMemo(() => tierAbilities(assetsQuery.data?.abilities, tier), [assetsQuery.data, tier]);
  const abilities = useMemo(
    () => [...(abilitiesQuery.data ?? [])].filter((a) => a.slot?.startsWith('signature')).sort((a, b) => a.order - b.order),
    [abilitiesQuery.data],
  );
  const slots = useMemo(() => signatureSlots(abilitiesQuery.data), [abilitiesQuery.data]);

  const compareB = presets.find((p) => p.key === compareKey) ?? null;
  const compareStats = useMemo(() => {
    if (compareB == null || compareB.itemIds.length === 0) return null;
    const input: BuildInput = { heroId: heroId ?? 0, patch: hero?.patch_id, items: compareB.itemIds };
    return computeStats(hero?.stats ?? NO_BASE, catalog, input, { assets: assetsQuery.data ?? null, level });
  }, [compareB, hero, heroId, catalog, assetsQuery.data, level]);

  const entries = useMemo<BuildEntry[]>(
    () => board.items.map((itemId) => ({ itemId, category: byId.get(itemId)?.item_slot_type ?? 'Board' })),
    [board.items, byId],
  );
  const rows = useMemo(() => purchaseRows(entries, byId), [entries, byId]);
  const timelineData = useMemo(
    () => timelineRows(rows, cohortCurve, pace, ownCurve),
    [rows, cohortCurve, pace, ownCurve],
  );
  const ownCurveAvailable = accountId != null && ownCurve.length > 0;

  useEffect(() => {
    onBoard({
      rows: timelineData,
      ownCurve: ownCurveAvailable,
      share: board.items.length > 0 ? board : null,
    });
  }, [timelineData, ownCurveAvailable, board, onBoard]);

  //The target defaults to the hero being built — a mirror match, not an invented opponent.
  useEffect(() => {
    if (targetId == null && heroId != null) setTargetId(heroId);
  }, [targetId, heroId]);

  const targetHpPerLevel = useMemo(() => {
    const upgrades = targetAssetsQuery.data?.standard_level_up_upgrades as Record<string, unknown> | undefined;
    const raw = upgrades?.['MODIFIER_VALUE_BASE_HEALTH_FROM_LEVEL'];
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
  }, [targetAssetsQuery.data]);

  const onPreset = (preset: StartFromPreset) => {
    setPresetKey(preset.key);
    loadBuild({ heroId: heroId ?? 0, patch: hero?.patch_id, items: preset.itemIds });
  };

  return (
    <div className="grid" style={{ gap: 22 }}>
      <div className="lab-cols">
        <div className="lab-col" style={{ gap: 14 }}>
          <LabBoard
            heroName={hero?.hero_name ?? null}
            layout={layout}
            byId={byId}
            souls={stats.spend.total}
            count={board.items.length}
            presets={presets}
            activePreset={presetKey}
            onPreset={onPreset}
            onRemove={draft.removeItem}
          />
          <LabShop
            catalog={catalog}
            picked={board.items}
            boardFull={board.items.length >= TOTAL_SLOTS}
            isPending={catalogQuery.isPending}
            isError={catalogQuery.isError}
            patch={patchQuery.data?.patch_id ?? null}
            onAdd={draft.addItem}
            onRemove={draft.removeItem}
          />
        </div>
        <aside className="lab-rail">
          <TargetPanel
            targets={heroes}
            icons={icons}
            picks={picks}
            targetId={targetId}
            onTarget={setTargetId}
            level={level}
            onLevel={setLevel}
            tier={tier}
            onTier={setTier}
            targetHpPerLevel={targetHpPerLevel}
            targetWeaponDps={null}
            yourStats={stats}
            yourAbilities={tierRows}
            spiritPower={mods.spiritPower}
          />
          <BoardStatPanels stats={stats} boardCount={board.items.length} />
        </aside>
      </div>

      {timeline}

      <div className="lab-two">
        <BoardAbilities rows={tierRows} mods={mods} slots={slots} tier={tier} />
        <OrderEditor
          order={order}
          onOrder={setOrder}
          abilities={abilities}
          served={ordersQuery.data?.orders}
          minMatches={ordersQuery.data?.min_matches ?? null}
          window={ordersQuery.data?.window ?? null}
        />
      </div>

      <CompareBoards
        a={stats}
        b={compareStats}
        options={presets}
        activeKey={compareKey}
        onPick={(p) => setCompareKey(p.key)}
      />
    </div>
  );
}
