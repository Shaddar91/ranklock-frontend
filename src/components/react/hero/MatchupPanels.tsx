//Hero Overview §6 — worst/best matchups and duos, five rows each, with the
//delta-vs-expected column. Matchups follow the rank filter; duos have no rank axis
//upstream, so their panels say so instead of pretending to refilter.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../../lib/apiClient';
import { useGameMode } from '../../../lib/useGameMode';
import { bracketBucket, servedBandLabel, useHeroBracket } from '../../../lib/heroBracket';
import { duoRows, matchupRows, mergeMatchups, type DuoRow, type MatchupRow } from '../../../lib/heroOverview';
import { count } from '../../../lib/format';
import GameIcon from '../ui/GameIcon';
import SectionHeader from '../ui/SectionHeader';
import EmptyState from '../ui/EmptyState';
import type { HeroSummary, MatchupEntry } from '../../../types/api';

export interface MatchupPanelsProps {
  heroId: number;
  heroWinRate: number | null;
  roster: HeroSummary[];
  initialMatchups: MatchupEntry[];
  duos: { hero_id1: number; hero_id2: number; wins: number; matches_played: number }[];
}

type PanelRow = { id: number; name: string; iconUrl: string | null; winRate: number; matches: number; delta: number | null };

function Row({ row }: { row: PanelRow }) {
  const good = row.winRate >= 50;
  const fill = Math.max(0, Math.min(100, ((row.winRate - 30) / 40) * 100));
  return (
    <div className="mup-row">
      <span className="mup-hero">
        <GameIcon kind="hero" name={row.name} src={row.iconUrl} size={26} />
        <span className="display mup-name">{row.name}</span>
      </span>
      <span className="mup-wr">
        <span className="tnum" style={{ color: good ? 'var(--win)' : 'var(--loss)' }}>
          {row.winRate.toFixed(1)}%
        </span>
        <span className="wbar">
          <i style={{ width: `${fill}%`, background: good ? 'var(--win)' : 'var(--loss)' }} />
        </span>
      </span>
      <span className="tnum mup-delta" style={{ color: row.delta == null ? 'var(--faint)' : row.delta >= 0 ? 'var(--win)' : 'var(--loss)' }}>
        {row.delta == null ? '—' : `${row.delta >= 0 ? '+' : ''}${row.delta.toFixed(1)}`}
      </span>
      <span className="tnum mup-games">{count(row.matches)}</span>
    </div>
  );
}

function Panel({ title, rows, accent }: { title: string; rows: PanelRow[]; accent: string }) {
  return (
    <div className="panel mup-panel">
      <div className="mup-head">
        <span className="display" style={{ color: accent, fontWeight: 600, fontSize: 14 }}>
          {title}
        </span>
        <span className="label-xs">Win rate</span>
        <span className="label-xs mup-delta">Δ exp.</span>
        <span className="label-xs mup-games">Games</span>
      </div>
      {rows.map((r) => (
        <Row key={r.id} row={r} />
      ))}
    </div>
  );
}

export default function MatchupPanels({
  heroId,
  heroWinRate,
  roster,
  initialMatchups,
  duos,
}: MatchupPanelsProps) {
  const { bracket } = useHeroBracket();
  const { mode } = useGameMode();
  const bucket = bracketBucket(bracket);
  const isDefault = bucket == null && mode === 'Normal';

  const { data: rawMatchups = [] } = useQuery({
    queryKey: queryKeys.heroMatchups(heroId, bucket, mode),
    queryFn: () => api.getHeroMatchups(heroId, bucket, mode),
    initialData: isDefault ? initialMatchups : undefined,
    staleTime: 5 * 60_000,
  });

  const byId = useMemo(() => new Map(roster.map((h) => [h.hero_id, h])), [roster]);

  const ranked: MatchupRow[] = useMemo(
    () => matchupRows(mergeMatchups(rawMatchups), heroWinRate, byId),
    [rawMatchups, heroWinRate, byId],
  );

  const allDuos: DuoRow[] = useMemo(
    () => duoRows(duos, heroId, heroWinRate, byId),
    [duos, heroId, heroWinRate, byId],
  );

  const toPanelRow = (r: MatchupRow): PanelRow => ({ ...r, id: r.opponentId });
  const duoPanelRow = (r: DuoRow): PanelRow => ({ ...r, id: r.partnerId });

  const note = `Δ = win rate minus the rate both heroes' overall win rates predict · ${servedBandLabel(bracket)} · duos are all ranks (upstream serves no rank axis for them)`;

  return (
    <section id="matchups">
      <SectionHeader kicker="Who beats it, who helps it" title="Matchups and duos" note={note} />
      {ranked.length === 0 && allDuos.length === 0 ? (
        <EmptyState title="Computing" message="Matchup aggregates are still folding. This block refreshes hourly." />
      ) : (
        <div className="mup-grid">
          {ranked.length > 0 && (
            <>
              <Panel title="Worst matchups" accent="var(--loss)" rows={[...ranked].reverse().slice(0, 5).map(toPanelRow)} />
              <Panel title="Best matchups" accent="var(--win)" rows={ranked.slice(0, 5).map(toPanelRow)} />
            </>
          )}
          {allDuos.length > 0 && (
            <>
              <Panel title="Best duos" accent="var(--win)" rows={allDuos.slice(0, 5).map(duoPanelRow)} />
              <Panel title="Worst duos" accent="var(--loss)" rows={[...allDuos].reverse().slice(0, 5).map(duoPanelRow)} />
            </>
          )}
        </div>
      )}
    </section>
  );
}
