//"Stats through {date}" — the shared data-age chip (Component 11 / MASTER M2).
//One small island mounted in the page header of every stats surface (Heroes,
//Items, Patches, Lane Lab) so no page implies the numbers are live when the
//whole site is computed from a frozen ingestion window.
//
//Fed by GET /meta/data-horizon (max_match_start_time — the newest ingested
//match). Honesty contract: while the endpoint is absent (404 on a pre-deploy
//API), erroring, still loading, or serving a null horizon, this renders NOTHING
//— no fake date, no error state. The islands on a page share the singleton
//QueryClient, so Lane Lab's sample-window caption reuses this same fetch.
import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../lib/apiClient';
import { statsThroughDate } from '../../lib/dataHorizon';
import QueryProvider from './QueryProvider';
import { Chip } from './ui/index';

function DataAgeChipInner({ inline }: { inline?: boolean }) {
  const horizon = useQuery({
    queryKey: queryKeys.dataHorizon(),
    queryFn: api.getDataHorizon,
    //a pre-deploy 404 / offline API is an EXPECTED silent state — don't retry-hammer it.
    retry: false,
  });
  const date = statsThroughDate(horizon.data);
  if (date == null) return null;
  return (
    <div style={inline ? undefined : { marginTop: 8 }}>
      <Chip
        tone="neutral"
        title={`Newest match in the dataset started ${date}. Everything on this site is computed from matches up to that date.`}
      >
        Stats through {date}
      </Chip>
    </div>
  );
}

//`inline` drops the stacking margin so the chip can sit in a filter-bar row.
export default function DataAgeChip({ inline }: { inline?: boolean }) {
  return (
    <QueryProvider>
      <DataAgeChipInner inline={inline} />
    </QueryProvider>
  );
}
