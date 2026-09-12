//"Stats through {date}" — the shared data-age chip, on every stats surface so no page
//implies live numbers over a frozen ingestion window. Fed by GET /meta/data-horizon;
//an absent, erroring or null horizon renders NOTHING — never a fake date.
import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../lib/apiClient';
import { statsThroughDate, statsThroughDay } from '../../lib/dataHorizon';
import QueryProvider from './QueryProvider';
import { Chip } from './ui/index';

interface DataAgeChipProps {
  inline?: boolean;
  //`pill` = the filter-bar form; `through` = a build-time day that skips the client fetch.
  pill?: boolean;
  patch?: string | null;
  through?: string | null;
}

function DataAgeChipInner({ inline, pill, patch, through }: DataAgeChipProps) {
  const horizon = useQuery({
    queryKey: queryKeys.dataHorizon(),
    queryFn: api.getDataHorizon,
    //a pre-deploy 404 / offline API is an EXPECTED silent state — don't retry-hammer it.
    retry: false,
    enabled: through == null,
  });
  if (pill) {
    const day = through ?? statsThroughDay(horizon.data);
    if (day == null) return null;
    return (
      <span
        className="mono tnum freshpill"
        title={`Newest match in the dataset started ${day}. Everything on this site is computed from matches up to that date.`}
      >
        <i className="freshpill-dot" aria-hidden="true" />
        Through {day}
        {patch ? ` · patch ${patch}` : ''}
      </span>
    );
  }
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
export default function DataAgeChip(props: DataAgeChipProps) {
  return (
    <QueryProvider>
      <DataAgeChipInner {...props} />
    </QueryProvider>
  );
}
