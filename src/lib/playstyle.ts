//============================================================================
//Playstyle + categorized-performance derivations (C5).
//
//The player dashboard's centerpiece surfaces — the playstyle radar and the
//Combat/Economy/Laning/Misc panels — are PROJECTIONS of two documented analytics
//endpoints, NOT separate datasets:
//
//  • GET /players/:id/improve  → per-metric user_avg vs cohort percentile band
//    (net_worth, last_hits, denies, kills, deaths, assists, damage_dealt).
//  • GET /players/:id/compare  → you-vs-cohort aggregates + efficiency ratios.
//
//These are the "rich-tier" surfaces that empty-state until the analytics pipeline
//serves them (build-ahead, requirements §8.1). Everything here is a PURE function
//of the served response so the island stays declarative and the math is testable
//in isolation. No stat is invented: the radar is an honest percentile-band
//position of the player's own measured averages against the served cohort, never
//a fabricated "skill score".
//============================================================================
import type { CompareResponse, ImproveResponse, MetricComparison } from '../types/api';
import { count, fixed } from './format';

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

//---- shared row model -------------------------------------------------------

//One line in a categorized panel: the player's value, the signed delta vs the
//cohort p50, and the cohort value itself (shown in compare mode). `better` flags
//whether higher is good (drives Delta's color/glyph). `served` lets a panel grey
//a single line that has no data without dropping the whole panel.
export interface StatRow {
  label: string;
  value: string;
  unit?: string;
  delta: number | null;
  better: boolean;
  cohort: string | null;
  served: boolean;
}

//One radar axis: `you` and `cohort` are 0..1 where 0.5 == the cohort p50 baseline.
export interface RadarAxis {
  axis: string;
  you: number;
  cohort: number;
  served: boolean;
}

//---- radar ------------------------------------------------------------------

//Position a metric on a 0..1 axis using the served percentile band: 0.5 sits on
//the cohort p50; the p25↔p50 and p50↔p75 spreads scale the half below/above so a
//player exactly at the cohort median reads as the baseline hexagon. Falls back to
//delta_vs_p50_pct when the band is absent, then to the baseline (0.5). For
//lower-is-better metrics the position is mirrored so "fewer deaths" bulges out.
function axisPosition(m: MetricComparison, higherBetter: boolean): number {
  const { user_avg, cohort_p25, cohort_p50, cohort_p75, delta_vs_p50_pct } = m;
  let pos: number;
  if (cohort_p50 != null && cohort_p50 !== 0) {
    if (user_avg >= cohort_p50) {
      const span = (cohort_p75 ?? cohort_p50 * 1.25) - cohort_p50;
      pos = 0.5 + (span > 0 ? 0.5 * clamp((user_avg - cohort_p50) / span, 0, 1) : 0);
    } else {
      const span = cohort_p50 - (cohort_p25 ?? cohort_p50 * 0.75);
      pos = 0.5 - (span > 0 ? 0.5 * clamp((cohort_p50 - user_avg) / span, 0, 1) : 0);
    }
  } else if (delta_vs_p50_pct != null) {
    pos = 0.5 + clamp(delta_vs_p50_pct / 100, -0.45, 0.45);
  } else {
    pos = 0.5;
  }
  return higherBetter ? pos : 1 - pos;
}

//Six radar axes mapped from the improve metrics. A missing metric yields an axis
//pinned to the 0.5 baseline and flagged `served:false` so the UI can note partial
//coverage instead of implying a real measurement.
const RADAR_AXES: { axis: string; key: keyof ImproveResponse['metrics']; higherBetter: boolean }[] = [
  { axis: 'Damage', key: 'damage_dealt', higherBetter: true },
  { axis: 'Farming', key: 'net_worth', higherBetter: true },
  { axis: 'Last-hits', key: 'last_hits', higherBetter: true },
  { axis: 'Combat', key: 'kills', higherBetter: true },
  { axis: 'Survival', key: 'deaths', higherBetter: false },
  { axis: 'Teamplay', key: 'assists', higherBetter: true },
];

