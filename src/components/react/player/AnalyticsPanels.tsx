//============================================================================
//Overview analytics panels (C5) — the dashboard centerpiece. All four read the
//build-ahead "rich-tier" endpoints (/improve, /compare) and EMPTY-STATE, never
//crash, when those endpoints 202 (computing) / 501 (disabled) / 404 (no data) —
//that is the expected state until the analytics pipeline serves them (§8.1).
//
//  • PlaystyleRadarPanel  — playstyle shape vs the rank above, derived from the
//                           SERVED /compare aggregates (mode-separated; the old
//                           /improve percentile radar was never served).
//  • EconomyPanel         — soul-curve-vs-cohort + gold-source breakdown. The
//                           per-minute timeline is an UNBUILT endpoint, so the
//                           two charts grey out; the served /compare souls/min
//                           headline still renders.
//  • CoachingPanel        — "how to climb" tips from /improve callouts.
//  • CategorizedSection   — Combat/Economy (from /improve) + Laning/Efficiency
//                           (from /compare), with a vs-bracket ⇄ compare toggle.
//============================================================================
import { useEffect, useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, isComputing, isDisabled, isNotFound, isUnauthorized, queryKeys } from '../../../lib/apiClient';
import { useGameMode } from '../../../lib/useGameMode';
import { EmptyState, Icon, RankBadge } from '../ui/index';
import RadarChart from '../charts/RadarChart';
import SignatureCurve from '../charts/SignatureCurve';
import { sigSeriesColor, useSigSeriesWords } from '../charts/chartTheme';
import { CatPanel } from './StatLine';
import { useCompare, useComparePlayer, useImprove, usePlayer, usePlayerEconomyCurve, usePlayerHeroesPlayed } from './usePlayer';
import { combatRows, compareRadarVsPlayer, economyRows, efficiencyRows, laningRows, selfShapeAxes } from '../../../lib/playstyle';
import { mergeSignatureCurve, curveMarker } from '../../../lib/signatureCurve';
import { RANKS, getRank, rankFromBadge } from '../../../lib/ranks';
import { count, fixed } from '../../../lib/format';
import type { SearchResult } from '../../../types/api';

//Coaching/playstyle are derived from /improve, whose cohort is Normal-only (022). In
//Brawl mode this content is STILL Normal — surface that so the page never silently
//implies a Brawl view exists. Renders nothing in Normal mode.
function NormalOnlyNote({ what }: { what: string }) {
  const { mode } = useGameMode();
  if (mode !== 'StreetBrawl') return null;
  return (
    <p className="faint" style={{ fontSize: 11, margin: '8px 0 0', lineHeight: 1.4 }}>
      {what} use <b>Normal</b>-mode data — Brawl has no laning/coaching cohort.
    </p>
  );
}

//Translate a build-ahead query error into the right empty-state copy.
export function buildAheadMessage(error: unknown, fallback = 'Comes online with the analytics pipeline.'): string {
  if (isComputing(error)) return 'Computing now — the first result is being generated. Check back shortly.';
  if (isDisabled(error)) return 'The rich-analytics tier is currently disabled on the API.';
  if (isNotFound(error)) return 'No analytics for this player yet.';
  return fallback;
}

function Loading({ label }: { label: string }) {
  return (
    <p className="muted" style={{ padding: '14px 2px' }}>
      {label}…
    </p>
  );
}

//---- playstyle radar --------------------------------------------------------

