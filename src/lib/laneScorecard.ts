//Which Lane Lab scorecard cells the bulk /lane-lab/scorecard read answers, and which a curve does.
import type { LaneScorecardResponse, PlayerCurvePoint } from '../types/api';

export interface BulkState {
  failed: boolean;
  settled: LaneScorecardResponse | null;
}

export function curveMetrics(
  bulk: BulkState,
  accountId: number,
  modeGames: number | null | undefined,
  all: readonly string[],
  windowed: readonly string[],
): readonly string[] {
  const leftOut =
    bulk.settled != null &&
    modeGames !== 0 &&
    !bulk.settled.accounts.some((a) => a.account_id === accountId);
  return bulk.failed || leftOut ? all : windowed;
}

export function bucketValue(points: readonly PlayerCurvePoint[], bucket: number): number | null {
  //An all-zero series is an unfolded array, not a measured zero.
  if (points.length > 0 && points.every((pt) => pt.value === 0)) return null;
  return points.find((pt) => pt.minute_bucket === bucket)?.value ?? null;
}
