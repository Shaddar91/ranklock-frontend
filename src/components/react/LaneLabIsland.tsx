//============================================================================
//Lane Lab island — the signature per-minute economy / soul-curve coaching
//surface (brief §7B). ONE hydration root mounted on /lane-lab. Wires the
//rich-analytics-tier lane endpoints the backend serves from the additive
//counting-histogram Gold (deadlock-backend/src/handlers/lane_lab.rs):
//
//  • GET /lane-lab/economy-curve?band=&metric=souls  — the cohort soul curve for
//    the selected rank band, plus a second call for the band ONE TIER UP (the
//    "Oracle" cohort you're chasing) overlaid as the dashed comparison line.
//  • GET /lane-lab/early-econ-verdict?band=           — the 9-minute early-econ
//    → win-rate verdict ("does your 9-minute economy predict the win?").
//
//`band` is a rank tier (badge/10, 0..11 — exactly lib/ranks RANKS index), so the
//band selector is the shared rank-bracket filter. band omitted ('All') aggregates
//every band; the top tier (Eternus) and 'All' have no higher cohort to overlay.
//
//Build-ahead contract (requirements §8.1): these endpoints 501 (RICH_ANALYTICS
//disabled) / 202 (lane producers haven't run) before the data is live. Every
//branch EMPTY-STATES with the "coming soon" copy — it never white-screens.
//============================================================================
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, isComputing, isDisabled, queryKeys } from '../../lib/apiClient';
import QueryProvider from './QueryProvider';
import { BracketFilter, type BracketValue, EmptyState } from './ui/index';
import EconomyCurve, { type EconomyPoint } from './charts/EconomyCurve';
import { getRank } from '../../lib/ranks';
import { count, pct } from '../../lib/format';
import type { LaneCurveResponse } from '../../types/api';

//The signature curve metric. The endpoint also serves last_hits/kills/… but the
//soul curve is the Lane Lab headline (brief §7B).
const METRIC = 'souls';

//souls value_bucket encoding (012 migration COMMENT): souls = net_worth/1000, so
//a p50 value_bucket maps back to real souls by ×1000.
const SOULS_PER_BUCKET = 1000;

//The highest rank band (Eternus = badge 110..116 → band 11). Nothing sits above
//it, so it (and 'All') render without a one-tier-up cohort overlay.
const TOP_BAND = 11;

//A BracketValue → the API's `band` param (undefined for 'all' so the call omits
//the param and the backend aggregates every band).
const bandParam = (v: BracketValue): number | undefined => (v === 'all' ? undefined : v);

//The cohort one tier up, or null when there is none ('all' or the top band).
const cohortBand = (v: BracketValue): number | null =>
  typeof v === 'number' && v < TOP_BAND ? v + 1 : null;

//Translate a build-ahead query error into the right "coming soon" empty-state
//copy (mirrors AnalyticsPanels.buildAheadMessage, re-stated so the island is
//self-contained). 501/202 are the EXPECTED pre-data states, not failures.
function laneAheadMessage(error: unknown): string {
  if (isDisabled(error)) return 'Coming soon — the rich-analytics tier is currently disabled on the API.';
  if (isComputing(error)) return 'Computing now — the lane curves are being generated. Check back shortly.';
  return 'The per-minute economy curve comes online with the lane-analytics pipeline.';
}

//Merge the selected-band curve ("you") and the one-tier-up curve ("cohort") into
//the EconomyCurve point shape, keyed by minute. p50 is the cohort MEDIAN souls at
//that minute (×1000 from the bucket). A minute with no cohort sample → NaN, which
//Recharts renders as a gap rather than a fabricated point.
function toEconPoints(
  you: LaneCurveResponse | undefined,
  cohort: LaneCurveResponse | undefined,
): EconomyPoint[] {
  const cohortByMinute = new Map<number, number>();
  for (const p of cohort?.points ?? []) {
    if (p.p50 != null) cohortByMinute.set(p.minute_bucket, p.p50 * SOULS_PER_BUCKET);
  }
  return (you?.points ?? [])
    .filter((p) => p.p50 != null)
    .map((p) => ({
      min: Math.round(p.t_seconds / 60),
      you: (p.p50 as number) * SOULS_PER_BUCKET,
      cohort: cohortByMinute.get(p.minute_bucket) ?? NaN,
    }));
}

//Peak per-minute sample size across the curve — shown as "n =" so a reader can
//weigh a thin band's curve against a well-sampled one.
function peakSamples(curve: LaneCurveResponse | undefined): number {
  return (curve?.points ?? []).reduce((m, p) => Math.max(m, p.sample_players), 0);
}

//---- the 9-min early-econ verdict bars --------------------------------------