//The player's OWN shape across 6 per-game measures (Souls/min, Last-hits, Kills,
//Assists, Denies, KDA), each normalized against a FIXED display ceiling (SELF_AXIS_MAX
//in lib/playstyle) — NOT against a league cohort. An OPTIONAL player picker lets the
//viewer overlay a second player's shape on the same scale for direct comparison; when
//a player is picked the second series replaces the own-shape mirror. No league option.
export function PlaystyleRadarPanel({ id }: { id: number }) {
  //No league_offset — the radar needs only the always-populated `you` aggregate; the
  //cohort/tier baseline is intentionally not read (own-shape view).
  const { data, isPending, isError, error } = useCompare(id);
  const you = data?.you ?? null;
  const axes = you ? selfShapeAxes(you) : [];
  const servedCount = axes.filter((a) => a.served).length;
  //Real empty-state ONLY when the player has no usable own data (no matches / every
  //metric null) — the designed fallback, not the old systemic cohort-empty.
  const noData = !you || you.matches === 0 || servedCount === 0;

  //---- optional player-compare overlay ----------------------------------------
  const [raw, setRaw] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<SearchResult | null>(null);
  const listId = useId();

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
  const results = (search.data ?? []).filter((r) => r.account_id !== id);
  const selfOnly =
    (search.data?.length ?? 0) > 0 &&
    results.length === 0 &&
    (search.data ?? []).every((r) => r.account_id === id);

  //No hero filter — pick the best shared hero across all heroes.
  const cmp = useComparePlayer(id, picked?.account_id);
  const cmpData = cmp.data ?? null;
  //HTTP 404 from compare-player = no shared-hero overlap (per Component 1, an
  //intentional empty-state, NOT a broken route).
  const noSharedHero = isNotFound(cmp.error);

  //Two-series axes (you + picked player, both via SELF_AXIS_MAX) when cmpData loads.
  const overlayAxes = you && cmpData ? compareRadarVsPlayer(you, cmpData.them) : null;

  return (
    <div className="brass-frame" style={{ padding: '18px 20px' }}>
      <span className="corner tl" />
      <span className="corner br" />
      <div style={{ marginBottom: 8 }}>
        <div className="kicker" style={{ marginBottom: 4 }}>
          Playstyle
        </div>
        <h2 className="h-sec" style={{ fontSize: 17 }}>
          {picked ? `You vs ${picked.steam_name}` : 'Your shape'}
        </h2>
      </div>
      {isPending ? (
        <Loading label="Loading playstyle" />
      ) : isError ? (
        <EmptyState title="Playstyle radar not served yet" message={buildAheadMessage(error)} icon="target" />
      ) : noData ? (
        <EmptyState title="No playstyle data yet" message="No matches recorded for this player yet." icon="target" />
      ) : (
        <>
          <RadarChart
            data={
              overlayAxes
                ? overlayAxes.map((a) => ({ axis: a.axis, you: a.you, cohort: a.cohort }))
                : axes.map((a) => ({ axis: a.axis, you: a.you, cohort: a.you }))
            }
            youLabel="You"
            cohortLabel={overlayAxes && picked ? picked.steam_name : 'You'}
          />
          {picked && cmp.isPending ? (
            <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0', textAlign: 'center' }}>
              Loading comparison with {picked.steam_name}…
            </p>
          ) : picked && noSharedHero ? (
            <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0', textAlign: 'center', lineHeight: 1.45 }}>
              No shared hero to compare — you and {picked.steam_name} haven&apos;t overlapped on any hero yet.
            </p>
          ) : (
            <p className="muted" style={{ fontSize: 12.5, margin: '10px 0 0', textAlign: 'center', lineHeight: 1.45 }}>
              {servedCount < axes.length
                ? `Partial — ${servedCount} of ${axes.length} axes shown; the rest fill in as this player logs more matches.`
                : picked
                ? `Your shape vs ${picked.steam_name} — the blob reaches further on axes where you lead.`
                : 'Your shape across six per-game measures — the blob reaches out on the axes you do most.'}
            </p>
          )}

          {/* optional player picker — always visible below the radar */}
          <div style={{ marginTop: 14, position: 'relative' }}>
            <div className="between" style={{ gap: 8 }}>
              <div className="searchbig" style={{ minWidth: 0, flex: 1 }}>
                <Icon name="search" size={16} style={{ left: 12 }} />
                <input
                  className="field"
                  style={{ height: 34, paddingLeft: 36, fontSize: 13 }}
                  placeholder={picked ? `Comparing vs ${picked.steam_name}` : 'Overlay another player…'}
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
                  aria-label="Search a player to overlay on the radar"
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
                      selfOnly ? (
                        <div className="search-note muted">
                          That is you — search for another player to overlay.
                        </div>
                      ) : (
                        <div className="search-note muted">No players found for &ldquo;{q}&rdquo;.</div>
                      )
                    ) : (
                      results.map((r) => {
                        const rk = rankFromBadge(r.badge);
                        return (
                          <button
                            key={r.account_id}
                            type="button"
                            className="search-row"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setPicked(r);
                              setRaw('');
                              setQ('');
                              setOpen(false);
                            }}
                            role="option"
                            aria-selected="false"
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                            }}
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
              {picked && (
                <button
                  type="button"
                  className="minitog"
                  onClick={() => {
                    setPicked(null);
                    setRaw('');
                    setQ('');
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

//---- signature economy view -------------------------------------------------

//The two metrics the player curve serves (backend PLAYER_CURVE_METRICS). `noun` is the
//lower-case word for captions/axis; the curve endpoint keys on `key`.
const CURVE_METRICS = [
  { key: 'souls', label: 'Souls', noun: 'souls' },
  { key: 'last_hits', label: 'Last hits', noun: 'last hits' },
] as const;
type CurveMetric = (typeof CURVE_METRICS)[number]['key'];

//THE signature coaching chart (C3): the player's OWN per-minute curve, FIXED, overlaid on a
//comparison cohort they pick. The LEAGUE selector (rank tier) and the HERO selector move
//ONLY the comparison line — `you` is invariant. Colours/caption words come from
//sigSeriesColor/useSigSeriesWords (both keyed to the active skin) so the legend, the
//caption, and the lines can never disagree — in any skin.
function SignatureCurvePanel({ id }: { id: number }) {
  const sigWords = useSigSeriesWords(); //active skin's series color words
  const [metric, setMetric] = useState<CurveMetric>('souls');
  //league: undefined = "auto" (default to the rank you're chasing once the profile loads);
  //null = All ranks (vs_band omitted); number = a specific rank tier 0..11.
  const [band, setBand] = useState<number | null | undefined>(undefined);
  //hero: undefined = all heroes (no hero filter).
  const [hero, setHero] = useState<number | undefined>(undefined);

  const profile = usePlayer(id);
  const heroesPlayed = usePlayerHeroesPlayed(id);
  const playerTier = rankFromBadge(profile.data?.badge)?.tier ?? null;
  //Default the comparison to the rank ONE tier up — the rank you're chasing (matches the
  //panel's "vs the rank you're chasing" framing). Falls back to All ranks if tier unknown.
  const autoBand = playerTier != null ? Math.min(RANKS.length - 1, playerTier + 1) : null;
  const effBand = band === undefined ? autoBand : band; //null => All ranks

  const curve = usePlayerEconomyCurve(id, { metric, vs_band: effBand ?? undefined, hero });

  const noun = CURVE_METRICS.find((m) => m.key === metric)!.noun;
  const heroOptions = [...(heroesPlayed.data ?? [])].sort((a, b) => b.matches_played - a.matches_played);
  const points = mergeSignatureCurve(curve.data);
  const hasYou = points.some((p) => p.you != null);
  const comparison = curve.data?.comparison ?? null;
  const hasCmp = (comparison?.points.length ?? 0) > 0;
  const heroName = hero != null ? heroOptions.find((h) => h.hero_id === hero)?.hero_name : null;
  const tierName = effBand != null ? getRank(effBand).name : 'All ranks';
  const cmpLabel = hasCmp ? `${tierName}${heroName ? ` · ${heroName}` : ''} average` : undefined;
  const marker = curveMarker(points);

  const leagueSelector = (
    <label className="flex" style={{ alignItems: 'center', gap: 8 }}>
      <span className="label-xs">League</span>
      <select
        className="field"
        style={{ width: 'auto', padding: '7px 10px' }}
        value={effBand == null ? '' : String(effBand)}
        onChange={(e) => setBand(e.target.value === '' ? null : Number(e.target.value))}
        aria-label="Choose the league to compare against"
      >
        <option value="">All ranks</option>
        {RANKS.map((r) => (
          <option key={r.tier} value={r.tier}>
            {r.name}
          </option>
        ))}
      </select>
    </label>
  );

  const heroSelector = heroOptions.length > 0 && (
    <label className="flex" style={{ alignItems: 'center', gap: 8 }}>
      <span className="label-xs">Hero</span>
      <select
        className="field"
        style={{ width: 'auto', padding: '7px 10px' }}
        value={hero ?? ''}
        onChange={(e) => setHero(e.target.value === '' ? undefined : Number(e.target.value))}
        aria-label="Narrow the comparison to one hero"
      >
        <option value="">All heroes</option>
        {heroOptions.map((h) => (
          <option key={h.hero_id} value={h.hero_id}>
            {h.hero_name} ({count(h.matches_played)})
          </option>
        ))}
      </select>
    </label>
  );

  const metricToggle = (
    <div className="brkfilter" style={{ padding: 3, flexWrap: 'nowrap', flexShrink: 0 }}>
      {CURVE_METRICS.map((m) => (
        <button
          key={m.key}
          type="button"
          className={'minitog' + (metric === m.key ? ' on' : '')}
          onClick={() => setMetric(m.key)}
          aria-pressed={metric === m.key}
        >
          {m.label}
        </button>
      ))}
    </div>
  );

  return (
    <div>
      <div className="between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div className="flex" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {leagueSelector}
          {heroSelector}
        </div>
        {metricToggle}
      </div>
      {curve.isPending ? (
        <Loading label={`Loading your ${noun} curve`} />
      ) : curve.isError ? (
        <EmptyState
          title="Per-minute curve unavailable"
          message={buildAheadMessage(curve.error, 'The per-minute timeline for this player is not loaded yet.')}
          icon="chart"
        />
      ) : !hasYou ? (
        <EmptyState
          title="No per-minute timeline yet"
          message="This player's matches don't have the per-minute detail loaded yet — your curve appears once the match timeline is ingested."
          icon="chart"
        />
      ) : (
        <>
          <SignatureCurve data={points} youLabel="You" comparisonLabel={cmpLabel} metricLabel={noun} />
          {/* Caption colour words are driven by useSigSeriesWords/sigSeriesColor — the
              SAME skin-keyed source the chart lines read — so a word can never name a
              colour the line doesn't render (the C3 no-phantom-cyan guarantee), in any
              skin. */}
          <p className="muted" style={{ fontSize: 12.5, margin: '10px 0 0', lineHeight: 1.5 }}>
            The <b style={{ color: sigSeriesColor.you }}>{sigWords.you}</b> line is{' '}
            <b style={{ color: sigSeriesColor.you }}>you</b> — your real per-minute {noun}, and it stays put when you
            switch league or hero.{' '}
            {cmpLabel ? (
              <>
                The <b style={{ color: sigSeriesColor.comparison }}>{sigWords.comparison} dashed</b> line is{' '}
                <b style={{ color: sigSeriesColor.comparison }}>{cmpLabel}</b>
                {comparison?.source === 'on-demand-hero' ? ' (computed live)' : ''} — the cohort you picked; the shaded
                band is their 25th–75th percentile. Only this line moves when you change the selectors.
              </>
            ) : (
              <>
                Pick a league to overlay the cohort you&rsquo;re chasing
                {effBand != null ? ` — ${tierName}'s cohort has no per-minute sample yet` : ''}.
              </>
            )}
          </p>
          {marker && cmpLabel && (
            <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '8px 0 0', lineHeight: 1.5 }}>
              At <b className="mono">{marker.min}:00</b> you had{' '}
              <b className="mono" style={{ color: sigSeriesColor.you }}>{count(marker.you)}</b> {noun}; {cmpLabel} was{' '}
              <b className="mono" style={{ color: sigSeriesColor.comparison }}>{count(marker.cmp)}</b> —{' '}
              <b style={{ color: marker.gap >= 0 ? 'var(--win)' : 'var(--loss)' }}>
                you&rsquo;re {count(Math.abs(marker.gap))} {noun} {marker.gap >= 0 ? 'ahead' : 'behind'}
              </b>
              .
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function EconomyPanel({ id }: { id: number }) {
  //'one_up' makes the "vs the rank you're chasing" kicker literally true — the
  //cohort is the tier directly above the player, not the player's own tier.
  const cmp = useCompare(id, { league_offset: 'one_up' });
  const souls = cmp.data?.you.souls_per_min ?? null;
  const cohortSouls = cmp.data?.cohort.souls_per_min ?? null;
  const cohortTier = cmp.data?.cohort.tier_name ?? null;
  const gap = souls != null && cohortSouls != null ? souls - cohortSouls : null;

  return (
    <div className="brass-frame" style={{ padding: '18px 20px' }}>
      <span className="corner tl" />
      <span className="corner br" />
      <div className="between" style={{ marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="kicker" style={{ marginBottom: 4 }}>
            Signature · vs the rank you&rsquo;re chasing
          </div>
          <h2 className="h-sec" style={{ fontSize: 17 }}>
            Soul curve vs {cohortTier ?? 'tier'}
          </h2>
        </div>
        {gap != null && (
          <span className={'chip ' + (gap >= 0 ? 'win' : 'loss')} style={{ fontSize: 12 }}>
            {gap >= 0 ? '+' : '−'}
            {count(Math.abs(gap))} souls/min
          </span>
        )}
      </div>
      {souls != null ? (
        <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 14px', lineHeight: 1.5 }}>
          You average <b className="cyan-c mono">{count(souls)}</b> souls/min; {cohortTier ?? 'the next tier'} averages{' '}
          <b className="mono" style={{ color: 'var(--muted)' }}>{count(cohortSouls)}</b>.
        </p>
      ) : (
        <p className="muted" style={{ fontSize: 13, margin: '0 0 14px' }}>
          Economy comparison fills in once /compare serves this player.
        </p>
      )}
      {/* THE signature per-minute curve (C3): your FIXED soul curve overlaid on a league
          (+hero) cohort you pick — now served by /players/:id/economy-curve. Replaces the
          old build-ahead empty-state. The per-SOURCE gold split below is still unbuilt. */}
      <SignatureCurvePanel id={id} />
      <div className="deco-rule" style={{ margin: '18px 0 14px' }}>
        <span className="dia" />
      </div>
      <div className="label-xs" style={{ marginBottom: 12 }}>
        Gold source — you vs tier
      </div>
      <EmptyState title="Gold-source breakdown not served yet" message="Per-source farm splits (lane creeps, neutrals, hero kills…) arrive with the rich-tier economy job." icon="coins" />
    </div>
  );
}

//---- coaching tips ----------------------------------------------------------

const METRIC_LABEL: Record<string, string> = {
  net_worth: 'Net worth',
  last_hits: 'Last hits',
  denies: 'Denies',
  kills: 'Kills',
  deaths: 'Deaths',
  assists: 'Assists',
  damage_dealt: 'Damage dealt',
};
const humanize = (k: string) => METRIC_LABEL[k] ?? k.replace(/_/g, ' ');

const SEV = {
  high: { c: 'var(--loss)', l: 'Priority' },
  med: { c: 'var(--gold)', l: 'Worth fixing' },
  low: { c: 'var(--win)', l: 'Strength' },
} as const;

function severity(deltaPct: number): keyof typeof SEV {
  if (deltaPct >= 0) return 'low';
  return Math.abs(deltaPct) >= 15 ? 'high' : 'med';
}

export function CoachingPanel({ id }: { id: number }) {
  const { data, isPending, isError, error } = useImprove(id);
  const tips = data?.improve_callouts ?? [];

  return (
    <div className="panel" style={{ padding: '16px 18px' }}>
      <div className="flex" style={{ alignItems: 'center', gap: 9, marginBottom: 14 }}>
        <Icon name="target" size={17} color="var(--cyan-bright)" />
        <h2 className="h-sec" style={{ fontSize: 16 }}>
          How to climb
        </h2>
      </div>
      {isPending ? (
        <Loading label="Synthesizing coaching tips" />
      ) : isError || tips.length === 0 ? (
        <EmptyState title="Coaching tips not served yet" message={buildAheadMessage(error)} icon="book" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tips.map((t, i) => {
            const sev = severity(t.delta_pct);
            return (
              <div
                key={t.metric}
                className="flex"
                style={{ gap: 12, alignItems: 'flex-start', paddingBottom: 10, borderBottom: i < tips.length - 1 ? '1px solid var(--border-soft)' : 'none' }}
              >
                <span style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, background: SEV[sev].c, flex: 'none' }} />
                <div style={{ flex: 1 }}>
                  <div className="display" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>
                    {humanize(t.metric)} is {t.delta_pct >= 0 ? '+' : ''}
                    {fixed(t.delta_pct, 1)}% vs your tier
                  </div>
                  <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0, lineHeight: 1.45 }}>
                    You average <b className="mono">{fixed(t.user_avg, 1)}</b> against a tier median of{' '}
                    <b className="mono">{fixed(t.cohort_p50, 1)}</b>.
                  </p>
                </div>
                <span className="chip" style={{ fontSize: 10, color: SEV[sev].c, borderColor: SEV[sev].c + '55', flex: 'none' }}>
                  {SEV[sev].l}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <NormalOnlyNote what="Coaching tips" />
    </div>
  );
}

//---- categorized performance ------------------------------------------------

//Below this cohort size the compare columns are flagged as a small sample.
const LOW_SAMPLE = 30;

export function CategorizedSection({ id }: { id: number }) {
  const [compare, setCompare] = useState(false);
  const improve = useImprove(id);
  const cmp = useCompare(id, {});

  const combat = improve.data ? combatRows(improve.data) : [];
  const economy = improve.data ? economyRows(improve.data) : [];
  const laning = cmp.data ? laningRows(cmp.data) : [];
  const efficiency = cmp.data ? efficiencyRows(cmp.data) : [];

  return (
    <div>
      <div className="between" style={{ margin: '4px 0 12px', flexWrap: 'wrap', gap: 10 }}>
        <span className="label-xs">Categorized performance · {compare ? 'you vs tier' : 'every stat vs your bracket'}</span>
        <div className="brkfilter" style={{ padding: 3, flexWrap: 'nowrap', flexShrink: 0 }}>
          <button type="button" className={'minitog' + (!compare ? ' on' : '')} onClick={() => setCompare(false)} aria-pressed={!compare}>
            vs bracket
          </button>
          <button type="button" className={'minitog' + (compare ? ' on' : '')} onClick={() => setCompare(true)} aria-pressed={compare}>
            Compare
          </button>
        </div>
      </div>
      {/* Combat/Economy come from /improve (Normal-only cohort); Laning/Efficiency
          from /compare (mode-separated). In Brawl, flag the Normal-only half. */}
      <NormalOnlyNote what="The Combat & Economy columns" />
      {compare && (
        <p className="faint" style={{ fontSize: 11, margin: '-4px 0 12px' }}>
          {cmp.data
            ? cmp.data.cohort.sample_size === 0
              ? `No ${cmp.data.cohort.tier_name} sample for this hero yet — the compare columns are empty.`
              : `Compared to ${cmp.data.cohort.tier_name} (n=${count(cmp.data.cohort.sample_size)})${
                  cmp.data.cohort.sample_size < LOW_SAMPLE ? ' · small sample' : ''
                }`
            : 'Compared to your tier — loading…'}
        </p>
      )}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
        <CatPanel title="Combat" icon="swords" rows={combat} compare={compare} emptyMessage={buildAheadMessage(improve.error)} />
        <CatPanel title="Economy" icon="coins" rows={economy} compare={compare} emptyMessage={buildAheadMessage(improve.error)} />
        <CatPanel title="Laning" icon="shield" rows={laning} compare={compare} emptyMessage={buildAheadMessage(cmp.error)} />
        <CatPanel title="Efficiency" icon="bolt" rows={efficiency} compare={compare} emptyMessage={buildAheadMessage(cmp.error)} />
      </div>
    </div>
  );
}
