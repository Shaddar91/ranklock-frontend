//============================================================================
//Patch tracking island (C9) — the /patches* surface (§A.4: "fully built, zero
//frontend references — largest backend-ahead block"). ONE island mounted on
///patches. Lists the tracked patches, and for the selected patch shows its notes,
//the per-bracket pick-rate MOVERS (gainers / losers), and the full hero stat
//table. Build-ahead: every tier empty-states until the patch ingestion job has
//populated analytics.patch_hero_stats (requirements §8.1) — never white-screens.
//
//Scale note: patch_hero_stats stores win_rate / pick_rate / deltas as FRACTIONS
//(decimal 0–1, per deadlock-analytics). The UI multiplies by 100 for display.
//============================================================================
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, isComputing, queryKeys } from '../../lib/apiClient';
import { computingMessage } from '../../lib/apiStates';
import { isOldestPatch } from '../../lib/patches';
import { useGameMode } from '../../lib/useGameMode';
import QueryProvider from './QueryProvider';
import { Chip, DataTable, type DataTableColumn, Delta, EmptyState, GameIcon, WinBar } from './ui/index';
import BucketFilter from './ui/BucketFilter';
import { ITEM_BUCKETS, type RankBucket } from '../../lib/brackets';
import { count, DASH, pct, shortDate } from '../../lib/format';
import type { Patch, PatchHeroStat } from '../../types/api';

