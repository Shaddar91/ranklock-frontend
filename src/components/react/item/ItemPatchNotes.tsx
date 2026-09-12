//Item detail §6 — patches whose served summary names this item. The match runs in the
//frontend over /patches; the page bakes its result so the rows are in the static HTML,
//and the same query refreshes it after hydration. No match means no section.
import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../../lib/apiClient';
import { patchesNamingItem } from '../../../lib/itemDetail';
import { shortDate } from '../../../lib/format';
import QueryProvider from '../QueryProvider';
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
  if (rows.length === 0) return null;

  return (
    <section id="patches">
      <SectionHeader
        kicker="What changed"
        title={`Patch notes naming ${itemName}`}
        note="Matched by name against the served patch summaries"
      />
      <div className="panel patch-list">
        {rows.map((p) => (
          <div className="patch-row" key={p.patch_id}>
            <div>
              <div className="mono patch-id">{p.patch_id}</div>
              <div className="patch-date">{shortDate(p.released_at)}</div>
            </div>
            <div className="patch-note">
              {p.notes_summary}
              {p.notes_url && (
                <>
                  {' '}
                  <a href={p.notes_url} rel="nofollow noopener" target="_blank">
                    notes ↗
                  </a>
                </>
              )}
            </div>
            <div className="patch-move" />
          </div>
        ))}
      </div>
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
