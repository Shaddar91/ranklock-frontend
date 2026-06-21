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
import { useEffect, useId, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, isComputing, isDisabled, isNotFound, isUnauthorized, queryKeys } from '../../lib/apiClient';
import QueryProvider from './QueryProvider';
import { BracketFilter, type BracketValue, Chip, EmptyState, Icon, RankBadge } from './ui/index';
import EconomyCurve, { type EconomyPoint } from './charts/EconomyCurve';
import { useViewer } from './player/usePlayer';
import { getRank, rankFromBadge, RANKS } from '../../lib/ranks';
import { count, pct } from '../../lib/format';
import type { EconomyOverlayResponse, LaneCurveResponse, PlayerEconomy, SearchResult } from '../../types/api';

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

//---- the picked-player / my-account economy overlay -------------------------
//Both the public per-player aggregate (PlayerEconomy) and the signed-in caller's
//`/me/economy-overlay` `you` side collapse to ONE shape so the curve marker and the
//verdict highlight don't care which source produced it. Every figure is an AGGREGATE
//across the player's matches — there is deliberately NO per-minute series here (the
//timeline detail tier is ~1.9% loaded and 0 rows for many accounts), so the overlay
//can only ever be a flat reference, never a fabricated personal soul curve.

//What's currently overlaid: a searched player, or the signed-in caller's own account.
type OverlaySource = { kind: 'player'; player: SearchResult } | { kind: 'me' };

interface PlayerOverlay {
  label: string;
  matches: number;
  badge: number;
  avg_net_worth: number | null;
  souls_per_min: number | null;
}

function overlayFromPlayer(name: string, e: PlayerEconomy): PlayerOverlay {
  return { label: name, matches: e.matches, badge: e.badge, avg_net_worth: e.avg_net_worth, souls_per_min: e.souls_per_min };
}

function overlayFromMe(o: EconomyOverlayResponse): PlayerOverlay {
  return { label: 'My account', matches: o.you.matches, badge: o.you.badge, avg_net_worth: o.you.avg_net_worth, souls_per_min: o.you.souls_per_min };
}

//An overlay only has something to draw when it covers real ranked games with a souls
//rate — otherwise the player has "no economy data yet" and the picker empty-states it.
const overlayHasData = (o: PlayerOverlay | null): o is PlayerOverlay =>
  o != null && o.matches > 0 && o.souls_per_min != null;

//The picked player's ESTIMATED 9-minute net worth, projected from their average souls/min
//pace (× 9 min). NOT a measured value — early/late minutes farm at different rates and we
//have no per-minute timeline — so every surface that shows it says "est. from avg pace".
const projected9MinSouls = (o: PlayerOverlay): number | null =>
  o.souls_per_min != null ? Math.round(o.souls_per_min * 9) : null;

//The `/me/economy-overlay` `you` aggregate is band-INDEPENDENT (the service filters it by
//account only), but the endpoint's validate_band requires a concrete band 0..=11. So the
//overlay sends a FIXED valid band: it keeps the 'All ranks' selection from 400ing and stops
//`you` from refetching every time the UI band changes (the cohort_curve that band drives is
//unused here — the overlay reads only `you`).
const ME_OVERLAY_BAND = 0;

//Status of the active overlay fetch, handed to the picker for its loading/empty/summary UI.
interface OverlayStatus {
  pending: boolean;
  isError: boolean;
  error: unknown;
  data: PlayerOverlay | null;
  hasData: boolean;
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
  playerOverlay = null,
}: {
  band: BracketValue;
  fetcher: (params: { band?: number; metric?: string }) => Promise<LaneCurveResponse>;
  queryKeyFor: (params: { band: number | string; metric: string }) => readonly unknown[];
  metrics: readonly MetricOption[];
  defaultMetric: string;
  kicker: string;
  //Optional picked-player / my-account overlay (only the economy panel passes one). The
  //flat marker rides the souls metric only — see overlayMarker below.
  playerOverlay?: PlayerOverlay | null;
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

  //Flat player-overlay marker: only the souls metric is a net-worth LEVEL the line can sit
  //on — the aggregate has no level for last-hits/kills/etc., so other metrics show no marker
  //(just a hint to switch to Souls). The marker is the player's AVERAGE net worth, not a curve.
  const overlayMarker =
    playerOverlay && metric === 'souls' && playerOverlay.avg_net_worth != null
      ? { value: playerOverlay.avg_net_worth, label: `${playerOverlay.label} avg` }
      : null;

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
            marker={overlayMarker}
          />
          <p className="muted" style={{ fontSize: 12, margin: '10px 0 0', lineHeight: 1.45 }}>
            The cyan area is the <b className="cyan-c">{bandLabel}</b> tier median {metricLower} per minute
            {cohortLabel ? <> ; the dashed line is <b>{cohortLabel}</b> one tier up — the gap is where the lane is being lost.</> : <>.</>}
            {' '}This is your <b>rank&rsquo;s</b> typical curve across all sampled players — not your own matches.
          </p>
          {playerOverlay && (
            <p className="muted" style={{ fontSize: 12, margin: '6px 0 0', lineHeight: 1.45 }}>
              {overlayMarker ? (
                <>
                  The <b style={{ color: 'var(--amber-acc)' }}>amber line</b> marks{' '}
                  <b>{playerOverlay.label}</b>&rsquo;s average net worth
                  {playerOverlay.avg_net_worth != null ? <> ({count(playerOverlay.avg_net_worth)} souls)</> : null} — a
                  per-game <b>average</b>, not a per-minute curve (a personal soul curve needs match timeline
                  data, which isn&rsquo;t loaded yet).
                </>
              ) : (
                <>Switch to <b>Souls</b> to overlay <b>{playerOverlay.label}</b>&rsquo;s average net worth — the overlay is a souls figure.</>
              )}
            </p>
          )}
        </>
      )}
    </div>
  );
}

