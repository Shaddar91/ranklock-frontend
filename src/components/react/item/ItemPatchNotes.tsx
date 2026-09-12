//Item detail "Patch notes naming this item" — patches whose served summary names it. The
//match runs in the frontend over /patches; the page bakes its result so the rows are in the
//static HTML, and the same query refreshes it after hydration. The design's before → after
//win rate needs /patches/{id}/movers, which still answers 202 computing, so it renders cold.
import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../../lib/apiClient';
import { patchesNamingItem } from '../../../lib/itemDetail';
import { dayDate, DASH } from '../../../lib/format';
import QueryProvider from '../QueryProvider';
import EmptyState from '../ui/EmptyState';
import SectionHeader from '../ui/SectionHeader';
import type { Patch } from '../../../types/api';

export interface ItemPatchNotesProps {
  itemName: string;
  initialMatches: Patch[];
}

function PatchNotes({ itemName, initialMatches }: ItemPatchNotesProps) {
  const { data } = useQuery({
    queryKey: queryKeys.patches(),
    queryFn: () => api.getPatches(),
    staleTime: 60 * 60_000,
  });

  const rows = data ? patchesNamingItem(data, itemName) : initialMatches;

  return (
    <section id="patches">
      <SectionHeader kicker="What changed" title="Patch notes naming this item" />
      {rows.length === 0 ? (
        <EmptyState
          tone="cold"
          title="No patch names it"
          message={`No served patch summary mentions ${itemName}. This block fills in as notes land.`}
        />
      ) : (
        <div className="itemd-card patch-list">
          {rows.map((p) => (
            <div className="patch-row" key={p.patch_id}>
              <div>
                <div className="mono patch-id">{p.patch_id}</div>
                <div className="patch-date">{dayDate(p.released_at)}</div>
              </div>
              <div className="patch-note">
                {p.notes_summary}
                {p.notes_url && (
                  <>
                    {' '}
                    <a className="patch-link" href={p.notes_url} rel="nofollow noopener" target="_blank">
                      notes ↗
                    </a>
                  </>
                )}
              </div>
              <div className="patch-move">
                <span className="tnum">{DASH}</span>
                <span className="patch-move-sub">win rate before → after is computing</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function ItemPatchNotes(props: ItemPatchNotesProps) {
  return (
    <QueryProvider>
      <PatchNotes {...props} />
    </QueryProvider>
  );
}
