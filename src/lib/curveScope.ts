//Pure URL<->signature-curve mapping (SignatureCurvePanel): metric/view/league and the curve's
//OWN hero filter (narrows the comparison cohort — a SEPARATE axis from usePlayerScope's
//hero_id, which scopes /compare). DOM-free so it unit-tests; the hook is ./useCurveScope.
import { idOf } from './heroSlugs';

export const CURVE_METRICS = [
  { key: 'souls', label: 'Souls', noun: 'souls' },
  { key: 'last_hits', label: 'Last hits', noun: 'last hits' },
] as const;
export type CurveMetric = (typeof CURVE_METRICS)[number]['key'];

export const SIG_VIEWS = [
  { key: 'gap', label: 'Gap' },
  { key: 'totals', label: 'Totals' },
] as const;
export type SigView = (typeof SIG_VIEWS)[number]['key'];

export const DEFAULT_CURVE_METRIC: CurveMetric = 'souls';
export const DEFAULT_SIG_VIEW: SigView = 'gap';

export const CURVE_METRIC_PARAM = 'metric';
export const SIG_VIEW_PARAM = 'view';
export const CURVE_LEAGUE_PARAM = 'league';
export const CURVE_HERO_PARAM = 'curve_hero';
export const CURVE_SCOPE_CHANGE_EVENT = 'ranklock:curvescope';

export function metricFromParam(raw: string | null): CurveMetric {
  return raw === 'last_hits' ? 'last_hits' : DEFAULT_CURVE_METRIC;
}
export function metricToParam(m: CurveMetric): string | null {
  return m === DEFAULT_CURVE_METRIC ? null : m;
}

export function sigViewFromParam(raw: string | null): SigView {
  return raw === 'totals' ? 'totals' : DEFAULT_SIG_VIEW;
}
export function sigViewToParam(v: SigView): string | null {
  return v === DEFAULT_SIG_VIEW ? null : v;
}

//undefined = auto (chase tier); null = explicit "All ranks"; number = an explicit tier.
export function leagueFromParam(raw: string | null): number | null | undefined {
  if (raw == null) return undefined;
  if (raw === 'all') return null;
  const n = Number(raw);
  return Number.isInteger(n) ? n : undefined;
}
export function leagueToParam(band: number | null | undefined): string | null {
  if (band === undefined) return null;
  return band === null ? 'all' : String(band);
}

//A hero id or slug (Component 3's alias, mirrored client-side); unresolvable => unset.
export function curveHeroFromParam(raw: string | null): number | undefined {
  if (raw == null || raw === '') return undefined;
  const n = Number(raw);
  if (Number.isInteger(n) && n > 0) return n;
  return idOf(raw) ?? undefined;
}
export function curveHeroToParam(hero: number | undefined): string | null {
  return hero == null ? null : String(hero);
}