//---- the 9-min early-econ verdict bars --------------------------------------

function VerdictPanel({ band, playerOverlay = null }: { band: BracketValue; playerOverlay?: PlayerOverlay | null }) {
  const verdict = useQuery({
    queryKey: queryKeys.laneEarlyEconVerdict({ band: bandParam(band) ?? 'all' }),
    queryFn: () => api.getLaneEarlyEconVerdict({ band: bandParam(band) }),
    retry: false,
  });

  const buckets = useMemo(
    () => [...(verdict.data?.buckets ?? [])].sort((a, b) => a.souls_bucket_9min - b.souls_bucket_9min),
    [verdict.data],
  );

  //Which bucket the picked player lands in — from their PROJECTED 9-min net worth
  //(avg pace × 9), not a measured value. Buckets are 1000-souls wide (souls_floor =
  //souls_bucket_9min × 1000); clamp to the nearest end if the projection falls outside.
  const proj9 = playerOverlay ? projected9MinSouls(playerOverlay) : null;
  const markedBucket = useMemo<number | null>(() => {
    if (proj9 == null) return null;
    const hit = buckets.find((b) => proj9 >= b.souls_floor && proj9 < b.souls_floor + 1000);
    if (hit) return hit.souls_bucket_9min;
    const first = buckets[0];
    const last = buckets[buckets.length - 1];
    if (!first || !last) return null;
    return proj9 < first.souls_floor ? first.souls_bucket_9min : last.souls_bucket_9min;
  }, [proj9, buckets]);

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
            const marked = markedBucket === b.souls_bucket_9min;
            return (
              <div key={b.souls_bucket_9min}>
                <div
                  className="flex"
                  style={{
                    alignItems: 'center',
                    gap: 10,
                    opacity: thin ? 0.6 : 1,
                    //outline (not border) so the highlight never shifts the bar layout.
                    outline: marked ? '1.5px solid var(--amber-acc)' : undefined,
                    outlineOffset: marked ? 3 : undefined,
                    borderRadius: marked ? 4 : undefined,
                  }}
                >
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
                {marked && (
                  <div className="mono" style={{ fontSize: 10.5, color: 'var(--amber-acc)', fontWeight: 700, margin: '5px 0 0 88px' }}>
                    ◆ {playerOverlay?.label} ≈ here (est. from avg pace)
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {playerOverlay && proj9 != null && markedBucket != null && buckets.length > 0 && (
        <p className="muted" style={{ fontSize: 12, margin: '12px 0 0', lineHeight: 1.45 }}>
          The <b style={{ color: 'var(--amber-acc)' }}>◆</b> bar is where <b>{playerOverlay.label}</b> lands — an{' '}
          <b>estimate</b> (~{count(proj9)} souls at 9:00) projected from their{' '}
          {playerOverlay.souls_per_min != null ? count(playerOverlay.souls_per_min) : '—'} souls/min average,{' '}
          <b>not</b> a measured 9-minute value. Per-minute timeline data isn&rsquo;t loaded yet.
        </p>
      )}
    </div>
  );
}

//---- the player-overlay picker ----------------------------------------------
//A debounced typeahead over the SAME /players/search endpoint the nav SearchBox uses
//(cache shared via the `search` query key), plus a "Use my account" shortcut when a
//session exists. Picking a player / the caller sets the overlay; the parent fetches the
//economy aggregate and threads it into the curve + verdict. Loading / no-data / summary
//states render here so the panels below stay clean.

//The right empty-state copy for a no-data or errored overlay, by source + error kind.
function overlayEmptyMessage(source: OverlaySource, error: unknown): string {
  if (source.kind === 'me') {
    if (isUnauthorized(error)) return 'Sign in to overlay your own account.';
    if (isDisabled(error)) return 'Your account overlay comes online when the rich-analytics tier is enabled.';
    if (isComputing(error)) return 'Computing now — your account overlay is being generated.';
    return 'No ranked economy data on your account yet.';
  }
  if (isNotFound(error)) return `${source.player.steam_name} is private or has no ranked economy data yet.`;
  if (isDisabled(error)) return 'The per-player overlay comes online when the analytics tier is enabled.';
  if (isComputing(error)) return 'Computing now — check back shortly.';
  return `No economy data for ${source.player.steam_name} yet.`;
}

//The active-overlay summary line: the player's rank badge + label + their aggregate
//economy. Reads `badge` so the figure is anchored to a rank, not floating in a vacuum.
function OverlaySummary({ data }: { data: PlayerOverlay }) {
  const rk = rankFromBadge(data.badge);
  return (
    <div className="flex" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
      {rk && <RankBadge tier={rk.tier} size={22} glow={false} />}
      <Chip tone="neutral">{data.label}</Chip>
      <span className="mono faint" style={{ fontSize: 12 }}>
        ~{data.souls_per_min != null ? count(data.souls_per_min) : '—'} souls/min · avg net worth{' '}
        {data.avg_net_worth != null ? count(data.avg_net_worth) : '—'} · n={count(data.matches)} games
      </span>
    </div>
  );
}

function PlayerOverlayPicker({
  overlay,
  onPick,
  onUseMe,
  onClear,
  loggedIn,
  status,
}: {
  overlay: OverlaySource | null;
  onPick: (p: SearchResult) => void;
  onUseMe: () => void;
  onClear: () => void;
  loggedIn: boolean;
  status: OverlayStatus;
}) {
  const [raw, setRaw] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const listId = useId();

  //debounce the query the API sees (250ms) — mirrors SearchBox / ComparePlayerPicker.
  useEffect(() => {
    const t = setTimeout(() => setQ(raw.trim()), 250);
    return () => clearTimeout(t);
  }, [raw]);

  const searchEnabled = q.length >= 2;
  const search = useQuery({
    queryKey: queryKeys.search(q),
    queryFn: () => api.searchPlayers(q, 8),
    enabled: searchEnabled,
  });
  const results = search.data ?? [];

  function pick(r: SearchResult) {
    onPick(r);
    setRaw('');
    setQ('');
    setOpen(false);
  }

  return (
    <div className="brass-frame" style={{ padding: '16px 20px' }}>
      <span className="corner tl" />
      <span className="corner br" />
      <div className="between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="kicker" style={{ marginBottom: 4 }}>Overlay a player</div>
          <h2 className="h-sec" style={{ fontSize: 16 }}>Mark a player&rsquo;s average on the curve below</h2>
        </div>
        {overlay && (
          <button type="button" className="minitog" onClick={onClear}>
            Clear overlay
          </button>
        )}
      </div>

      <div className="flex" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div className="searchbig" style={{ minWidth: 0, maxWidth: 360, flex: '1 1 260px' }}>
          <Icon name="search" size={16} style={{ left: 12 }} />
          <input
            className="field"
            style={{ height: 38, paddingLeft: 36, fontSize: 13 }}
            placeholder="Search a player or Steam ID…"
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false);
            }}
            role="combobox"
            aria-expanded={open && searchEnabled}
            aria-controls={listId}
            aria-label="Search a player to overlay on the Lane Lab curves"
            autoComplete="off"
          />
          {open && searchEnabled && (
            <div className="search-pop panel" id={listId} role="listbox">
              {search.isFetching && results.length === 0 ? (
                <div className="search-note muted">Searching…</div>
              ) : search.isError ? (
                <div className="search-note muted">
                  {isUnauthorized(search.error) ? 'Sign in to search.' : 'Search is offline right now.'}
                </div>
              ) : results.length === 0 ? (
                <div className="search-note muted">No players found for &ldquo;{q}&rdquo;.</div>
              ) : (
                results.map((r) => {
                  const rk = rankFromBadge(r.badge);
                  return (
                    <button
                      key={r.account_id}
                      type="button"
                      className="search-row"
                      //keep input focus until the click lands so onBlur doesn't close the popup first.
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(r)}
                      role="option"
                      aria-selected="false"
                      style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      {rk && <RankBadge tier={rk.tier} size={24} glow={false} />}
                      <span className="display" style={{ flex: 1, fontWeight: 600, color: 'var(--text)' }}>
                        {r.steam_name}
                      </span>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {count(r.matches)} games
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
        {loggedIn && overlay?.kind !== 'me' && (
          <button type="button" className="minitog" onClick={onUseMe}>
            Use my account
          </button>
        )}
      </div>

      {!overlay ? (
        <p className="muted faint" style={{ fontSize: 12, margin: '12px 0 0', lineHeight: 1.45, maxWidth: 480 }}>
          Overlay any player&rsquo;s <b>average</b> economy on the soul curve and 9-minute verdict below. It&rsquo;s a
          per-game aggregate — not a personal per-minute curve (that needs match timeline data, which isn&rsquo;t
          loaded yet).
        </p>
      ) : status.pending ? (
        <p className="muted" style={{ fontSize: 12.5, margin: '12px 0 0' }}>
          Loading {overlay.kind === 'me' ? 'your account' : overlay.player.steam_name}&rsquo;s economy…
        </p>
      ) : status.isError || !status.hasData ? (
        <div style={{ marginTop: 12 }}>
          <EmptyState title="No economy data for this player yet" message={overlayEmptyMessage(overlay, status.error)} icon="coins" />
        </div>
      ) : status.data ? (
        <OverlaySummary data={status.data} />
      ) : null}
    </div>
  );
}

//---- the Lane Lab surface ---------------------------------------------------

function LaneLabInner() {
  const [band, setBand] = useState<BracketValue>(7); //Archon — its one-tier-up cohort is Oracle.
  const [overlay, setOverlay] = useState<OverlaySource | null>(null);
  const { loggedIn } = useViewer();

  const cohort = cohortBand(band);
  const bandLabel = band === 'all' ? 'All ranks' : getRank(band).name;
  const cohortLabel = cohort != null ? getRank(cohort).name : null;

  //Picked player → public per-player aggregate (MAIN API, C5). My account → the Lane Lab
  //service `/me/economy-overlay` `you` side. Only the active source's query is enabled.
  const pickedId = overlay?.kind === 'player' ? overlay.player.account_id : null;
  const playerEcon = useQuery({
    queryKey: queryKeys.playerEconomy(pickedId ?? 0),
    queryFn: () => api.getPlayerEconomy(pickedId as number),
    enabled: pickedId != null,
    retry: false,
  });
  const myEcon = useQuery({
    queryKey: queryKeys.myEconomyOverlay({ band: ME_OVERLAY_BAND }),
    queryFn: () => api.getMyEconomyOverlay({ band: ME_OVERLAY_BAND }),
    enabled: overlay?.kind === 'me',
    retry: false,
  });

  //Normalize whichever source is active into the shared overlay shape.
  const playerOverlay = useMemo<PlayerOverlay | null>(() => {
    if (overlay?.kind === 'player' && playerEcon.data) return overlayFromPlayer(overlay.player.steam_name, playerEcon.data);
    if (overlay?.kind === 'me' && myEcon.data) return overlayFromMe(myEcon.data);
    return null;
  }, [overlay, playerEcon.data, myEcon.data]);

  const activeQuery = overlay?.kind === 'me' ? myEcon : playerEcon;
  const status: OverlayStatus = {
    pending: overlay != null && activeQuery.isPending,
    isError: overlay != null && activeQuery.isError,
    error: activeQuery.error,
    data: playerOverlay,
    hasData: overlayHasData(playerOverlay),
  };
  //Only feed the panels an overlay that actually has data to draw.
  const liveOverlay = status.hasData ? playerOverlay : null;

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

      {/* Player overlay picker — drives the flat marker on the economy curve + the verdict highlight. */}
      <PlayerOverlayPicker
        overlay={overlay}
        onPick={(player) => setOverlay({ kind: 'player', player })}
        onUseMe={() => setOverlay({ kind: 'me' })}
        onClear={() => setOverlay(null)}
        loggedIn={loggedIn}
        status={status}
      />

      {/* The signature economy curve — souls by default, pivotable to other metrics. */}
      <CurvePanel
        band={band}
        fetcher={api.getLaneEconomyCurve}
        queryKeyFor={queryKeys.laneEconomyCurve}
        metrics={ECON_METRICS}
        defaultMetric="souls"
        kicker="Signature · cohort economy curve vs the rank you’re chasing"
        playerOverlay={liveOverlay}
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

      <VerdictPanel band={band} playerOverlay={liveOverlay} />
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
