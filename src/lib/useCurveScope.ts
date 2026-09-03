//React hook for curveScope.ts, URL-backed like useGameMode/useMatchMode: each field is its
//own useSyncExternalStore primitive snapshot, sharing one change event so any island re-reads.
import { useCallback, useSyncExternalStore } from 'react';
import {
  CURVE_HERO_PARAM,
  CURVE_LEAGUE_PARAM,
  CURVE_METRIC_PARAM,
  CURVE_SCOPE_CHANGE_EVENT,
  curveHeroFromParam,
  curveHeroToParam,
  DEFAULT_CURVE_METRIC,
  DEFAULT_SIG_VIEW,
  leagueFromParam,
  leagueToParam,
  metricFromParam,
  metricToParam,
  SIG_VIEW_PARAM,
  sigViewFromParam,
  sigViewToParam,
  type CurveMetric,
  type SigView,
} from './curveScope';

function search(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CURVE_SCOPE_CHANGE_EVENT, onChange);
  window.addEventListener('popstate', onChange);
  return () => {
    window.removeEventListener(CURVE_SCOPE_CHANGE_EVENT, onChange);
    window.removeEventListener('popstate', onChange);
  };
}

const getMetricSnapshot = (): CurveMetric => (typeof window === 'undefined' ? DEFAULT_CURVE_METRIC : metricFromParam(search().get(CURVE_METRIC_PARAM)));
const getViewSnapshot = (): SigView => (typeof window === 'undefined' ? DEFAULT_SIG_VIEW : sigViewFromParam(search().get(SIG_VIEW_PARAM)));
const getLeagueSnapshot = (): number | null | undefined => (typeof window === 'undefined' ? undefined : leagueFromParam(search().get(CURVE_LEAGUE_PARAM)));
const getHeroSnapshot = (): number | undefined => (typeof window === 'undefined' ? undefined : curveHeroFromParam(search().get(CURVE_HERO_PARAM)));
const getUndefined = (): undefined => undefined;

function setParam(param: string, value: string | null): void {
  const url = new URL(window.location.href);
  if (value === null) url.searchParams.delete(param);
  else url.searchParams.set(param, value);
  window.history.replaceState(window.history.state, '', url.toString());
  window.dispatchEvent(new Event(CURVE_SCOPE_CHANGE_EVENT));
}

export interface CurveScopeControl {
  metric: CurveMetric;
  view: SigView;
  band: number | null | undefined;
  hero: number | undefined;
  setMetric: (m: CurveMetric) => void;
  setView: (v: SigView) => void;
  setBand: (band: number | null | undefined) => void;
  setHero: (hero: number | undefined) => void;
}

export function useCurveScope(): CurveScopeControl {
  const metric = useSyncExternalStore(subscribe, getMetricSnapshot, () => DEFAULT_CURVE_METRIC);
  const view = useSyncExternalStore(subscribe, getViewSnapshot, () => DEFAULT_SIG_VIEW);
  const band = useSyncExternalStore(subscribe, getLeagueSnapshot, getUndefined);
  const hero = useSyncExternalStore(subscribe, getHeroSnapshot, getUndefined);

  const setMetric = useCallback((m: CurveMetric) => setParam(CURVE_METRIC_PARAM, metricToParam(m)), []);
  const setView = useCallback((v: SigView) => setParam(SIG_VIEW_PARAM, sigViewToParam(v)), []);
  const setBand = useCallback((b: number | null | undefined) => setParam(CURVE_LEAGUE_PARAM, leagueToParam(b)), []);
  const setHero = useCallback((h: number | undefined) => setParam(CURVE_HERO_PARAM, curveHeroToParam(h)), []);

  return { metric, view, band, hero, setMetric, setView, setBand, setHero };
}
