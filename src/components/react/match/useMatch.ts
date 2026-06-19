//Match-island data hooks (C5). The match id is read from the live URL (the
//per-match shell is never prerendered per id — architecture §4); both the
//scoreboard island and the deferred inspector island use useMatch(id), so they
//share ONE /matches/:id fetch via the singleton query cache.
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../../lib/apiClient';
import { readNumericId } from '../../../lib/routeParams';

//undefined = not read yet (first render); null = absent/invalid; number = the id.
export function useMatchId(): number | null | undefined {
  const [id, setId] = useState<number | null | undefined>(undefined);
  useEffect(() => setId(readNumericId('matches')), []);
  return id;
}

export const useMatch = (id: number) =>
  useQuery({ queryKey: queryKeys.match(id), queryFn: () => api.getMatch(id), enabled: id > 0 });
