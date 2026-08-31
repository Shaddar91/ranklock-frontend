//============================================================================
//Overview analytics panels (C5) — the dashboard centerpiece. All four read the
//build-ahead "rich-tier" endpoints (/improve, /compare) and EMPTY-STATE, never
//crash, when those endpoints 202 (computing) / 501 (disabled) / 404 (no data) —
//that is the expected state until the analytics pipeline serves them (§8.1).
//
//  • PlaystyleRadarPanel  — the player's own per-game shape across 6 axes, with an
//                           optional second-player overlay from /compare-player
//                           (all heroes by default; hero only on explicit select,
//                           both sides under the same games/days window). Derived
//                           from SERVED aggregates (mode-separated).
//  • EconomyPanel         — soul-curve-vs-cohort + souls-by-source breakdown (you vs
//                           tier, migration 048). The signature curve and the souls
//                           stack are served; the /compare souls/min headline sits above.
//  • CoachingPanel        — "how to climb" tips from /improve callouts.
//  • CategorizedSection   — Combat/Economy (from /improve) + Laning/Efficiency
//                           (from /compare), with a vs-bracket ⇄ compare toggle.
//============================================================================
import { useEffect, useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, isComputing, isDisabled, isNotFound, isUnauthorized, queryKeys } from '../../../lib/apiClient';
import { useGameMode } from '../../../lib/useGameMode';
import { useMatchMode } from '../../../lib/useMatchMode';
import { EmptyState, Icon, RankBadge } from '../ui/index';
import RadarChart from '../charts/RadarChart';
import SignatureCurve from '../charts/SignatureCurve';
import SoulsSourceChart from '../charts/SoulsSourceChart';
import { sigSeriesColor, useSigSeriesWords } from '../charts/chartTheme';
import { CatPanel } from './StatLine';
import {
  useCohortSoulsSources,
  useCompare,
  useComparePlayer,
  useImprove,
  usePlayer,
  usePlayerEconomyCurve,
  usePlayerHeroesPlayed,
  usePlayerSoulsSources,
} from './usePlayer';
import { usePlayerScope } from './usePlayerScope';
import { PlayerScopeControls } from './PlayerScopeControls';
import { scopeCaption, scopeParams } from '../../../lib/playerScope';
import { combatRows, compareRadarVsPlayer, economyRows, efficiencyRows, laningRows, selfShapeAxes } from '../../../lib/playstyle';
import { mergeSignatureCurve, curveMarker } from '../../../lib/signatureCurve';
import { buildSoulsSourceSeries, hasCohortSouls, isPlayerSoulsEmpty } from '../../../lib/soulsSources';
import { RANKS, chasingTier, getRank, rankFromBadge } from '../../../lib/ranks';
import { count, fixed } from '../../../lib/format';
import type { SearchResult } from '../../../types/api';
import ShareLinkButton from '../ui/ShareLinkButton';
import { compareShareUrl } from '../../../lib/compareShare';

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
//in lib/playstyle) — NOT against a league cohort. The scope controls (Games/Days
//window presets + hero select, default All heroes) apply to BOTH the solo shape and
//the optional player overlay, so the "You" polygon never moves when a second player
//is added — the overlay's you side is the solo side under the same scope.
export function PlaystyleRadarPanel({ id }: { id: number }) {
  const { scope, setKind, setN, setHero } = usePlayerScope();
  const params = scopeParams(scope);
  //Scoped own shape (hero_id always sent; 0 = all heroes) — a NEW query key,
  //separate from the no-param useCompare the Categorized-performance panels read.
  //No league_offset: the radar needs only the always-populated `you` aggregate.
  const { data, isPending, isError, error } = useCompare(id, params);
  const you = data?.you ?? null;
  const axes = you ? selfShapeAxes(you) : [];
  const servedCount = axes.filter((a) => a.served).length;
  //Real empty-state ONLY when there is no own data at all — a 0-game windowed
  //side (matches:0, a 200) renders honestly instead: no polygon, an inactive
  //legend entry, and the 0-game caption. A genuine 404 stays an empty state.
  const noData = !you || (you.matches > 0 && servedCount === 0);

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

  //Same scope as the solo call; a 404 here means an account has no games at all
  //in this mode (a 0-game windowed side is a 200 and renders as such).
  const cmp = useComparePlayer(id, picked?.account_id, params);
  const cmpData = cmp.data ?? null;
  const noGames = isNotFound(cmp.error);

  //Two-series axes (you + picked player, BOTH from the one /compare-player response
  //so both polygons share the same scope) once cmpData loads.
  const overlayAxes = cmpData ? compareRadarVsPlayer(cmpData.you, cmpData.them) : null;
  const shownAxes = overlayAxes ?? axes;
  const effYou = cmpData?.you ?? you;
  const youZero = effYou != null && effYou.matches === 0;
  const themZero = cmpData != null && cmpData.them.matches === 0;
  const shownServed = shownAxes.filter((a) => a.served).length;

  const heroName = scope.hero_id === 0 ? null : (cmpData?.hero_name ?? data?.hero_name ?? null);
  const caption = effYou
    ? scopeCaption({
        scope,
        heroName,
        you: effYou,
        themLabel: picked && cmpData ? picked.steam_name : undefined,
        them: picked && cmpData ? cmpData.them : undefined,
      })
    : '';

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
      <PlayerScopeControls scope={scope} onKind={setKind} onN={setN} onHero={setHero} playerId={id} themId={picked?.account_id} />
      {isPending ? (
        <Loading label="Loading playstyle" />
      ) : isError ? (
        <EmptyState title="Playstyle radar not served yet" message={buildAheadMessage(error)} icon="target" />
      ) : noData ? (
        <EmptyState title="No playstyle data yet" message="No matches recorded for this player yet." icon="target" />
      ) : (
        <>
          <RadarChart
            data={shownAxes}
            youLabel={youZero ? 'You (0 games in this window)' : 'You'}
            cohortLabel={picked ? (themZero ? `${picked.steam_name} (0 games in this window)` : picked.steam_name) : 'Your shape'}
            showCohort={overlayAxes != null && !themZero}
            keepCohortLegend={overlayAxes != null && themZero}
            showYou={!youZero}
          />
          {picked && cmp.isPending ? (
            <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0', textAlign: 'center' }}>
              Loading comparison with {picked.steam_name}…
            </p>
          ) : picked && noGames ? (
            <p className="muted" style={{ fontSize: 12.5, margin: '6px 0 0', textAlign: 'center', lineHeight: 1.45 }}>
              {picked.steam_name} has no games in this mode yet — pick another player.
            </p>
          ) : (
            <p className="muted" style={{ fontSize: 12.5, margin: '10px 0 0', textAlign: 'center', lineHeight: 1.45 }}>
              {caption}
              {!youZero && shownServed < shownAxes.length
                ? ` Partial — ${shownServed} of ${shownAxes.length} axes shown; the rest fill in as more matches land.`
                : ''}
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
              {picked && <ShareLinkButton url={compareShareUrl(id, picked.account_id)} />}
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

//Signature-curve view: Gap (default — your delta to the cohort median against a zero
//baseline) or Totals (today's absolute cumulative chart). Two 2-way toggles, not five.
const SIG_VIEWS = [
  { key: 'gap', label: 'Gap' },
  { key: 'totals', label: 'Totals' },
] as const;
type SigView = (typeof SIG_VIEWS)[number]['key'];

//THE signature coaching chart (C3): the player's OWN per-minute curve, FIXED, overlaid on a
//comparison cohort they pick. The LEAGUE selector (rank tier) and the HERO selector move
//ONLY the comparison line — `you` is invariant. Colours/caption words come from
//sigSeriesColor/useSigSeriesWords (both keyed to the active skin) so the legend, the
//caption, and the lines can never disagree — in any skin.
function SignatureCurvePanel({ id, chaseTier }: { id: number; chaseTier: number | null }) {
  const sigWords = useSigSeriesWords(); //active skin's series color words
  const [metric, setMetric] = useState<CurveMetric>('souls');
  const [view, setView] = useState<SigView>('gap');
  //league: undefined = "auto" (chaseTier — the rank you're chasing, lifted by the parent
  //off the profile badge); null = All ranks (vs_band omitted); number = a rank tier 0..11.
  const [band, setBand] = useState<number | null | undefined>(undefined);
  //hero: undefined = all heroes (no hero filter).
  const [hero, setHero] = useState<number | undefined>(undefined);

  const heroesPlayed = usePlayerHeroesPlayed(id);
  const effBand = band === undefined ? chaseTier : band; //null => All ranks

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
  //Gap needs a cohort; with none the delta is undefined, so force Totals (the ungated
  //you-line) and hide the Gap toggle — the panel never shows an empty Gap chart.
  const effView: SigView = hasCmp ? view : 'totals';

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

  //Only shown when a cohort exists (see effView) — reuses the metric toggle's control style,
  //so no new palette; on 360px the two 2-way toggles wrap onto a shared line under the selects.
  const viewToggle = hasCmp && (
    <div className="brkfilter" style={{ padding: 3, flexWrap: 'nowrap', flexShrink: 0 }}>
      {SIG_VIEWS.map((v) => (
        <button
          key={v.key}
          type="button"
          className={'minitog' + (view === v.key ? ' on' : '')}
          onClick={() => setView(v.key)}
          aria-pressed={view === v.key}
        >
          {v.label}
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
        <div className="flex" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {viewToggle}
          {metricToggle}
        </div>
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
          title="No per-minute line for this player yet"
          message="Player lines are built from the matches in the loaded data window; this player's line appears once a data fold covers their games."
          icon="chart"
        />
      ) : (
        <>
          <SignatureCurve data={points} mode={effView} youLabel="You" comparisonLabel={cmpLabel} metricLabel={noun} />
          {/* Caption colour words are driven by useSigSeriesWords/sigSeriesColor — the
              SAME skin-keyed source the chart lines read — so a word can never name a
              colour the line doesn't render (the C3 no-phantom-cyan guarantee), in any
              skin. The text is view-aware: Gap describes the delta line + baseline + band;
              Totals (and the null-comparison state) keep today's absolute-terms wording. */}
          {effView === 'gap' ? (
            <p className="muted" style={{ fontSize: 12.5, margin: '10px 0 0', lineHeight: 1.5 }}>
              The <b style={{ color: sigSeriesColor.you }}>{sigWords.you}</b> line is your{' '}
              <b style={{ color: sigSeriesColor.you }}>gap</b> to{' '}
              <b style={{ color: sigSeriesColor.comparison }}>{cmpLabel}</b> — how many {noun} you&rsquo;re{' '}
              <b style={{ color: 'var(--win)' }}>ahead</b> (above the baseline) or{' '}
              <b style={{ color: 'var(--loss)' }}>behind</b> (below it) at each minute. The{' '}
              <b style={{ color: sigSeriesColor.comparison }}>dashed baseline</b> is the cohort median; the shaded band
              is their middle 50% (25th–75th percentile), so riding above the band means you&rsquo;re beating
              three-quarters of them. Re-pick the league or hero and the gap is re-measured against that cohort.
            </p>
          ) : (
            <p className="muted" style={{ fontSize: 12.5, margin: '10px 0 0', lineHeight: 1.5 }}>
              The <b style={{ color: sigSeriesColor.you }}>{sigWords.you}</b> line is{' '}
              <b style={{ color: sigSeriesColor.you }}>you</b> — your real per-minute {noun}, and it stays put when you
              switch league or hero.{' '}
              {cmpLabel ? (
                <>
                  The <b style={{ color: sigSeriesColor.comparison }}>{sigWords.comparison} dashed</b> line is{' '}
                  <b style={{ color: sigSeriesColor.comparison }}>{cmpLabel}</b>
                   — the cohort you picked; the shaded
                  band is their 25th–75th percentile. Only this line moves when you change the selectors.
                </>
              ) : (
                <>
                  Pick a league to overlay the cohort you&rsquo;re chasing
                  {effBand != null ? ` — ${tierName}'s cohort has no per-minute sample yet` : ''}.
                </>
              )}
            </p>
          )}
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

//---- souls-by-source (migration 048) ----------------------------------------

//SOULS SOURCE — YOU VS TIER. Your own per-3-min souls-by-source stack beside your tier's, with souls
//lost to deaths as a line below zero (never mixed into the stack). The player line is ungated; the
//tier rides the rich-analytics tier (drawn only once it has folded). match_mode follows the page's
//Unranked/Ranked selector; game_mode is Normal-only server-side (Brawl gets the note).
function SoulsSourcePanel({ id, band }: { id: number; band?: number }) {
  const { matchMode } = useMatchMode();
  const player = usePlayerSoulsSources(id);
  const cohort = useCohortSoulsSources(band);
  const rows = buildSoulsSourceSeries(player.data, cohort.data);
  const cohortHas = hasCohortSouls(cohort.data);

  return (
    <div>
      <div className="label-xs" style={{ marginBottom: 12 }}>
        Souls source — you vs tier
      </div>
      {player.isPending ? (
        <Loading label="Loading your souls sources" />
      ) : player.isError ? (
        <EmptyState
          title="Souls-source breakdown not served yet"
          message={buildAheadMessage(
            player.error,
            'Per-source souls splits (lane creeps, neutrals, hero kills…) arrive with the rich-analytics tier.',
          )}
          icon="coins"
        />
      ) : isPlayerSoulsEmpty(player.data) ? (
        <EmptyState
          title="No folded matches yet"
          message="Your souls-by-source line appears once a data fold covers your matches."
          icon="coins"
        />
      ) : (
        <>
          <SoulsSourceChart data={rows} showTier={cohortHas} />
          <p className="muted" style={{ fontSize: 12.5, margin: '10px 0 0', lineHeight: 1.5 }}>
            Each colour is a souls source stacked into your net worth at that minute — <b>solid bars are you</b>,
            {cohortHas ? ' faded bars your tier' : ' your tier fills in with the rich-analytics tier'}. Souls{' '}
            <b style={{ color: 'var(--loss)' }}>lost to deaths</b> are the line below zero, never mixed into the stack.
            {matchMode === 'Ranked' ? ' Ranked matches only.' : ''}
          </p>
          <NormalOnlyNote what="Souls-source curves" />
        </>
      )}
    </div>
  );
}

export function EconomyPanel({ id }: { id: number }) {
  //'one_up' makes the "vs the rank you're chasing" kicker literally true — the
  //cohort is the tier directly above the player, not the player's own tier.
  const cmp = useCompare(id, { league_offset: 'one_up' });
  //ONE chasing tier, lifted off the profile badge (compare's one_up cohort equals it):
  //title, explanation line and the curve's LEAGUE default all derive from it.
  const profile = usePlayer(id);
  const chaseTier = chasingTier(profile.data?.badge);
  const chaseName = chaseTier != null ? getRank(chaseTier).name : null;
  const currentTier = rankFromBadge(profile.data?.badge)?.tier ?? null;
  const souls = cmp.data?.you.souls_per_min ?? null;
  const cohortSouls = cmp.data?.cohort.souls_per_min ?? null;
  const cohortTier = chaseName ?? cmp.data?.cohort.tier_name ?? null;
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
          {currentTier != null && chaseName != null && (
            <p className="faint" style={{ fontSize: 11, margin: '4px 0 0', lineHeight: 1.4 }}>
              The rank you&rsquo;re chasing = one league above your current rank ({getRank(currentTier).name} →{' '}
              {chaseName}). Change LEAGUE to compare against any other.
            </p>
          )}
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
          (+hero) cohort you pick — served by /players/:id/economy-curve. */}
      <SignatureCurvePanel id={id} chaseTier={chaseTier} />
      <div className="deco-rule" style={{ margin: '18px 0 14px' }}>
        <span className="dia" />
      </div>
      {/* Per-source souls stack (migration 048): where your net worth comes from, you vs your tier. */}
      <SoulsSourcePanel id={id} band={currentTier ?? undefined} />
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
export const humanize = (k: string) => METRIC_LABEL[k] ?? k.replace(/_/g, ' ');

export const SEV = {
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
