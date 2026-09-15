//How many games each roster player has in the selected match mode. Zero is the fact behind four
//empty panels: a player with no Ranked game has no Ranked line, cell, mark or bar to draw, and the
//page must say that instead of "pending". Shares its query key with the "You vs them" reads.
import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { api, queryKeys } from '../../../lib/apiClient';
import type { RosterSlot } from '../../../lib/laneRoster';

export type LaneMatchMode = 'Unranked' | 'Ranked';

export const otherMode = (m: LaneMatchMode): LaneMatchMode =>
  m === 'Ranked' ? 'Unranked' : 'Ranked';

//account_id -> games in this mode. Null while the count is in flight or the read failed, so a
//network error never renders as "no Ranked games".
export function usePlayerModeGames(
  roster: readonly RosterSlot[],
  matchMode: LaneMatchMode,
): Map<number, number | null> {
  const queries = useQueries({
    queries: roster.map((p) => ({
      queryKey: queryKeys.playerEconomy(p.account_id, 'Normal', matchMode),
      queryFn: () => api.getPlayerEconomy(p.account_id, 'Normal', matchMode),
      staleTime: 10 * 60 * 1000,
      retry: false,
    })),
  });

  const signature = queries.map((q) => `${q.status}:${q.data?.matches ?? ''}`).join(',');
  return useMemo(() => {
    const out = new Map<number, number | null>();
    roster.forEach((p, i) => {
      const data = queries[i]?.data;
      out.set(p.account_id, data ? data.matches : null);
    });
    return out;
  }, [roster.map((p) => p.account_id).join(','), matchMode, signature]);
}