//A single mover line: portrait + name + win-rate + signed pick-rate delta.
function MoverRow({ s }: { s: PatchHeroStat }) {
  return (
    <div className="flex" style={{ alignItems: 'center', gap: 10, padding: '7px 0', borderTop: '1px solid var(--border)' }}>
      <GameIcon kind="hero" name={s.hero_name} src={s.icon_url} size={28} />
      <a href={`/heroes/${s.hero_id}/`} className="display" style={{ flex: 1, minWidth: 0, fontWeight: 600, color: 'var(--text)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {s.hero_name}
      </a>
      <span className="tnum faint" style={{ fontSize: 12 }}>{pct(s.win_rate == null ? null : s.win_rate * 100)}</span>
      {s.delta_pick_rate == null ? <span className="faint">{DASH}</span> : <Delta value={s.delta_pick_rate * 100} />}
    </div>
  );
}

function MoversColumn({
  title,
  rows,
  tone,
  oldestPatch,
}: {
  title: string;
  rows: PatchHeroStat[];
  tone: 'win' | 'loss';
  oldestPatch: boolean;
}) {
  //"No gainers for this bracket" implies other brackets differ; on the OLDEST
  //tracked patch the truth is structural — nothing earlier exists to diff (B8).
  const emptyLine = oldestPatch
    ? 'First tracked patch — no earlier patch to compare against.'
    : `No ${tone === 'win' ? 'gainers' : 'losers'} for this bracket.`;
  return (
    <div className="panel" style={{ padding: '14px 16px' }}>
      <div className="between" style={{ marginBottom: 4 }}>
        <span className="label-xs">{title}</span>
        <Chip tone={tone}>{rows.length}</Chip>
      </div>
      {rows.length === 0 ? (
        <p className="faint" style={{ fontSize: 12, padding: '8px 0' }}>{emptyLine}</p>
      ) : (
        rows.map((s) => <MoverRow key={s.hero_id} s={s} />)
      )}
    </div>
  );
}

function PatchTrackerInner({ initialPatches }: { initialPatches: Patch[] }) {
  const { mode } = useGameMode();
  //The patch LIST is mode-agnostic (it's the set of tracked patches); only the
  //per-patch hero stats + movers are mode-separated (patch_hero_stats — 022).
  const patchesQ = useQuery({
    queryKey: queryKeys.patches(),
    queryFn: api.getPatches,
    initialData: initialPatches.length > 0 ? initialPatches : undefined,
  });
  const patches = useMemo(
    () => [...(patchesQ.data ?? [])].sort((a, b) => b.released_at.localeCompare(a.released_at)),
    [patchesQ.data],
  );

  //Selected patch defaults to the current (open) patch, else the newest.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeId = selectedId ?? patches.find((p) => p.is_current)?.patch_id ?? patches[0]?.patch_id ?? null;

  //Bracket filter — patches use the SAME integer 0–5 badge buckets as items
  //(0 = all). Reuse the items bucket model + emblem filter.
  const [bucket, setBucket] = useState<RankBucket['key']>(0);
  const bracket = typeof bucket === 'number' ? bucket : 0;

  const detailQ = useQuery({
    queryKey: queryKeys.patch(activeId ?? '', { bracket, game_mode: mode }),
    queryFn: () => api.getPatch(activeId as string, bracket, mode),
    enabled: !!activeId,
  });
  const moversQ = useQuery({
    queryKey: queryKeys.patchMovers(activeId ?? '', { bracket, game_mode: mode }),
    queryFn: () => api.getPatchMovers(activeId as string, { bracket, game_mode: mode }),
    enabled: !!activeId,
  });

  const heroColumns = useMemo<DataTableColumn<PatchHeroStat>[]>(
    () => [
      {
        key: 'hero',
        header: 'Hero',
        sortValue: (h) => h.hero_name,
        render: (h) => (
          <a className="flex" href={`/heroes/${h.hero_id}/`} style={{ alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <GameIcon kind="hero" name={h.hero_name} src={h.icon_url} size={28} />
            <span className="display" style={{ fontWeight: 600, color: 'var(--text)' }}>{h.hero_name}</span>
          </a>
        ),
      },
      {
        key: 'wr',
        header: 'Win rate',
        numeric: true,
        sortValue: (h) => h.win_rate,
        render: (h) => (h.win_rate == null ? <span className="faint">{DASH}</span> : <WinBar wr={h.win_rate * 100} />),
      },
      {
        key: 'dwr',
        header: 'Δ win',
        numeric: true,
        sortValue: (h) => h.delta_win_rate,
        render: (h) => (h.delta_win_rate == null ? <span className="faint">{DASH}</span> : <Delta value={h.delta_win_rate * 100} />),
      },
      {
        key: 'pick',
        header: (
          <span title="Presence: share of matches the hero appears in; sums to ~1200% across all heroes">
            Presence
          </span>
        ),
        numeric: true,
        sortValue: (h) => h.pick_rate,
        render: (h) => <span className="tnum">{pct(h.pick_rate * 100)}</span>,
      },
      {
        key: 'dpick',
        header: 'Δ pick',
        numeric: true,
        sortValue: (h) => h.delta_pick_rate,
        render: (h) => (h.delta_pick_rate == null ? <span className="faint">{DASH}</span> : <Delta value={h.delta_pick_rate * 100} />),
      },
      {
        key: 'matches',
        header: 'Matches',
        numeric: true,
        sortValue: (h) => h.matches,
        render: (h) => <span className="tnum faint">{count(h.matches)}</span>,
      },
    ],
    [],
  );

  if (patchesQ.isPending) return <p className="muted">Loading patches…</p>;
  if (patchesQ.isError || patches.length === 0) {
    return (
      <EmptyState
        title="No patches tracked yet"
        message="Patches appear here once the first patch data arrives."
        icon="inbox"
      />
    );
  }

  const active = patches.find((p) => p.patch_id === activeId) ?? null;
  const movers = moversQ.data;
  const heroStats = detailQ.data?.hero_stats ?? [];
  //The first tracked patch structurally has no movers — no earlier patch to
  //diff against (B8). Drives honest empty-state copy in both movers surfaces.
  const oldestSelected = isOldestPatch(patches, activeId);

  return (
    <div className="grid" style={{ gap: 20 }}>
      {/* patch picker + bracket filter */}
      <div className="between" style={{ gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label className="flex" style={{ alignItems: 'center', gap: 8 }}>
          <span className="label-xs">Patch</span>
          <select
            className="field"
            style={{ width: 'auto', padding: '8px 12px' }}
            value={activeId ?? ''}
            onChange={(e) => setSelectedId(e.target.value)}
            aria-label="Select a patch"
          >
            {patches.map((p) => (
              <option key={p.patch_id} value={p.patch_id}>
                {p.version_label}
                {p.is_current ? ' (current)' : ''}
              </option>
            ))}
          </select>
        </label>
        <BucketFilter buckets={ITEM_BUCKETS} value={bucket} onChange={setBucket} ariaLabel="Patch stats by rank" />
      </div>

      {/* active patch header */}
      {active && (
        <div className="panel" style={{ padding: '16px 20px' }}>
          <div className="flex" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
            <h2 className="display" style={{ fontSize: 20, fontWeight: 700 }}>{active.version_label}</h2>
            {active.is_current && <Chip tone="gold">Current</Chip>}
            <span className="mono faint" style={{ fontSize: 12 }}>Released {shortDate(active.released_at) || DASH}</span>
            {active.ended_at && <span className="mono faint" style={{ fontSize: 12 }}>· Ended {shortDate(active.ended_at)}</span>}
          </div>
          {active.notes_summary && (
            <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.55, margin: '4px 0 0' }}>{active.notes_summary}</p>
          )}
          {active.notes_url && (
            <p style={{ margin: '8px 0 0' }}>
              <a href={active.notes_url} target="_blank" rel="noopener noreferrer" className="mono" style={{ fontSize: 12, color: 'var(--cyan)' }}>
                Full patch notes →
              </a>
            </p>
          )}
        </div>
      )}

      {/* movers */}
      <div>
        <h2 className="h-sec" style={{ fontSize: 16, margin: '0 0 10px' }}>Biggest movers</h2>
        {moversQ.isPending ? (
          <p className="muted">Loading movers…</p>
        ) : isComputing(moversQ.error) ? (
          //202 = the API is up and deliberately gating (freshness gate / first
          //compute) — never call that "offline" (B3).
          <EmptyState
            title="Movers are computing"
            message={computingMessage('patch movers are being generated', moversQ.error)}
            icon="chart"
          />
        ) : moversQ.isError || !movers || (movers.gainers.length === 0 && movers.losers.length === 0) ? (
          oldestSelected ? (
            <EmptyState
              title="First tracked patch"
              message="No earlier patch to compare against — pick-rate movers start with the second tracked patch."
              icon="chart"
            />
          ) : (
            <EmptyState
              title="No movers for this patch yet"
              message="Pick-rate gainers and losers need an earlier patch with hero stats to diff against — none is available yet."
              icon="chart"
            />
          )
        ) : (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
            <MoversColumn title="Rising" rows={movers.gainers} tone="win" oldestPatch={oldestSelected} />
            <MoversColumn title="Falling" rows={movers.losers} tone="loss" oldestPatch={oldestSelected} />
          </div>
        )}
      </div>

      {/* full hero stat table */}
      <div>
        <h2 className="h-sec" style={{ fontSize: 16, margin: '0 0 10px' }}>Hero stats this patch</h2>
        <DataTable
          columns={heroColumns}
          rows={heroStats}
          rowKey={(h) => h.hero_id}
          loading={detailQ.isPending}
          initialSort={{ key: 'pick', dir: -1 }}
          caption="Per-hero win-rate, pick-rate and patch-over-patch deltas"
          emptyTitle={
            //202 = healthy, deliberately gating — "offline" is reserved for real
            //network/5xx failure (B3).
            isComputing(detailQ.error)
              ? 'Patch stats are computing'
              : detailQ.isError
                ? 'Patch stats unavailable'
                : 'No hero stats for this bracket yet'
          }
          emptyMessage={
            isComputing(detailQ.error)
              ? computingMessage('patch hero stats are being generated', detailQ.error)
              : detailQ.isError
                ? 'The stats API is offline — patch hero stats fill in when it comes back.'
                : 'No data for this patch and bracket yet. Try another bracket or check back after the next refresh.'
          }
        />
      </div>
    </div>
  );
}

export default function PatchTrackerIsland({ initialPatches = [] }: { initialPatches?: Patch[] }) {
  return (
    <QueryProvider>
      <PatchTrackerInner initialPatches={initialPatches} />
    </QueryProvider>
  );
}
