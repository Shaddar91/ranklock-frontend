//The Lane Lab scorecard's model: the metrics it shows, and turning /lane-lab/percentiles'
//below_share into a cell's value chip. Pure — no fetching, no React.

export interface ScorecardMetric {
  //The API metric token (/lane-lab/percentiles?metric=, /players/{id}/economy-curve?metric=).
  key: string;
  label: string;
  //Deaths read backwards: a LOW value is the good one, so the chip's top/bottom edge flips.
  inverted?: boolean;
}

//The eleven the rank histograms carry (backend HISTOGRAM_METRICS), in the design's column order.
export const SCORECARD_METRICS: readonly ScorecardMetric[] = [
  { key: 'damage', label: 'Damage' },
  { key: 'deaths', label: 'Deaths', inverted: true },
  { key: 'kills', label: 'Kills' },
  { key: 'accuracy', label: 'Accuracy' },
  { key: 'last_hits', label: 'Last hits' },
  { key: 'souls', label: 'Souls' },
  { key: 'assists', label: 'Assists' },
  { key: 'damage_taken', label: 'Damage taken' },
  { key: 'player_healing', label: 'Healing' },
  { key: 'damage_mitigated', label: 'Mitigated' },
  { key: 'level', label: 'Level' },
];

//The curve's axis is a 180s bucket, so the design's 12:00 / 36:00 presets are buckets 4 and 12.
export const SCORECARD_BUCKETS = [4, 12] as const;
export const bucketClock = (bucket: number): string => `${bucket * 3}:00`;

export type ChipTone = 'weak' | 'mid' | 'strong';

export interface PercentileChip {
  //"top 18%" / "bottom 41%", plus "(fewer)"/"(more)" on deaths so the direction cannot be misread.
  label: string;
  //Standing after inversion, 0..100 — high is always good, whatever the metric.
  standing: number;
  tone: ChipTone;
}

//below_share is the share of the cohort strictly BELOW the value, which for a normal metric IS the
//standing; deaths invert to their complement. The chip names the nearer edge so a strong player
//reads "top 9%", never "bottom 91%".
export function percentileChip(belowShare: number, inverted = false): PercentileChip {
  const share = Math.round(Math.min(Math.max(belowShare, 0), 1) * 100);
  const standing = inverted ? 100 - share : share;
  const top = standing >= 50;
  const edge = top ? 100 - standing : standing;
  const suffix = inverted ? (top ? ' (fewer)' : ' (more)') : '';
  return {
    label: `${top ? 'top' : 'bottom'} ${edge}%${suffix}`,
    standing,
    tone: standing <= 25 ? 'weak' : standing >= 75 ? 'strong' : 'mid',
  };
}

//Mark a row's weakest cells so an eleven-wide row still points somewhere. Cells with no percentile
//(a metric with no data yet) are never marked — a blank is not a weakness. Ties break by position,
//so exactly `marks` cells light up.
export function weakestCells(standings: readonly (number | null)[], marks = 2): boolean[] {
  const ranked = standings
    .map((s, i) => ({ s, i }))
    .filter((c): c is { s: number; i: number } => c.s != null)
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .slice(0, marks)
    .map((c) => c.i);
  return standings.map((_, i) => ranked.includes(i));
}
