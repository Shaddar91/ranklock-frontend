//The curve: one line per roster player over the league's p25-p75 band, eleven metric tabs. Inline
//SVG rather than the chart library because the band, the dashed median and four lines on one axis
//is the whole requirement, and the hover has to read every line at one instant.
import { useMemo, useState } from 'react';
import { count, fixed } from '../../../lib/format';
import { RANK_MIN_SAMPLE } from '../../../lib/laneCurve';
import { SCORECARD_METRICS } from '../../../lib/lanePercentile';
import { LEAGUE_NAMES } from './LadderPanel';
import { WINDOWLESS_METRICS, type BandPoint, type PlayerSeries } from './usePlayerCurves';

const W = 1000;
const H = 340;
const PAD = { l: 56, r: 16, t: 14, b: 30 };
//A metric that is a running ratio or a level has no "gained this minute" reading.
const NO_RATE = new Set(['accuracy', 'level']);
//Laning is the first twelve minutes; only the farm metrics have a meaningful early-game view.
const EARLY_BUCKETS = 4;
const EARLY_OK = new Set(['souls', 'last_hits']);

const WIDE = new Set(['souls', 'damage', 'damage_taken', 'player_healing', 'damage_mitigated']);
const fmt = (metric: string, v: number): string =>
  metric === 'accuracy' ? `${fixed(v, 1)}%` : WIDE.has(metric) ? count(Math.round(v)) : fixed(v, 1);
const axisLabel = (metric: string, v: number): string =>
  metric === 'accuracy'
    ? `${Math.round(v)}%`
    : v >= 10000
      ? `${(v / 1000).toFixed(v % 1000 ? 1 : 0).replace(/\.0$/, '')}K`
      : count(Math.round(v));

//Round an axis top to a half-decade so the gridlines land on readable numbers.
const niceTop = (raw: number): number => {
  if (raw <= 0) return 1;
  const step = Math.pow(10, Math.floor(Math.log10(raw)));
  return (Math.ceil((raw / step) * 2) / 2) * step;
};

export interface CurvePanelProps {
  series: readonly PlayerSeries[];
  bandPoints: readonly BandPoint[];
  metric: string;
  onPickMetric: (m: string) => void;
  tier: number;
  matchMode: 'Unranked' | 'Ranked';
  windowLabel: string;
  coverage: { matches_with_timeline: number; matches_total: number } | null;
}

