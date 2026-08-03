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
import { count, fixed, kda } from './format';

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

//One radar axis: `you` and `cohort` are 0..1 positions. For compareRadarVsPlayer,
//`cohort` carries the picked player's normalized shape; for selfShapeAxes (own-shape
//default), `you` is value÷ceiling and `cohort` is unused (0) — the panel supplies any
//second series itself.
export interface RadarAxis {
  axis: string;
  you: number;
  cohort: number;
  served: boolean;
}

//---- shared radar primitives --------------------------------------------------

//The metric fields shared by CompareYou and CompareCohort that the radar reads — a
//structural subset both response sides satisfy, so one accessor serves both.
type CompareSide = Pick<
  CompareResponse['you'],
  'souls_per_min' | 'avg_last_hits' | 'avg_denies' | 'avg_kills' | 'avg_deaths' | 'avg_assists'
>;

const num = (v: number | null | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

//Six axes, each extracting one value from a compare side (you or cohort). KDA is
//(kills+assists)/max(1,deaths) via the shared format helper — the same KDA shown
//everywhere else, not a bespoke "skill score".
const COMPARE_AXES: { axis: string; pick: (s: CompareSide) => number | null }[] = [
  { axis: 'Souls/min', pick: (s) => num(s.souls_per_min) },
  { axis: 'Last-hits', pick: (s) => num(s.avg_last_hits) },
  { axis: 'Kills', pick: (s) => num(s.avg_kills) },
  { axis: 'Assists', pick: (s) => num(s.avg_assists) },
  { axis: 'Denies', pick: (s) => num(s.avg_denies) },
  { axis: 'KDA', pick: (s) => kda(s.avg_kills, s.avg_deaths, s.avg_assists) },
];

//---- self shape (own metrics, NO league baseline) ---------------------------

//Fixed per-axis display ceiling — the `you` value that fills the ring (1.0). Seeded
//from the live high-tier `you` distributions in the Component 1 evidence table so a
//strong player lands ~0.6–0.8 of the ring and none of the tested players clip to 1.0.
//These are DISPLAY anchors ONLY — no league/cohort data is read to build them.
const SELF_AXIS_MAX: Record<string, number> = {
  'Souls/min': 1600, //tested you souls/min peaks ~1172 → 0.73; headroom for elite farm
  'Last-hits': 200, //tested avg last-hits peaks ~149 → 0.75; 200/game is an elite lane
  Kills: 12, //tested avg kills peaks ~8.8 → 0.74; 12 kills/game is an aggressive ceiling
  Assists: 25, //tested avg assists peaks ~17.6 → 0.70; 25/game is a support-tier ceiling
  Denies: 7, //tested avg denies peaks ~4.7 → 0.67; denies seldom exceed 7/game
  KDA: 6, //KDA 6 is elite; strong players ~3.5–4.5 land ~0.6–0.75
};

//The DEFAULT radar: the player's OWN shape, standalone. Maps each present `you`
//per-game metric onto 0..1 via SELF_AXIS_MAX (value÷ceiling, clamped) with NO
//dependency on any cohort/league value — that framing was removed per the dictation,
//so this renders regardless of the (separately-tracked, possibly-empty) cohort MV. An
//axis is `served` whenever the player's own value is present. `cohort` is 0 (there is
//no baseline); the panel supplies the optional second series (own-mirror today, a
//picked player once the compare overlay ships).
export function selfShapeAxes(you: CompareSide): RadarAxis[] {
  return COMPARE_AXES.map(({ axis, pick }) => {
    const v = pick(you);
    if (v == null) return { axis, you: 0, cohort: 0, served: false };
    const max = SELF_AXIS_MAX[axis] ?? 1;
    return { axis, you: clamp(v / max, 0, 1), cohort: 0, served: true };
  });
}

//---- compare vs another player (both polygons via SELF_AXIS_MAX) ---------------

//Optional overlay: renders BOTH the viewer's own shape AND the picked player's
//shape on the same 6 axes, both normalized via SELF_AXIS_MAX so the two polygons
//are directly comparable (same scale, no league anchor). `you` fills the `you`
//series; `them` fills the `cohort` series (RadarChart's second polygon). An axis
//is `served` when the viewer's own value is present; the picked player's value may
//be absent (null → their polygon collapses to zero on that axis).
export function compareRadarVsPlayer(you: CompareSide, them: CompareSide): RadarAxis[] {
  return COMPARE_AXES.map(({ axis, pick }) => {
    const yv = pick(you);
    const tv = pick(them);
    const max = SELF_AXIS_MAX[axis] ?? 1;
    return {
      axis,
      you: yv != null ? clamp(yv / max, 0, 1) : 0,
      cohort: tv != null ? clamp(tv / max, 0, 1) : 0,
      served: yv != null,
    };
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
