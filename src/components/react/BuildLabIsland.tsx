//Build Lab island — ONE island on /build-lab, three tabs (design Lab §2): Analyze · Create ·
//Community builds. Item modifiers are no longer a tab; every item tile carries the hover card.
//hero_base_stats is captured once per patch, so every tab empty-states instead of crashing.
import { useCallback, useEffect, useState } from 'react';
import QueryProvider from './QueryProvider';
import AnalyzeTab from './lab/AnalyzeTab';
import CreateTab from './lab/CreateTab';
import CommunityTab from './lab/CommunityTab';
import { type RosterSlug } from './lab/HeroBar';
import type { BuildInput } from '../../lib/computeStats';

type Tab = 'analyze' | 'create' | 'community';

export type { RosterSlug };

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
        {tab === 'analyze' && (
          <AnalyzeTab
            heroId={heroId}
            onHero={setHeroId}
            roster={roster}
            importBuildId={importId}
            onImportConsumed={onImportConsumed}
            onEditCopy={(build) => {
              setHandover(build);
              setTab('create');
            }}
          />
        )}
        {tab === 'create' && <CreateTab initial={handover} />}
        {tab === 'community' && (
          <CommunityTab heroId={heroId} onHero={setHeroId} roster={roster} onImport={onImport} />
        )}
      </div>
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
