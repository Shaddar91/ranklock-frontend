//The lab's shared hero control: the /heroes/base-stats roster, the <select>, and the guide link
//guarded by the released roster (base-stats can name a hero that has no page).
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../../lib/apiClient';
import type { HeroBaseStats } from '../../../types/api';

export interface RosterSlug {
  hero_id: number;
  slug: string;
  hasGuide: boolean;
}

export function useHeroRoster() {
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

export function HeroSelect({
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

export function HowToPlayLink({ hero, roster }: { hero: HeroBaseStats | null; roster: RosterSlug[] }) {
  const row = hero ? roster.find((r) => r.hero_id === hero.hero_id) : undefined;
  if (!hero || !row?.hasGuide) return null;
  return (
    <a className="kicker" href={`/heroes/${row.slug}/guide/`}>
      How to play {hero.hero_name} →
    </a>
  );
}
