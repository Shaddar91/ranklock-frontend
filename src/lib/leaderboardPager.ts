//Leaderboard pager math (page↔offset/after_rank, ?page= parse, 5-wide window) — pure, unit-tested.
export const LEADERBOARD_PAGE_SIZE = 50;

//Backend refuses offset scans past MAX_OFFSET; deeper pages seek by ?after_rank=, bands cap at OFFSET_LAST_PAGE.
export const MAX_OFFSET = 100_000;
export const OFFSET_LAST_PAGE = Math.floor(MAX_OFFSET / LEADERBOARD_PAGE_SIZE) + 1;

export function pageFromSearch(search: string): number {
  const raw = new URLSearchParams(search).get('page');
  if (raw === null) return 1;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export function offsetFromPage(page: number): number {
  return (page - 1) * LEADERBOARD_PAGE_SIZE;
}

export function lastPage(total: number | null): number | null {
  if (total === null) return null;
  return Math.max(1, Math.ceil(total / LEADERBOARD_PAGE_SIZE));
}

//?after_rank=N returns ranks N+1..N+size, so a page's after_rank is its offset (keyset page == offset page).
export function afterRankForPage(page: number): number {
  return offsetFromPage(page);
}

export function usesKeyset(page: number): boolean {
  return offsetFromPage(page) > MAX_OFFSET;
}

export function pagerWindow(current: number, last: number): number[] {
  const preliminary = Math.max(1, current - 2);
  const end = Math.min(last, preliminary + 4);
  const start = Math.max(1, end - 4);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}
