//Single source for which patch registry rows get a page; the sitemap imports the
//same predicate so the route family and the sitemap can never diverge.
import type { Patch } from '../types/api';

//Widening the floor or the notes_url requirement is a plan decision, not a code one.
const MINT_FLOOR = '2026-01-01';

export function mintablePatches(patches: Patch[]): Patch[] {
  return patches
    .filter((p) => p.released_at >= MINT_FLOOR && Boolean(p.notes_url))
    .sort((a, b) => b.released_at.localeCompare(a.released_at));
}
