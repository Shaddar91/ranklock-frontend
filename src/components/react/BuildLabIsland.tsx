//Build Lab island — ONE island on /build-lab, three tabs (design Lab §2): Analyze · Create ·
//Community builds. Item modifiers are no longer a tab; every item tile carries the hover card.
//hero_base_stats is captured once per patch, so every tab empty-states instead of crashing.
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../lib/apiClient';
import QueryProvider from './QueryProvider';
import { EmptyState, GameIcon } from './ui/index';
import { count, DASH, fixed } from '../../lib/format';
import { statLabel } from '../../lib/statLabel';
import { groupBaseStats, statUnit } from '../../lib/baseStatGroups';
import { abilityOrderSequence, formatUpdated, isUpdatedThisPatch, SORT_MODES, type BuildSort } from '../../lib/buildMeta';
import BuildCreator from './creator/BuildCreator';
import type { HeroAbility, HeroBaseStats, TrimmedBuild } from '../../types/api';

type Tab = 'analyze' | 'create' | 'community';

//The lab's own roster is /heroes/base-stats, which never runs through releasedRoster(), so a
//hero there may have no page — this roster is the guard that keeps a "how to play" link off a 404.
export interface RosterSlug {
  hero_id: number;
  slug: string;
  hasGuide: boolean;
}

function fmtStat(v: number): string {
  return Number.isInteger(v) ? count(v) : fixed(v);
}

//A base-stats entry is a nested object carrying a numeric `value`, NOT a bare number; the
//shared `stats: Record<string, unknown>` masks that, so narrow it at the point of consumption.
type BaseStatValue = { value: number; display_stat_name?: string };

//Drop any row whose hero_name is empty BEFORE sort/map, so the <select> can never render a
//blank <option> if base-stats regresses. react-query dedupes the one fetch across both tabs.
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

function HowToPlayLink({ hero, roster }: { hero: HeroBaseStats | null; roster: RosterSlug[] }) {
  const row = hero ? roster.find((r) => r.hero_id === hero.hero_id) : undefined;
  if (!hero || !row?.hasGuide) return null;
  return (
    <a className="kicker" href={`/heroes/${row.slug}/guide/`}>
      How to play {hero.hero_name} →
    </a>
  );
}

//---- Analyze (design Lab §6 rail: the hero's served stats) -------------------

function AnalyzeTab({
  heroId,
  onHero,
  roster,
}: {
  heroId: number | null;
  onHero: (id: number) => void;
  roster: RosterSlug[];
}) {
  const { heroes, isPending, isError } = useHeroRoster();
  const active = heroes.find((h) => h.hero_id === heroId) ?? heroes[0] ?? null;

  if (isPending) return <p className="muted" style={{ padding: '14px 2px' }}>Loading base stats…</p>;
  if (isError || heroes.length === 0 || !active) {
    return (
      <EmptyState
        title="Base stats not available yet"
        message="Base stats are captured once per patch. This patch's capture hasn't landed yet."
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
        <div className="flex" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <HeroSelect heroes={heroes} activeId={active.hero_id} onHero={onHero} />
          <HowToPlayLink hero={active} roster={roster} />
        </div>
        <span className="mono faint" style={{ fontSize: 12 }}>
          patch {active.patch_id} · {active.source}
        </span>
      </div>
      {statEntries.length === 0 ? (
        <EmptyState title="No numeric base stats" message="No numeric starting stats were recorded for this hero this patch." icon="inbox" />
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
        {tab === 'analyze' && <AnalyzeTab heroId={heroId} onHero={setHeroId} roster={roster} />}
        {tab === 'create' && <BuildCreator />}
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
