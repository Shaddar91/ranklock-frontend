//============================================================================
//Read a resource id from the live URL on the client (C5).
//
//The per-user (/players/:id) and per-match (/matches/:id) pages are CSR shells
//(architecture §4, mental-model #3: "users are data, not pages"). The SAME
//prerendered static shell serves EVERY id, so the island reads the id from the
//path at runtime — there is no build-time param. Tolerates an optional locale
//prefix (C7 ships /:locale/… variants, e.g. /fr/players/123) and any trailing
//query/hash. Returns null when the segment is absent or not a positive number so
//the caller renders a graceful "no id" state instead of fetching NaN.
//============================================================================
export function readNumericId(resource: 'players' | 'matches'): number | null {
  if (typeof window === 'undefined') return null;
  const m = window.location.pathname.match(new RegExp(`/${resource}/([^/?#]+)`));
  if (!m || m[1] == null) return null;
  const raw = decodeURIComponent(m[1]);
  const n = Number(raw);
  //account_id / match_id are positive integers well within Number's safe range.
  return Number.isFinite(n) && Number.isInteger(n) && n > 0 ? n : null;
}
