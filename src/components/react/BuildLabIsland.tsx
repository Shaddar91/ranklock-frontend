//Build Lab island — ONE island on /build-lab, three tabs (design Lab §2): Analyze · Create ·
//Community builds. The hero row, the Share link and the souls timeline are page-level in the
//design, so they live here and the tabs feed them; hero_base_stats is captured once per patch,
//so every tab empty-states instead of crashing.
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../lib/apiClient';
import { CURVE_WINDOW } from '../../lib/labCalc';
import QueryProvider from './QueryProvider';
import AnalyzeTab from './lab/AnalyzeTab';
import CreateTab from './lab/CreateTab';
import CommunityTab from './lab/CommunityTab';
import LabHeroRow from './lab/LabHeroRow';
import LabShareLink from './lab/LabShareLink';
import SoulsTimeline from './lab/SoulsTimeline';
import { useHeroRoster, type RosterSlug } from './lab/HeroBar';
import type { TimelinePace, TimelineRow } from './lab/createModel';
import type { BuildInput } from '../../lib/computeStats';
import type { HeroSummary } from '../../types/api';

type Tab = 'analyze' | 'create' | 'community';

export type { RosterSlug };

//What a tab hands the page-level blocks: the timeline's rows and the board the Share link copies.
export interface LabBoard {
  rows: TimelineRow[];
  ownCurve: boolean;
  share: BuildInput | null;
}

const EMPTY_BOARD: LabBoard = { rows: [], ownCurve: false, share: null };

const TABS: { value: Tab; label: string }[] = [
  { value: 'analyze', label: 'Analyze' },
  { value: 'create', label: 'Create' },
  { value: 'community', label: 'Community builds' },
];

function BuildLabInner({ roster }: { roster: RosterSlug[] }) {
  const [tab, setTab] = useState<Tab>('analyze');
  const [heroId, setHeroId] = useState<number | null>(null);
  const [handover, setHandover] = useState<BuildInput | null>(null);
  const [importId, setImportId] = useState<number | null>(null);
  const [pace, setPace] = useState<TimelinePace>('p50');
  const [board, setBoard] = useState<LabBoard>(EMPTY_BOARD);

  const { heroes } = useHeroRoster();
  const rosterArt = useQuery<HeroSummary[]>({ queryKey: queryKeys.heroes(), queryFn: () => api.getHeroes() });

  //A shared `#b1:` link carries a board — hand it to Create. Read AFTER hydration: server and
  //client must render the same first tab, and the creator reads the fragment itself once mounted.
  useEffect(() => {
    if (window.location.hash.startsWith('#b1:')) setTab('create');
  }, []);
  //Lab §13 Import: the row hands its build id to Analyze, which loads it through getBuildById.
  const onImport = useCallback((buildId: number) => {
    setImportId(buildId);
    setTab('analyze');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);
  const onImportConsumed = useCallback(() => setImportId(null), []);

  useEffect(() => {
    if (pace === 'you' && !board.ownCurve) setPace('p50');
  }, [pace, board.ownCurve]);

  //The lab opens on the busiest hero, as the design opens on Haze — base-stats order is alphabetic.
  useEffect(() => {
    if (heroId != null) return;
    const playable = new Set(heroes.map((h) => h.hero_id));
    const top = [...(rosterArt.data ?? [])].filter((h) => playable.has(h.hero_id)).sort((a, b) => b.picks - a.picks)[0];
    if (top) setHeroId(top.hero_id);
  }, [heroId, heroes, rosterArt.data]);

  //Portal only after mount: the head's slot is server-rendered, so hydration must not touch it.
  const [shareSlot, setShareSlot] = useState<HTMLElement | null>(null);
  useEffect(() => setShareSlot(document.getElementById('lab-share')), []);

  const timeline = (
    <SoulsTimeline
      rows={board.rows}
      pace={pace}
      onPace={setPace}
      ownCurveAvailable={board.ownCurve}
      window={CURVE_WINDOW}
    />
  );

  return (
    <div className="grid" style={{ gap: 22 }}>
      {shareSlot && createPortal(<LabShareLink build={board.share} />, shareSlot)}

      <div className="lab-tabs" role="tablist" aria-label="Build Lab">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            className={'lab-tab' + (tab === t.value ? ' on' : '')}
            onClick={() => setTab(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <LabHeroRow
        roster={rosterArt.data ?? []}
        playable={heroes}
        heroId={heroId}
        onHero={setHeroId}
      />

      {tab === 'analyze' && (
        <AnalyzeTab
          heroId={heroId}
          onHero={setHeroId}
          pace={pace}
          onBoard={setBoard}
          timeline={timeline}
          importBuildId={importId}
          onImportConsumed={onImportConsumed}
          onEditCopy={(build) => {
            setHandover(build);
            setTab('create');
          }}
        />
      )}
      {tab === 'create' && (
        <CreateTab
          initial={handover}
          heroId={heroId}
          onHero={setHeroId}
          pace={pace}
          onBoard={setBoard}
          timeline={timeline}
        />
      )}
      {tab === 'community' && (
        <CommunityTab heroId={heroId} roster={roster} onImport={onImport} timeline={timeline} />
      )}
    </div>
  );
}

export default function BuildLabIsland({ roster }: { roster: RosterSlug[] }) {
  return (
    <QueryProvider>
      <BuildLabInner roster={roster} />
    </QueryProvider>
  );
}