function VerdictPanel({ band }: { band: BracketValue }) {
  const verdict = useQuery({
    queryKey: queryKeys.laneEarlyEconVerdict({ band: bandParam(band) ?? 'all' }),
    queryFn: () => api.getLaneEarlyEconVerdict({ band: bandParam(band) }),
    retry: false,
  });

  const buckets = useMemo(
    () => [...(verdict.data?.buckets ?? [])].sort((a, b) => a.souls_bucket_9min - b.souls_bucket_9min),
    [verdict.data],
  );

  return (
    <div className="panel" style={{ padding: '16px 18px' }}>
      <div className="kicker" style={{ marginBottom: 4 }}>
        9-minute verdict
      </div>
      <h2 className="h-sec" style={{ fontSize: 16, marginBottom: 4 }}>
        Does your 9-minute economy predict the win?
      </h2>
      <p className="muted" style={{ fontSize: 12.5, margin: '0 0 14px', lineHeight: 1.45 }}>
        Win rate by net worth at the 9-minute mark — find your souls bar and read how often that early lead converts.
      </p>
      {verdict.isPending ? (
        <p className="muted" style={{ padding: '14px 2px' }}>Loading the early-econ verdict…</p>
      ) : verdict.isError || buckets.length === 0 ? (
        <EmptyState title="Early-econ verdict not served yet" message={laneAheadMessage(verdict.error)} icon="coins" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {buckets.map((b) => {
            const winPct = b.win_rate * 100;
            const above = winPct >= 50;
            //de-emphasize thin buckets so a 3-game outlier doesn't read as signal.
            const thin = b.games < 50;
            return (
              <div key={b.souls_bucket_9min} className="flex" style={{ alignItems: 'center', gap: 10, opacity: thin ? 0.6 : 1 }}>
                <span className="mono" style={{ width: 78, flex: 'none', fontSize: 12, color: 'var(--text-2)' }}>
                  {count(b.souls_floor / 1000)}k–{count(b.souls_floor / 1000 + 1)}k
                </span>
                <div style={{ flex: 1, height: 16, background: 'var(--border-soft)', borderRadius: 4, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.max(2, Math.min(100, winPct))}%`,
                      height: '100%',
                      background: above ? 'var(--win)' : 'var(--loss)',
                      borderRadius: 4,
                    }}
                  />
                </div>
                <span className="mono tnum" style={{ width: 52, flex: 'none', textAlign: 'right', fontSize: 12, color: above ? 'var(--win)' : 'var(--loss)' }}>
                  {pct(winPct)}
                </span>
                <span className="mono faint" style={{ width: 64, flex: 'none', textAlign: 'right', fontSize: 11 }}>
                  n={count(b.games)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

//---- the per-minute soul curve ----------------------------------------------

function LaneLabInner() {
  const [band, setBand] = useState<BracketValue>(7); //Archon — its one-tier-up cohort is Oracle.

  const param = bandParam(band);
  const cohort = cohortBand(band);

  const youCurve = useQuery({
    queryKey: queryKeys.laneEconomyCurve({ band: param ?? 'all', metric: METRIC }),
    queryFn: () => api.getLaneEconomyCurve({ band: param, metric: METRIC }),
    retry: false,
  });
  const cohortCurve = useQuery({
    queryKey: queryKeys.laneEconomyCurve({ band: cohort ?? 'none', metric: METRIC }),
    queryFn: () => api.getLaneEconomyCurve({ band: cohort ?? undefined, metric: METRIC }),
    retry: false,
    enabled: cohort != null,
  });

  const points = useMemo(
    () => toEconPoints(youCurve.data, cohortCurve.data),
    [youCurve.data, cohortCurve.data],
  );

  const bandLabel = band === 'all' ? 'All ranks' : getRank(band).name;
  const cohortLabel = cohort != null ? getRank(cohort).name : null;
  const n = peakSamples(youCurve.data);

  return (
    <div className="grid" style={{ gap: 18 }}>
      {/* Band selector + the cohort-context line */}
      <div className="between" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        <div>
          <div className="label-xs" style={{ marginBottom: 6 }}>Rank band</div>
          <BracketFilter value={band} onChange={setBand} />
        </div>
        <p className="muted" style={{ fontSize: 12.5, margin: 0, maxWidth: 320, textAlign: 'right' }}>
          {cohortLabel
            ? <>Showing <b className="cyan-c">{bandLabel}</b> souls vs <b style={{ color: 'var(--muted)' }}>{cohortLabel}</b> one tier up.</>
            : <>Showing <b className="cyan-c">{bandLabel}</b> — pick a specific tier to overlay the rank one tier up.</>}
        </p>
      </div>

      {/* The signature soul curve */}
      <div className="brass-frame" style={{ padding: '18px 20px' }}>
        <span className="corner tl" />
        <span className="corner br" />
        <div className="between" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div className="kicker" style={{ marginBottom: 4 }}>Signature · soul curve vs the rank you&rsquo;re chasing</div>
            <h2 className="h-sec" style={{ fontSize: 17 }}>Souls per minute</h2>
          </div>
          {n > 0 && (
            <span className="mono faint" style={{ fontSize: 12 }}>n = {count(n)} players sampled</span>
          )}
        </div>
        {youCurve.isPending ? (
          <p className="muted" style={{ padding: '24px 2px' }}>Loading the soul curve…</p>
        ) : youCurve.isError || points.length === 0 ? (
          <EmptyState
            title="Per-minute soul curve not served yet"
            message={youCurve.isError ? laneAheadMessage(youCurve.error) : `No lane data for ${bandLabel} yet — try another tier or "All".`}
            icon="chart"
          />
        ) : (
          <>
            <EconomyCurve data={points} />
            <p className="muted" style={{ fontSize: 12, margin: '10px 0 0', lineHeight: 1.45 }}>
              The cyan area is the <b className="cyan-c">{bandLabel}</b> tier median net worth per minute
              {cohortLabel ? <> ; the dashed line is <b>{cohortLabel}</b> one tier up — the gap is where the lane is being lost.</> : <>.</>}
            </p>
          </>
        )}
      </div>

      <VerdictPanel band={band} />
    </div>
  );
}

export default function LaneLabIsland() {
  return (
    <QueryProvider>
      <LaneLabInner />
    </QueryProvider>
  );
}
