import { QueryClient } from '@tanstack/react-query';

//Singleton QueryClient shared across every island hydration root in a page.
//Defaults are tuned to the backend's 6h batch cadence (architecture §1,
//requirements §A.3): the API only changes data every ~6h, so aggressive
//refetching buys nothing. Per-user surfaces stay CSR and are never edge-cached.
let client: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (!client) {
    client = new QueryClient({
      defaultOptions: {
        queries: {
          //30 min is well inside the 6h freshness ceiling; individual queries
          //can override (e.g. a "live" surface) without changing the global default.
          staleTime: 1000 * 60 * 30,
          gcTime: 1000 * 60 * 60,
          refetchOnWindowFocus: false,
          //one retry covers the common transient ApiError(0 / 5xx); a 404/501 is
          //surfaced to the UI immediately as an empty state.
          retry: 1,
        },
      },
    });
  }
  return client;
}
