//Pure formatters for the /meta/data-horizon freshness metadata (Component 11 —
//data-age honesty). The chip and the Lane Lab sample-window caption both derive
//their text here so the dates are ALWAYS computed from the served horizon, never
//hardcoded. No I/O — node-testable like the sibling lib modules.
//
//Honesty contract: every function returns null when its inputs are absent,
//null, or unparseable — the callers then render NOTHING (no fake date, no error
//state). A pre-C8 API without the route, a pre-data API serving nulls, and a
//failed fetch all collapse to the same "unknown → show nothing" outcome.
import type { DataHorizonResponse } from '../types/api';
import { shortDate } from './format';

//The lineage dataset key the backend stamps for the economy-curve Gold family
//(analytics.economy_curve_lineage — the only stamped dataset today).
export const ECONOMY_CURVE_DATASET = 'economy-curve';

//The date the site's stats run through — the global ingestion horizon
//(max_match_start_time) as "Jun 10, 2026". null when the horizon is unknown
//(missing/null/invalid), meaning: render no chip at all.
export function statsThroughDate(horizon: DataHorizonResponse | null | undefined): string | null {
  const formatted = shortDate(horizon?.max_match_start_time);
  return formatted === '' ? null : formatted;
}

//One dataset's match-start sample window as "Apr 1, 2026 – Jun 1, 2026" — the
//span the CURRENT Gold was computed from. Only a COMPLETE window renders (both
//window_lo and window_hi present and parseable); a missing entry or a half
//window yields null so the caption never shows an open-ended fabricated range.
export function datasetWindowLabel(
  horizon: DataHorizonResponse | null | undefined,
  dataset: string,
): string | null {
  const entry = horizon?.datasets?.find((d) => d.dataset === dataset);
  if (!entry) return null;
  const lo = shortDate(entry.window_lo);
  const hi = shortDate(entry.window_hi);
  if (lo === '' || hi === '') return null;
  return `${lo} – ${hi}`;
}
