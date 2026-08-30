//Percentile display for the /performance 0–1 fraction contract; null/NaN render the em-dash.
import { DASH } from './format';

//Below this many matches a bracket row is noise, not signal — flag or hide it.
export const MIN_PERCENTILE_SAMPLE = 10;

export function percentileOrdinal(fraction: number | null | undefined): string {
  if (fraction == null || Number.isNaN(fraction)) return DASH;
  const v = fraction >= 1 ? 100 : Math.min(99, Math.max(0, Math.round(fraction * 100)));
  const s = ['th', 'st', 'nd', 'rd'];
  const m = v % 100;
  return `${v}${s[(m - 20) % 10] ?? s[m] ?? s[0]}`;
}

export function topPercentFromFraction(fraction: number): number {
  return Math.max(1, Math.round(100 - fraction * 100));
}
