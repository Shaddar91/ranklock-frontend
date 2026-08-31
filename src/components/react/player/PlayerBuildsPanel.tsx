//The player's published in-game builds (C1 author_id proxy). Empty-states for a player who never
//published and for a suppression-404'd account. Honest signals only — favorites + freshness, never
//a win-rate (our matches can't rank builds).
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, isNotFound, queryKeys } from '../../../lib/apiClient';
import { usePlayerBuilds } from './usePlayer';
import { EmptyState } from '../ui/index';
import { count, DASH } from '../../../lib/format';
import { formatUpdated, isUpdatedThisPatch } from '../../../lib/buildMeta';
import type { HeroBaseStats } from '../../../types/api';

export default function PlayerBuildsPanel({ id }: { id: number }) {
  const { data, isPending, isError, error } = usePlayerBuilds(id);
  //Resolve hero_id → name from the shared base-stats roster (react-query dedupes it site-wide).
  const rosterQ = useQuery<HeroBaseStats[]>({ queryKey: queryKeys.heroBaseStats(), queryFn: () => api.getHeroBaseStats() });
  const heroName = useMemo(() => {
    const m = new Map<number, string>();
    for (const h of rosterQ.data ?? []) m.set(h.hero_id, h.hero_name);
    return m;
  }, [rosterQ.data]);
  const patch = rosterQ.data?.[0]?.patch_id ?? null;
  const nowS = Math.floor(Date.now() / 1000);

  if (isPending) return <p className="muted" style={{ padding: '14px 2px' }}>Loading builds…</p>;
  if (isError) {
    return isNotFound(error) ? (
      <EmptyState title="No published builds" message="This player hasn't published any in-game builds." icon="book" />
    ) : (
      <EmptyState title="Couldn't load builds" message="The builds API is unreachable right now — try again shortly." icon="inbox" />
    );
  }
  const builds = data ?? [];
  if (builds.length === 0) {
    return <EmptyState title="No published builds" message="This player hasn't published any in-game builds." icon="book" />;
  }

  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: '4px 0', display: 'grid', gap: 10 }}>
      {builds.map((b, i) => {
        const fresh = isUpdatedThisPatch(b.last_updated_timestamp, patch);
        return (
          <li key={`${b.hero_build_id || b.name}-${i}`} className="tile" style={{ padding: '12px 14px' }}>
            <div className="between" style={{ gap: 10, alignItems: 'baseline', marginBottom: 6 }}>
              <span className="display" style={{ fontWeight: 600, color: 'var(--text)' }}>{b.name}</span>
              {fresh && (
                <span className="label-xs" style={{ padding: '2px 8px', borderRadius: 999, border: '1px solid var(--cyan)', color: 'var(--cyan)', whiteSpace: 'nowrap' }}>
                  Updated this patch
                </span>
              )}
            </div>
            <div className="between" style={{ gap: 12, fontSize: 12, flexWrap: 'wrap' }}>
              <span className="label-xs">{heroName.get(b.hero_id) ?? `Hero ${b.hero_id}`} · v{b.version}</span>
              <span className="faint mono">
                ♥ {b.num_weekly_favorites == null ? DASH : count(b.num_weekly_favorites)} weekly · {b.num_favorites == null ? DASH : count(b.num_favorites)} all-time · {formatUpdated(b.last_updated_timestamp, nowS)}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