export function deriveRadar(improve: ImproveResponse): RadarAxis[] {
  return RADAR_AXES.map(({ axis, key, higherBetter }) => {
    const m = improve.metrics?.[key];
    if (!m) return { axis, you: 0.5, cohort: 0.5, served: false };
    return { axis, you: clamp(axisPosition(m, higherBetter), 0, 1), cohort: 0.5, served: true };
  });
}

//---- categorized panels (from improve) --------------------------------------

type Fmt = (n: number) => string;
const fInt: Fmt = (n) => count(n);
const fNum: Fmt = (n) => fixed(n, 1);

//Turn one improve metric into a StatRow. The delta is the served delta_vs_p50_pct
//(already a signed %); the cohort column is the served p50.
function improveRow(label: string, m: MetricComparison | undefined, better: boolean, fmt: Fmt, unit?: string): StatRow {
  if (!m) return { label, value: '—', unit, delta: null, better, cohort: null, served: false };
  return {
    label,
    value: fmt(m.user_avg),
    unit,
    delta: m.delta_vs_p50_pct,
    better,
    cohort: m.cohort_p50 != null ? fmt(m.cohort_p50) : null,
    served: true,
  };
}

export function combatRows(improve: ImproveResponse): StatRow[] {
  const m = improve.metrics ?? ({} as ImproveResponse['metrics']);
  return [
    improveRow('Kills', m.kills, true, fNum),
    improveRow('Deaths', m.deaths, false, fNum),
    improveRow('Assists', m.assists, true, fNum),
    improveRow('Damage dealt', m.damage_dealt, true, fInt),
  ];
}

export function economyRows(improve: ImproveResponse): StatRow[] {
  const m = improve.metrics ?? ({} as ImproveResponse['metrics']);
  return [
    improveRow('Net worth', m.net_worth, true, fInt),
    improveRow('Last hits', m.last_hits, true, fNum),
    improveRow('Denies', m.denies, true, fNum),
  ];
}

//---- categorized panels (from compare) --------------------------------------

//Build a you-vs-cohort StatRow straight from the compare aggregates. The delta is
//computed from the two served values (honest % difference), not invented.
function compareRow(label: string, you: number | null, cohort: number | null, better: boolean, fmt: Fmt, unit?: string): StatRow {
  if (you == null) return { label, value: '—', unit, delta: null, better, cohort: cohort != null ? fmt(cohort) : null, served: false };
  const delta = cohort != null && cohort !== 0 ? ((you - cohort) / cohort) * 100 : null;
  return { label, value: fmt(you), unit, delta, better, cohort: cohort != null ? fmt(cohort) : null, served: true };
}

export function laningRows(cmp: CompareResponse): StatRow[] {
  return [
    compareRow('Souls / min', cmp.you.souls_per_min, cmp.cohort.souls_per_min, true, fInt),
    compareRow('Last hits / min', cmp.you.last_hits_per_min, cmp.cohort.last_hits_per_min, true, fNum),
    compareRow('Avg last hits', cmp.you.avg_last_hits, cmp.cohort.avg_last_hits, true, fInt),
    compareRow('Avg denies', cmp.you.avg_denies, cmp.cohort.avg_denies, true, fNum),
  ];
}

//Efficiency ratios are served pre-computed (you ÷ cohort). 1.0 == parity, so the
//delta is (ratio − 1)·100 and the cohort column is the 1.00 baseline.
export function efficiencyRows(cmp: CompareResponse): StatRow[] {
  const e = cmp.efficiency;
  const ratioRow = (label: string, r: number | null): StatRow =>
    r == null
      ? { label, value: '—', delta: null, better: true, cohort: '1.00', served: false }
      : { label, value: fixed(r, 2) + '×', delta: (r - 1) * 100, better: true, cohort: '1.00×', served: true };
  return [
    ratioRow('Souls/min ratio', e.souls_per_min_ratio),
    ratioRow('Net-worth ratio', e.net_worth_ratio),
    ratioRow('Last-hits/min ratio', e.last_hits_per_min_ratio),
    ratioRow('KDA ratio', e.kda_ratio),
  ];
}
