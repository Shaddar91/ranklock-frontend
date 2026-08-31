import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../lib/apiClient';
import { liveStatusLine } from '../../lib/liveStatus';
import QueryProvider from './QueryProvider';

//Home "Live meta snapshot" status line: re-probes /health live in the browser (client:load +
//always-refetch) so a stale build-baked verdict never sticks, and defers wording to liveStatusLine
//(offline only on a genuine failure with no baked rows — a bad base-URL bake can't pin it on a live page).
function LiveStatusInner({ hasSnapshot }: { hasSnapshot: boolean }) {
  const { data, status, error } = useQuery({
    queryKey: queryKeys.health(),
    queryFn: () => api.getHealth(),
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const phase = status === 'success' ? 'ok' : status === 'error' ? 'error' : 'pending';
  const line = liveStatusLine({ phase, hasSnapshot, error, status: data?.status });
  return <p className={line.className}>{line.text}</p>;
}

export default function LiveStatusIsland({ hasSnapshot = false }: { hasSnapshot?: boolean }) {
  return (
    <QueryProvider>
      <LiveStatusInner hasSnapshot={hasSnapshot} />
    </QueryProvider>
  );
}
