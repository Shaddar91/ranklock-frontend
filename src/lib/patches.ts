//Patch-domain pure helpers (node-testable, no React).
import type { Patch } from '../types/api';

//True when `patchId` is the OLDEST tracked patch — the one patch that
//structurally cannot have movers/deltas because no earlier patch exists to
//diff against (deep-audit B8; PatchHeroStat's delta_* are null there by
//construction). Order-independent — ISO released_at strings compare
//lexicographically, matching the island's own sort. Unknown/absent ids and an
//empty list → false.
export function isOldestPatch(patches: readonly Patch[], patchId: string | null | undefined): boolean {
  if (!patchId) return false;
  const selected = patches.find((p) => p.patch_id === patchId);
  if (!selected) return false;
  return !patches.some((p) => p.released_at.localeCompare(selected.released_at) < 0);
}
