import { useQuery } from '@tanstack/react-query';
import { api, queryKeys, isComputing, isDisabled } from '../../lib/apiClient';
import QueryProvider from './QueryProvider';

//Hydrated demo island (used on the home page with `client:load`). It proves the
//React + TanStack Query + typed apiClient pipeline end-to-end and is build-ahead
//safe: if the API is unreachable (nothing is live yet — §8.1) it empty-states
//instead of crashing the page.
function LiveStatusInner() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.health(),
    queryFn: () => api.getHealth(),
  });

  if (isPending) return <p className="muted">Checking API…</p>;
  if (isError) {
    const note = isDisabled(error) ? 'analytics disabled' : isComputing(error) ? 'computing' : 'offline';
    return <p className="muted">API unavailable ({note}) — the site renders without it.</p>;
  }
  return <p className="ok">API reachable — status: {data.status}</p>;
}

export default function LiveStatusIsland() {
  return (
    <QueryProvider>
      <LiveStatusInner />
    </QueryProvider>
  );
}
