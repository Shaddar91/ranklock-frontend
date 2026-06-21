//============================================================================
//Overview analytics panels (C5) — the dashboard centerpiece. All four read the
//build-ahead "rich-tier" endpoints (/improve, /compare) and EMPTY-STATE, never
//crash, when those endpoints 202 (computing) / 501 (disabled) / 404 (no data) —
//that is the expected state until the analytics pipeline serves them (§8.1).
//
//  • PlaystyleRadarPanel  — playstyle shape vs cohort, derived from /improve.
//  • EconomyPanel         — soul-curve-vs-cohort + gold-source breakdown. The
//                           per-minute timeline is an UNBUILT endpoint, so the
//                           two charts grey out; the served /compare souls/min
//                           headline still renders.
//  • CoachingPanel        — "how to climb" tips from /improve callouts.
//  • CategorizedSection   — Combat/Economy (from /improve) + Laning/Efficiency
//                           (from /compare), with a vs-bracket ⇄ compare toggle.
//============================================================================
import { useState } from 'react';
import { isComputing, isDisabled, isNotFound } from '../../../lib/apiClient';
import { useGameMode } from '../../../lib/useGameMode';
import { EmptyState, Icon } from '../ui/index';
import RadarChart from '../charts/RadarChart';
import { CatPanel } from './StatLine';
import { useCompare, useImprove } from './usePlayer';
import { combatRows, deriveRadar, economyRows, efficiencyRows, laningRows } from '../../../lib/playstyle';
import { count, fixed } from '../../../lib/format';

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

export function PlaystyleRadarPanel({ id }: { id: number }) {
  const { data, isPending, isError, error } = useImprove(id);
  const axes = data ? deriveRadar(data) : [];
  const servedCount = axes.filter((a) => a.served).length;

  return (
    <div className="brass-frame" style={{ padding: '18px 20px' }}>
      <span className="corner tl" />
      <span className="corner br" />
      <div style={{ marginBottom: 8 }}>
        <div className="kicker" style={{ marginBottom: 4 }}>
          Playstyle
        </div>
        <h2 className="h-sec" style={{ fontSize: 17 }}>
          Your shape vs the rank above
        </h2>
      </div>
      {isPending ? (
        <Loading label="Loading playstyle" />
      ) : isError || servedCount === 0 ? (
        <EmptyState title="Playstyle radar not served yet" message={buildAheadMessage(error)} icon="target" />
      ) : (
        <>
          <RadarChart data={axes.map((a) => ({ axis: a.axis, you: a.you, cohort: a.cohort }))} youLabel="You" cohortLabel="Tier p50" />
          <p className="muted" style={{ fontSize: 12.5, margin: '10px 0 0', textAlign: 'center', lineHeight: 1.45 }}>
            {servedCount < axes.length
              ? `Partial — ${servedCount} of ${axes.length} axes served; the rest fill in as the pipeline catches up.`
              : 'The 0.5 ring is the tier median; your blob bulges where you exceed it.'}
          </p>
        </>
      )}
      <NormalOnlyNote what="Playstyle axes" />
    </div>
  );
}

//---- signature economy view -------------------------------------------------

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
      {/* The per-minute timeline + per-source split are UNBUILT rich-tier
          endpoints — empty-state them (build-ahead) while keeping the layout. */}
      <EmptyState title="Per-minute soul curve not served yet" message="The match-timeline (per-minute souls vs tier) endpoint comes online with the analytics pipeline." icon="chart" />
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