export default function CurvePanel({
  series,
  bandPoints,
  metric,
  onPickMetric,
  tier,
  matchMode,
  windowLabel,
  coverage,
}: CurvePanelProps) {
  const [view, setView] = useState<'total' | 'rate'>('total');
  const [span, setSpan] = useState<'full' | 'early'>('full');
  const [hover, setHover] = useState<number | null>(null);

  const canRate = !NO_RATE.has(metric);
  const canEarly = EARLY_OK.has(metric);
  const vw = canRate ? view : 'total';
  const sp = canEarly ? span : 'full';
  const metricLabel = SCORECARD_METRICS.find((m) => m.key === metric)?.label ?? metric;
  const tierName = LEAGUE_NAMES[tier] ?? `Tier ${tier}`;

  //A band minute under the floor is not drawn: the median is real but too thin to compare against.
  const band = useMemo(
    () => bandPoints.filter((p) => p.sample >= RANK_MIN_SAMPLE && p.p50 != null),
    [bandPoints],
  );

  const lastBucket = sp === 'early' ? EARLY_BUCKETS : 13;
  const buckets = useMemo(
    () => Array.from({ length: lastBucket }, (_, i) => i + 1),
    [lastBucket],
  );

  //The per-minute view differences the cumulative series; the band uses `mean` for the same reason
  //the backend added it — a discrete median's delta saws between whole units.
  const diff = (get: (b: number) => number | null) => (b: number) => {
    const here = get(b);
    if (here == null) return null;
    const prev = b === 1 ? 0 : get(b - 1);
    return prev == null ? null : (here - prev) / 3;
  };

  const bandAt = (b: number, k: 'p25' | 'p50' | 'p75' | 'mean') =>
    band.find((p) => p.bucket === b)?.[k] ?? null;
  const refGet = vw === 'rate' ? diff((b) => bandAt(b, 'mean')) : (b: number) => bandAt(b, 'p50');
  const loGet = (b: number) => bandAt(b, 'p25');
  const hiGet = (b: number) => bandAt(b, 'p75');
  const showBand = vw === 'total' && band.length > 0;

  const lineGet = (s: PlayerSeries) =>
    vw === 'rate'
      ? diff((b) => s.byBucket.get(b) ?? null)
      : (b: number) => s.byBucket.get(b) ?? null;

  const drawn: number[] = [];
  for (const b of buckets) {
    if (showBand) {
      const hi = hiGet(b);
      if (hi != null) drawn.push(hi);
    }
    const r = refGet(b);
    if (r != null) drawn.push(r);
    for (const s of series) {
      const v = lineGet(s)(b);
      if (v != null) drawn.push(v);
    }
  }
  const top = niceTop(Math.max(...drawn, 1) * 1.06);

  const xs = (b: number) => PAD.l + (b / lastBucket) * (W - PAD.l - PAD.r);
  const ys = (v: number) => PAD.t + (1 - v / top) * (H - PAD.t - PAD.b);
  const path = (get: (b: number) => number | null): string => {
    let d = '';
    let open = false;
    for (const b of buckets) {
      const v = get(b);
      if (v == null) {
        open = false;
        continue;
      }
      d += `${open ? 'L' : 'M'}${xs(b).toFixed(1)},${ys(v).toFixed(1)} `;
      open = true;
    }
    return d.trim();
  };

  const bandPath = (): string => {
    const up = buckets.filter((b) => hiGet(b) != null);
    if (up.length === 0) return '';
    const top0 = up.map((b, i) => `${i ? 'L' : 'M'}${xs(b).toFixed(1)},${ys(hiGet(b) as number).toFixed(1)}`);
    const down = [...up]
      .reverse()
      .filter((b) => loGet(b) != null)
      .map((b) => `L${xs(b).toFixed(1)},${ys(loGet(b) as number).toFixed(1)}`);
    return `${top0.join(' ')} ${down.join(' ')} Z`;
  };

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ y: ys(top * f), label: axisLabel(metric, top * f) }));
  const drawable = series.filter((s) => !s.empty);
  const hoverBucket = hover == null ? null : Math.min(Math.max(hover, 1), lastBucket);

  return (
    <section className="ll-curve brass-frame">
      <header className="ll-sc-head">
        <div>
          <div className="kicker">Over the game</div>
          <h2 className="h-sec">
            {metricLabel} {vw === 'rate' ? 'per minute' : 'by minute'}
          </h2>
        </div>
        <div className="ll-curve-controls">
          {canRate && (
            <div className="ll-seg">
              {(['total', 'rate'] as const).map((k) => (
                <button
                  type="button"
                  key={k}
                  className={k === vw ? 'on' : ''}
                  onClick={() => setView(k)}
                >
                  {k === 'total' ? 'Total' : 'Per minute'}
                </button>
              ))}
            </div>
          )}
          <div className="ll-seg" title={canEarly ? '' : 'the laning window applies to souls and last hits'}>
            {(['full', 'early'] as const).map((k) => (
              <button
                type="button"
                key={k}
                className={k === sp ? 'on' : ''}
                disabled={!canEarly}
                onClick={() => setSpan(k)}
              >
                {k === 'full' ? 'Full game' : 'Early game'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="ll-tabs">
        {SCORECARD_METRICS.map((m) => (
          <button
            type="button"
            key={m.key}
            className={m.key === metric ? 'on' : ''}
            onClick={() => {
              onPickMetric(m.key);
              setHover(null);
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div
        className="ll-plot"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          setHover(Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * lastBucket));
        }}
        onMouseLeave={() => setHover(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${metricLabel} over the game`}>
          {yTicks.map((t) => (
            <g key={t.label}>
              <line x1={PAD.l} x2={W - PAD.r} y1={t.y} y2={t.y} stroke="var(--border)" />
              <text x={PAD.l - 6} y={t.y} dy="4" textAnchor="end" fill="var(--muted)" fontSize="11">
                {t.label}
              </text>
            </g>
          ))}
          {buckets.map((b) => (
            <text
              key={b}
              x={xs(b)}
              y={H - 12}
              textAnchor="middle"
              fill="var(--muted)"
              fontSize="11"
            >
              {sp === 'early' || b % 2 === 0 || b === 1 ? `${b * 3}:00` : ''}
            </text>
          ))}
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={H - PAD.b}
            y2={H - PAD.b}
            stroke="var(--border)"
          />
          {showBand && <path d={bandPath()} fill="var(--text-2)" fillOpacity="0.18" />}
          <path
            d={path(refGet)}
            fill="none"
            stroke="var(--text-2)"
            strokeOpacity="0.45"
            strokeWidth="1.5"
            strokeDasharray="6 5"
          />
          {drawable.map((s) => (
            <path
              key={s.player.account_id}
              d={path(lineGet(s))}
              fill="none"
              stroke={s.player.color}
              strokeWidth="2"
              strokeOpacity={s.peakMatches < 5 ? 0.45 : 1}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {hoverBucket != null && (
            <>
              <line
                x1={xs(hoverBucket)}
                x2={xs(hoverBucket)}
                y1={PAD.t}
                y2={H - PAD.b}
                stroke="var(--brass-2)"
              />
              {drawable.map((s) => {
                const v = lineGet(s)(hoverBucket);
                return v == null ? null : (
                  <circle
                    key={s.player.account_id}
                    cx={xs(hoverBucket)}
                    cy={ys(v)}
                    r="3.5"
                    fill={s.player.color}
                    stroke="var(--ink)"
                  />
                );
              })}
            </>
          )}
        </svg>

        {hoverBucket != null && (
          <div
            className="ll-hover"
            style={{
              left: `${(xs(hoverBucket) / W) * 100}%`,
              transform: hoverBucket > lastBucket / 2 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)',
            }}
          >
            <strong className="tnum">{hoverBucket * 3}:00</strong>
            {drawable.map((s) => {
              const v = lineGet(s)(hoverBucket);
              return (
                <span key={s.player.account_id}>
                  <em style={{ color: s.player.color }}>{s.player.name}</em>
                  <b className="tnum">{v == null ? '—' : fmt(metric, v)}</b>
                </span>
              );
            })}
            <small className="tnum">
              {vw === 'rate'
                ? `${tierName} mean ${fmt(metric, refGet(hoverBucket) ?? 0)}`
                : `${tierName} p25 ${fmt(metric, loGet(hoverBucket) ?? 0)} · p50 ${fmt(metric, refGet(hoverBucket) ?? 0)} · p75 ${fmt(metric, hiGet(hoverBucket) ?? 0)}`}
            </small>
          </div>
        )}

        {drawable.length === 0 && (
          <p className="ll-curve-note">
            {series.length === 0
              ? `Reference: ${tierName}. Add a player to draw a line.`
              : `No ${metricLabel.toLowerCase()} in these players' curves yet. It fills from the next pipeline fold. The ${tierName} band is measured.`}
          </p>
        )}
      </div>

      <div className="ll-legend">
        {drawable.map((s) => (
          <span key={s.player.account_id}>
            <i style={{ borderTopColor: s.player.color }} />
            {s.player.name}
            {s.peakMatches < 5 && s.peakMatches > 0 ? ` · ${s.peakMatches} games, thin` : ''}
          </span>
        ))}
        {band.length > 0 && (
          <span>
            <i className="dashed" />
            {tierName}, {vw === 'rate' ? 'mean' : 'middle half'}
          </span>
        )}
      </div>

      <p className="ll-sc-foot">
        {metricLabel}, {vw === 'rate' ? 'gained per minute over the previous three' : 'by minute'}.{' '}
        {band.length > 0
          ? `${tierName} ${vw === 'rate' ? 'mean' : 'band: middle half'} of ${count(band[0]?.sample ?? 0)} player-games, ranked only.`
          : `No ${tierName} minute clears the ${count(RANK_MIN_SAMPLE)} player-game floor.`}{' '}
        Player lines: {matchMode}, {windowLabel.toLowerCase()}.
        {WINDOWLESS_METRICS.has(metric)
          ? ' This metric has no windowed form, because the retained timeline carries no such array, so it always reads all games.'
          : coverage && coverage.matches_total !== coverage.matches_with_timeline
            ? ` ${coverage.matches_with_timeline} of ${coverage.matches_total} games in the window carry a timeline.`
            : ''}
      </p>
    </section>
  );
}
