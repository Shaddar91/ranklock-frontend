//Build Lab §13 — the Hero Build community table mounted a second time (04 §4, one island, two
//mount points): all-ranks only, no bracket selector, plus the per-row Import into Analyze.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../../lib/apiClient';
import { signatureSlots } from '../../../lib/buildMeta';
import { EmptyState } from '../ui/index';
import { CommunityBuildsTable } from '../hero/CommunityBuilds';
import { HeroSelect, HowToPlayLink, useHeroRoster, type RosterSlug } from './HeroBar';
import type { CommunityBuild, HeroAbility } from '../../../types/api';

interface CommunityTabProps {
  heroId: number | null;
  onHero: (id: number) => void;
  roster: RosterSlug[];
  onImport: (buildId: number) => void;
}

export default function CommunityTab({ heroId, onHero, roster, onImport }: CommunityTabProps) {
  const { heroes, isPending: rosterPending, isError: rosterError } = useHeroRoster();
  const active = heroes.find((h) => h.hero_id === heroId) ?? heroes[0] ?? null;
  const hero = active?.hero_id ?? null;

  const buildsQuery = useQuery<CommunityBuild[]>({
    queryKey: queryKeys.heroBuilds(hero ?? -1, 'weekly', true),
    queryFn: () => api.getHeroBuilds(hero!, 'weekly', true),
    enabled: hero != null,
    retry: false,
  });
  const abilitiesQuery = useQuery<HeroAbility[]>({
    queryKey: queryKeys.heroAbilities(hero ?? -1),
    queryFn: () => api.getHeroAbilities(hero!),
    enabled: hero != null,
    retry: false,
  });

  const abilitySlots = useMemo(() => signatureSlots(abilitiesQuery.data), [abilitiesQuery.data]);
  const builds = buildsQuery.data ?? [];
  const nowSeconds = Math.floor(Date.now() / 1000);

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
    <div className="grid" style={{ gap: 18 }}>
      <div className="flex" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <HeroSelect heroes={heroes} activeId={active.hero_id} onHero={onHero} />
        <HowToPlayLink hero={active} roster={roster} />
      </div>
      {buildsQuery.isPending ? (
        <p className="muted" style={{ padding: '14px 2px' }}>Loading builds…</p>
      ) : buildsQuery.isError ? (
        <EmptyState
          title="Community builds unavailable"
          message="The published-build list could not be fetched. Analyze still imports a build by id."
          icon="book"
        />
      ) : (
        <CommunityBuildsTable
          heroId={active.hero_id}
          initialBuilds={builds}
          abilitySlots={abilitySlots}
          currentPatchId={active.patch_id ?? null}
          nowSeconds={nowSeconds}
          kicker={`Published in-game builds · ${active.hero_name}`}
          brackets={false}
          onImport={onImport}
        />
      )}
    </div>
  );
}
