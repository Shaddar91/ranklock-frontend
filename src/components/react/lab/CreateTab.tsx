//Build Lab Create tab (design Lab §7-§12 + §14): the roster chip row and the "start from" chips
//over C23's board, then the target panel, the computed stat cards, the ability-order editor, the
//A-vs-B compare and the souls timeline — all read off the one draft this tab owns.
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../../lib/apiClient';
import { computeStats, type BaseStats, type BuildInput } from '../../../lib/computeStats';
import { CURVE_WINDOW } from '../../../lib/labCalc';
import { indexCatalog, normalizeCatalog } from '../creator/buildModel';
import { useBuildDraft } from '../creator/useBuildDraft';
import BuildCreator from '../creator/BuildCreator';
import { useViewer } from '../player/usePlayer';
import { count } from '../../../lib/format';
import { buildModifiers, purchaseRows, tierAbilities, type BuildEntry } from './analyzeModel';
import {
  cohortCurvePoints,
  initialOrder,
  ownCurvePoints,
  startFromPresets,
  timelineRows,
  PRESET_SOURCE_NOTE,
  type StartFromPreset,
  type TimelinePace,
} from './createModel';
import { useHeroRoster } from './HeroBar';
import HeroChipRow from './HeroChipRow';
import TargetPanel from './TargetPanel';
import BoardStatPanels from './BoardStatPanels';
import OrderEditor from './OrderEditor';
import CompareBoards from './CompareBoards';
import SoulsTimeline from './SoulsTimeline';
import type {
  AbilityOrdersResponse,
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
const DAY_MS = 24 * 60 * 60_000;
const DEFAULT_LEVEL = 20;

export default function CreateTab({ initial }: { initial?: BuildInput | null }) {
  const draft = useBuildDraft();
  const { heroes } = useHeroRoster();
  const [level, setLevel] = useState(DEFAULT_LEVEL);
  const [tier, setTier] = useState(1);
  const [targetId, setTargetId] = useState<number | null>(null);
  const [order, setOrder] = useState<number[]>(initialOrder);
  const [pace, setPace] = useState<TimelinePace>('p50');
  const [compareKey, setCompareKey] = useState<string | null>(null);
  const [presetKey, setPresetKey] = useState<string | null>(null);

  const heroId = draft.heroId;
  const hero = heroes.find((h) => h.hero_id === heroId) ?? null;

  const rosterArt = useQuery<HeroSummary[]>({ queryKey: queryKeys.heroes(), queryFn: () => api.getHeroes() });
  const catalogQuery = useQuery<ItemModifier[]>({
    queryKey: queryKeys.itemModifiers(),
    queryFn: () => api.getItemModifiers(),
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
  const cohortCurve = useMemo(() => cohortCurvePoints(curveQuery.data?.points), [curveQuery.data]);
  const ownCurve = useMemo(() => ownCurvePoints(ownCurveQuery.data?.you ?? []), [ownCurveQuery.data]);

  const presets = useMemo(
    () => startFromPresets(buildStatsQuery.data, communityQuery.data?.[0], byId),
    [buildStatsQuery.data, communityQuery.data, byId],
  );

  const board = draft.build;
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
  const timeline = useMemo(
    () => timelineRows(rows, cohortCurve, pace, ownCurve),
    [rows, cohortCurve, pace, ownCurve],
  );

  //The target defaults to the hero being built — a mirror match, not an invented opponent.
  useEffect(() => {
    if (targetId == null && heroId != null) setTargetId(heroId);
  }, [targetId, heroId]);

  const ownCurveAvailable = accountId != null && ownCurve.length > 0;
  useEffect(() => {
    if (pace === 'you' && !ownCurveAvailable) setPace('p50');
  }, [pace, ownCurveAvailable]);

  const targetHpPerLevel = useMemo(() => {
    const upgrades = targetAssetsQuery.data?.standard_level_up_upgrades as Record<string, unknown> | undefined;
    const raw = upgrades?.['MODIFIER_VALUE_BASE_HEALTH_FROM_LEVEL'];
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
  }, [targetAssetsQuery.data]);

  const onPreset = (preset: StartFromPreset) => {
    setPresetKey(preset.key);
    draft.loadBuild({ heroId: heroId ?? 0, patch: hero?.patch_id, items: preset.itemIds });
  };

  //§7 then §8: the roster row and the start-from chips ride the creator's hero slot so they sit
  //above the board, where the design draws them.
  const boardHeader = (
    <div className="grid" style={{ gap: 12 }}>
      <HeroChipRow
        roster={rosterArt.data ?? []}
        playable={heroes}
        heroId={heroId}
        onHero={(id) => {
          setPresetKey(null);
          draft.selectHero(id, heroes.find((h) => h.hero_id === id)?.patch_id);
        }}
      />
      <div className="between" style={{ gap: 10, flexWrap: 'wrap' }}>
        <div className="flex" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="label-xs">Start from</span>
          {presets.map((p) => (
            <button
              key={p.key}
              type="button"
              className={'tab' + (presetKey === p.key ? ' on' : '')}
              style={{ padding: '4px 11px', fontSize: 12 }}
              title={p.hint}
              disabled={p.itemIds.length === 0}
              onClick={() => onPreset(p)}
            >
              {p.label}
              <span className="faint tnum" style={{ marginLeft: 6 }}>{p.itemIds.length}</span>
            </button>
          ))}
        </div>
        <span className="mono tnum amber-c" style={{ fontSize: 12.5 }}>
          {count(stats.spend.total)} souls · {board.items.length} of 12 slots
        </span>
      </div>
      <p className="faint" style={{ fontSize: 11.5, margin: 0 }}>{PRESET_SOURCE_NOTE}</p>
    </div>
  );

  return (
    <div className="grid" style={{ gap: 22 }}>
      <BuildCreator initial={initial} draft={draft} heroControl={boardHeader} />

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 22, alignItems: 'start' }}>
        <TargetPanel
          targets={heroes}
          icons={icons}
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
      </div>

      <OrderEditor
        order={order}
        onOrder={setOrder}
        abilities={abilities}
        served={ordersQuery.data?.orders}
        minMatches={ordersQuery.data?.min_matches ?? null}
        window={ordersQuery.data?.window ?? null}
      />

      <CompareBoards
        a={stats}
        b={compareStats}
        options={presets}
        activeKey={compareKey}
        onPick={(p) => setCompareKey(p.key)}
      />

      <SoulsTimeline
        rows={timeline}
        pace={pace}
        onPace={setPace}
        ownCurveAvailable={ownCurveAvailable}
        window={CURVE_WINDOW}
      />
    </div>
  );
}
