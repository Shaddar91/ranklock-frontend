//============================================================================
//Lane Lab island — the signature per-minute economy / soul-curve coaching
//surface (brief §7B). ONE hydration root mounted on /lane-lab. Wires the
//rich-analytics-tier lane endpoints the standalone Lane Lab service serves from
//the additive counting-histogram Gold (mirrors deadlock-backend lane_lab.rs):
//
//  • GET /lane-lab/economy-curve?band=&metric=  — the cohort curve for the
//    selected rank band (metric ∈ souls|last_hits|kills|deaths|assists|damage),
//    plus a second call for the band ONE TIER UP (the cohort you're chasing)
//    overlaid as the dashed comparison line.
//  • GET /lane-lab/farm-curve?band=&metric=     — the per-minute farm (last-hits)
//    curve, same shape (metric ∈ last_hits|souls), default last_hits.
//  • GET /lane-lab/early-econ-verdict?band=     — the 9-minute early-econ → win-rate
//    verdict ("does your 9-minute economy predict the win?").
//
//`band` is a rank tier (badge/10, 0..11 — exactly lib/ranks RANKS index), so the
//band selector is the shared rank-bracket filter (full ladder; low ranks are thin).
//band omitted ('All') aggregates every band; the top tier (Eternus) and 'All' have
//no higher cohort to overlay.
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
import { getRank, RANKS } from '../../lib/ranks';
import { count, pct } from '../../lib/format';
import type { LaneCurveResponse } from '../../types/api';

//A single curve metric: the API token + its human label.
interface MetricOption {
  key: string;
  label: string;
}

//Metrics the /lane-lab/economy-curve histogram serves (HISTOGRAM_METRICS). souls is
//the headline; the rest let a reader pivot the curve to last-hits, kills, etc.
const ECON_METRICS: readonly MetricOption[] = [
  { key: 'souls', label: 'Souls' },
  { key: 'last_hits', label: 'Last hits' },
  { key: 'kills', label: 'Kills' },
  { key: 'deaths', label: 'Deaths' },
  { key: 'assists', label: 'Assists' },
  { key: 'damage', label: 'Damage' },
];

//The /lane-lab/farm-curve endpoint serves only last_hits + souls — last-hits is the
//farm headline, so it defaults there.
const FARM_METRICS: readonly MetricOption[] = [
  { key: 'last_hits', label: 'Last hits' },
  { key: 'souls', label: 'Souls' },
];

//souls value_bucket encoding (012 migration COMMENT): souls = net_worth/1000, so a
//p50 value_bucket maps back to real souls by ×1000. Every OTHER histogram metric
//(last_hits/kills/…) is a raw count, so its bucket is the real value (×1).
const SOULS_PER_BUCKET = 1000;
const bucketScale = (metric: string): number => (metric === 'souls' ? SOULS_PER_BUCKET : 1);

//The highest rank band (Eternus = badge 110..116 → band 11). Nothing sits above
//it, so it (and 'All') render without a one-tier-up cohort overlay.
const TOP_BAND = 11;

//The full rank ladder (Obscurus … Eternus) drives the band selector here — the
//shared BracketFilter default hides the low ranks, but the lane endpoints serve
//every band, so Lane Lab surfaces them all (with a thin-sample caveat below).
const FULL_TIERS: number[] = RANKS.map((r) => r.tier);

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
  return 'The per-minute lane curve comes online with the lane-analytics pipeline.';
}

//Merge the selected-band curve ("you") and the one-tier-up curve ("cohort") into
//the EconomyCurve point shape, keyed by minute. p50 is the cohort MEDIAN value at
//that minute (×scale from the bucket). A minute with no cohort sample → NaN, which
//Recharts renders as a gap rather than a fabricated point.
function toEconPoints(
  you: LaneCurveResponse | undefined,
  cohort: LaneCurveResponse | undefined,
  scale: number,
): EconomyPoint[] {
  const cohortByMinute = new Map<number, number>();
  for (const p of cohort?.points ?? []) {
    if (p.p50 != null) cohortByMinute.set(p.minute_bucket, p.p50 * scale);
  }
  return (you?.points ?? [])
    .filter((p) => p.p50 != null)
    .map((p) => ({
      min: Math.round(p.t_seconds / 60),
      you: (p.p50 as number) * scale,
      cohort: cohortByMinute.get(p.minute_bucket) ?? NaN,
    }));
}

//Peak per-minute sample size across the curve — shown as "n =" so a reader can
//weigh a thin band's curve against a well-sampled one.
function peakSamples(curve: LaneCurveResponse | undefined): number {
  return (curve?.points ?? []).reduce((m, p) => Math.max(m, p.sample_players), 0);
}

//---- the metric toggle ------------------------------------------------------

