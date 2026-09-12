//Build Lab island — ONE island on /build-lab, three tabs (design Lab §2): Analyze · Create ·
//Community builds. Item modifiers are no longer a tab; every item tile carries the hover card.
//hero_base_stats is captured once per patch, so every tab empty-states instead of crashing.
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../lib/apiClient';
import QueryProvider from './QueryProvider';
import { EmptyState, GameIcon } from './ui/index';
import { count, DASH } from '../../lib/format';
import { abilityOrderSequence, formatUpdated, isUpdatedThisPatch, SORT_MODES, type BuildSort } from '../../lib/buildMeta';
import BuildCreator from './creator/BuildCreator';
import AnalyzeTab from './lab/AnalyzeTab';
import { HeroSelect, HowToPlayLink, useHeroRoster, type RosterSlug } from './lab/HeroBar';
import type { BuildInput } from '../../lib/computeStats';
import type { HeroAbility, TrimmedBuild } from '../../types/api';

type Tab = 'analyze' | 'create' | 'community';

export type { RosterSlug };

//---- Community builds (design Lab §13) --------------------------------------
//GET /heroes/:id/builds. The server's recency-weighted sort is authoritative. NO win rate:
//our matches can't rank builds (items are anonymized).

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

function CommunityBuildsTab({
  heroId,
  onHero,
  roster,
}: {
  heroId: number | null;
  onHero: (id: number) => void;
  roster: RosterSlug[];
}) {
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
        title="Heroes not available yet"
        message="The hero roster is captured once per patch. Builds appear once this patch's capture lands."
        icon="inbox"
      />
    );
  }

  return (
    <div>
      <div className="between" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div className="flex" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <HeroSelect heroes={heroes} activeId={active.hero_id} onHero={onHero} />
          <HowToPlayLink hero={active} roster={roster} />
        </div>
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

const TABS: { value: Tab; label: string }[] = [
  { value: 'analyze', label: 'Analyze' },
  { value: 'create', label: 'Create' },
  { value: 'community', label: 'Community builds' },
];

function BuildLabInner({ roster }: { roster: RosterSlug[] }) {
  const [tab, setTab] = useState<Tab>('analyze');
  const [heroId, setHeroId] = useState<number | null>(null);
  const [handover, setHandover] = useState<BuildInput | null>(null);
  //A shared `#b1:` link carries a board — hand it to Create. Read AFTER hydration: server and
  //client must render the same first tab, and BuildCreator reads the fragment itself once mounted.
  useEffect(() => {
    if (window.location.hash.startsWith('#b1:')) setTab('create');
  }, []);
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
            onEditCopy={(build) => {
              setHandover(build);
              setTab('create');
            }}
          />
        )}
        {tab === 'create' && <BuildCreator initial={handover} />}
        {tab === 'community' && <CommunityBuildsTab heroId={heroId} onHero={setHeroId} roster={roster} />}
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
