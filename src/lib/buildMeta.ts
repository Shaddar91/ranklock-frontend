//Meta-tab ranking helpers: the honest sort (freshness over stale favorites), the "updated this
//patch" badge, and the ability-order sequence extracted from a build's upstream ability_order blob.
//No win-rate is invented anywhere — our matches can't rank builds (items anonymized).

export type BuildSort = 'weekly' | 'favorites';

export const SORT_MODES: { value: BuildSort; label: string; hint: string }[] = [
  { value: 'weekly', label: 'Trending', hint: 'Weekly favorites, recency-weighted — the server default' },
  { value: 'favorites', label: 'All-time', hint: 'Lifetime favorites (stale-biased — a 2024 build can top it)' },
];

export function sortLabel(sort: BuildSort): string {
  return SORT_MODES.find((s) => s.value === sort)?.label ?? sort;
}

//Parse a patch id / date string ("2026-08-22" or an ISO datetime) to epoch seconds; null if absent.
function patchStartSeconds(patchDate: string | null | undefined): number | null {
  if (!patchDate) return null;
  const ms = Date.parse(patchDate.length <= 10 ? `${patchDate}T00:00:00Z` : patchDate);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

/** True when a build's last update is at/after the current patch's start (the "updated this patch" badge). */
export function isUpdatedThisPatch(lastUpdatedTs: number | null | undefined, patchDate: string | null | undefined): boolean {
  const start = patchStartSeconds(patchDate);
  if (start == null || lastUpdatedTs == null) return false;
  return lastUpdatedTs >= start;
}

/** "3d ago" / "5w ago" / "Jun 2025" from an epoch-seconds timestamp, relative to `nowSeconds`. */
export function formatUpdated(lastUpdatedTs: number | null | undefined, nowSeconds: number): string {
  if (lastUpdatedTs == null) return '—';
  const days = Math.max(0, Math.floor((nowSeconds - lastUpdatedTs) / 86400));
  if (days === 0) return 'today';
  if (days < 7) return `${days}d ago`;
  if (days < 56) return `${Math.floor(days / 7)}w ago`;
  const d = new Date(lastUpdatedTs * 1000);
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

//The build's ability-order blob is upstream-shaped: `{ currency_changes: [{ ability_id, ... }] }`,
//one entry per point spent. The learn ORDER is the distinct ability ids in first-appearance order.
export function abilityOrderSequence(abilityOrder: unknown): number[] {
  const changes = (abilityOrder as { currency_changes?: unknown })?.currency_changes;
  if (!Array.isArray(changes)) return [];
  const seen = new Set<number>();
  const seq: number[] = [];
  for (const c of changes) {
    const id = (c as { ability_id?: unknown })?.ability_id;
    if (typeof id === 'number' && !seen.has(id)) {
      seen.add(id);
      seq.push(id);
    }
  }
  return seq;
}