function MetricToggle({
  metrics,
  value,
  onChange,
}: {
  metrics: readonly MetricOption[];
  value: string;
  onChange: (m: string) => void;
}) {
  return (
    <div className="tabs" role="tablist" aria-label="Curve metric">
      {metrics.map((m) => (
        <button
          key={m.key}
          type="button"
          role="tab"
          aria-selected={value === m.key}
          className={'tab' + (value === m.key ? ' on' : '')}
          onClick={() => onChange(m.key)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

//---- a reusable cohort curve panel (economy or farm) ------------------------
//The selected band's median curve, with the rank one tier up overlaid as the
//dashed comparison line. Parameterized by the endpoint method + its query-key
//factory so the economy and farm panels share ALL of the fetch / empty-state /
//cohort-overlay logic and differ only in their metric set + copy.

function CurvePanel({
  band,
  fetcher,
  queryKeyFor,
  metrics,
  defaultMetric,
  kicker,
}: {
  band: BracketValue;
  fetcher: (params: { band?: number; metric?: string }) => Promise<LaneCurveResponse>;
  queryKeyFor: (params: { band: number | string; metric: string }) => readonly unknown[];
  metrics: readonly MetricOption[];
  defaultMetric: string;
  kicker: string;
}) {
  const [metric, setMetric] = useState<string>(defaultMetric);

  const param = bandParam(band);
  const cohort = cohortBand(band);

  const youCurve = useQuery({
    queryKey: queryKeyFor({ band: param ?? 'all', metric }),
    queryFn: () => fetcher({ band: param, metric }),
    retry: false,
  });
  const cohortCurve = useQuery({
    queryKey: queryKeyFor({ band: cohort ?? 'none', metric }),
    queryFn: () => fetcher({ band: cohort ?? undefined, metric }),
    retry: false,
    enabled: cohort != null,
  });

  const points = useMemo(
    () => toEconPoints(youCurve.data, cohortCurve.data, bucketScale(metric)),
    [youCurve.data, cohortCurve.data, metric],
  );

  const bandLabel = band === 'all' ? 'All ranks' : getRank(band).name;
  const cohortLabel = cohort != null ? getRank(cohort).name : null;
  const n = peakSamples(youCurve.data);
  const metricLabel = metrics.find((m) => m.key === metric)?.label ?? metric;
  const metricLower = metricLabel.toLowerCase();

  return (
    <div className="brass-frame" style={{ padding: '18px 20px' }}>
      <span className="corner tl" />
      <span className="corner br" />
      <div className="between" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="kicker" style={{ marginBottom: 4 }}>{kicker}</div>
          <h2 className="h-sec" style={{ fontSize: 17 }}>{metricLabel} per minute</h2>
        </div>
        {n > 0 && (
          <span className="mono faint" style={{ fontSize: 12 }}>n = {count(n)} players sampled</span>
        )}
      </div>
      {metrics.length > 1 && (
        <div style={{ marginBottom: 12 }}>
          <MetricToggle metrics={metrics} value={metric} onChange={setMetric} />
        </div>
      )}
      {youCurve.isPending ? (
        <p className="muted" style={{ padding: '24px 2px' }}>Loading the {metricLower} curve…</p>
      ) : youCurve.isError || points.length === 0 ? (
        <EmptyState
          title={`Per-minute ${metricLower} curve not served yet`}
          message={youCurve.isError ? laneAheadMessage(youCurve.error) : `No lane data for ${bandLabel} yet — try another tier or "All".`}
          icon="chart"
        />
      ) : (
        <>
          <EconomyCurve
            data={points}
            youLabel={`${bandLabel} median`}
            cohortLabel={cohortLabel ? `${cohortLabel} (one tier up)` : undefined}
          />
          <p className="muted" style={{ fontSize: 12, margin: '10px 0 0', lineHeight: 1.45 }}>
            The cyan area is the <b className="cyan-c">{bandLabel}</b> tier median {metricLower} per minute
            {cohortLabel ? <> ; the dashed line is <b>{cohortLabel}</b> one tier up — the gap is where the lane is being lost.</> : <>.</>}
            {' '}This is your <b>rank&rsquo;s</b> typical curve across all sampled players — not your own matches.
          </p>
        </>
      )}
    </div>
  );
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

//---- the Lane Lab surface ---------------------------------------------------

function LaneLabInner() {
  const [band, setBand] = useState<BracketValue>(7); //Archon — its one-tier-up cohort is Oracle.

  const cohort = cohortBand(band);
  const bandLabel = band === 'all' ? 'All ranks' : getRank(band).name;
  const cohortLabel = cohort != null ? getRank(cohort).name : null;

  return (
    <div className="grid" style={{ gap: 18 }}>
      {/* Band selector + the cohort-context line. One band drives every panel below. */}
      <div className="between" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        <div>
          <div className="label-xs" style={{ marginBottom: 6 }}>Rank band</div>
          <BracketFilter value={band} onChange={setBand} tiers={FULL_TIERS} />
          <p className="muted faint" style={{ fontSize: 11.5, margin: '6px 0 0', maxWidth: 380, lineHeight: 1.4 }}>
            Low ranks are sampled thinly — their curves may be sparse or empty until more lane data lands.
          </p>
        </div>
        <p className="muted" style={{ fontSize: 12.5, margin: 0, maxWidth: 320, textAlign: 'right' }}>
          {cohortLabel
            ? <>Showing <b className="cyan-c">{bandLabel}</b> vs <b style={{ color: 'var(--muted)' }}>{cohortLabel}</b> one tier up.</>
            : <>Showing <b className="cyan-c">{bandLabel}</b> — pick a specific tier to overlay the rank one tier up.</>}
        </p>
      </div>

      {/* The signature economy curve — souls by default, pivotable to other metrics. */}
      <CurvePanel
        band={band}
        fetcher={api.getLaneEconomyCurve}
        queryKeyFor={queryKeys.laneEconomyCurve}
        metrics={ECON_METRICS}
        defaultMetric="souls"
        kicker="Signature · cohort economy curve vs the rank you’re chasing"
      />

      {/* The farm curve — last-hits by default, also serves souls. */}
      <CurvePanel
        band={band}
        fetcher={api.getLaneFarmCurve}
        queryKeyFor={queryKeys.laneFarmCurve}
        metrics={FARM_METRICS}
        defaultMetric="last_hits"
        kicker="Farm curve · last-hits tempo vs the rank you’re chasing"
      />

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
