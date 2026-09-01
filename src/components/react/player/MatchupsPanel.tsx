//Profile Overview matchups panel: for the player's three most-played heroes, the
//worst matchups (who counters them) at a selected rank, from the shared
///heroes/{id}/matchups cohort fold. Honest-empty per card and whole-panel — it
//shows only what the fold serves and states the data-through window.
import { useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../../lib/apiClient';
import { useGameMode } from '../../../lib/useGameMode';
import { EmptyState, GameIcon } from '../ui/index';
import { usePlayer, usePlayerHeroesPlayed } from './usePlayer';
import { buildAheadMessage } from './AnalyticsPanels';
import { ITEM_BUCKETS } from '../../../lib/brackets';
import { count, pct, shortDate } from '../../../lib/format';
import {
  defaultBucketForBadge,
  matchupWindowHi,
  panelState,
  topPlayedHeroes,
  type CardState,
  type CounterRow,
} from '../../../lib/matchupGrid';
import type { HeroSummary } from '../../../types/api';

const COUNTERS_PER_HERO = 5;

//Inline win-rate readout mirroring WinRate.astro (same 30–70% band + win/loss
//semantics) — the Astro component can't render inside this React island.
function WinRateCell({ wrPct }: { wrPct: number }) {
  const good = wrPct >= 50;
  const fill = Math.max(0, Math.min(100, ((wrPct - 30) / 40) * 100));
  return (
    <span className="flex" style={{ alignItems: 'center', gap: 9, justifyContent: 'flex-end' }}>
      <span className="tnum" style={{ color: good ? 'var(--win)' : 'var(--loss)', fontWeight: 600, minWidth: 46, textAlign: 'right' }}>
        {pct(wrPct)}
      </span>
      <span className="wbar" style={{ width: 64 }}>
        <i style={{ width: `${fill}%`, background: good ? 'linear-gradient(90deg,#1f8a5b,var(--win))' : 'linear-gradient(90deg,#b13a3a,var(--loss))' }} />
      </span>
    </span>
  );
}

function CounterGrid({ rows }: { rows: CounterRow[] }) {
  return (
    <div className="dt-scroll">
      <table className="dt">
        <thead>
          <tr>
            <th><span className="th-static">Opponent</span></th>
            <th className="num"><span className="th-static">Win rate</span></th>
            <th className="num"><span className="th-static">Matches</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.heroBId}>
              <td>
                <span className="flex" style={{ alignItems: 'center', gap: 9 }}>
                  <GameIcon kind="hero" name={r.name} src={r.iconUrl} size={28} />
                  <span className="display" style={{ fontWeight: 600, color: 'var(--text)' }}>vs {r.name}</span>
                </span>
              </td>
              <td className="num"><WinRateCell wrPct={r.wrPct} /></td>
              <td className="num"><span className="tnum">{count(r.matches)}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function cardMessage(card: CardState): string {
  if (card.kind === 'empty') return `No matchup data for ${card.hero.hero_name} at this rank yet.`;
  if (card.kind === 'computing' || card.kind === 'disabled' || card.kind === 'error') return buildAheadMessage(card.error);
  return '';
}

function HeroCard({ card }: { card: CardState }) {
  return (
    <div className="panel" style={{ padding: '14px 16px' }}>
      <h3 className="h-sec" style={{ fontSize: 14, marginBottom: 10 }}>
        Your {card.hero.hero_name} — {count(card.hero.matches_played)} matches
      </h3>
      {card.kind === 'loading' ? (
        <p className="muted" style={{ padding: '10px 2px' }}>Loading…</p>
      ) : card.kind === 'rows' ? (
        <CounterGrid rows={card.rows} />
      ) : (
        <p className="muted" style={{ fontSize: 12.5, padding: '4px 2px', lineHeight: 1.45 }}>{cardMessage(card)}</p>
      )}
    </div>
  );
}

export default function MatchupsPanel({ id }: { id: number }) {
  const { mode } = useGameMode();
  const profile = usePlayer(id);
  const heroesPlayed = usePlayerHeroesPlayed(id);
  //null = not yet chosen -> open on the player's own rank; a pick then sticks.
  const [pickedBucket, setPickedBucket] = useState<number | null>(null);
  const bucket = pickedBucket ?? defaultBucketForBadge(profile.data?.badge);

  const top3 = topPlayedHeroes(heroesPlayed.data, 3);

  const roster = useQuery<HeroSummary[]>({ queryKey: queryKeys.heroes(), queryFn: () => api.getHeroes() });
  const heroById = new Map((roster.data ?? []).map((h) => [h.hero_id, h] as const));

  const matchupQueries = useQueries({
    queries: top3.map((h) => ({
      queryKey: queryKeys.heroMatchups(h.hero_id, bucket, mode),
      queryFn: () => api.getHeroMatchups(h.hero_id, bucket, mode),
      retry: false,
    })),
  });

  //useQueries returns one result per query in order, so matchupQueries[i] is defined for every top3[i].
  const cards = top3.map((hero, i) => ({ hero, query: matchupQueries[i]! }));
  const state = panelState(heroesPlayed, cards, heroById, COUNTERS_PER_HERO);

  const horizon = useQuery({ queryKey: queryKeys.dataHorizon(), queryFn: () => api.getDataHorizon() });
  const windowHi = matchupWindowHi(horizon.data);
  const through = windowHi ? shortDate(windowHi) : '';

  return (
    <div className="brass-frame" style={{ padding: '18px 20px' }}>
      <span className="corner tl" />
      <span className="corner br" />
      <div className="between" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="kicker" style={{ marginBottom: 4 }}>Matchups</div>
          <h2 className="h-sec" style={{ fontSize: 17 }}>Who counters your heroes</h2>
        </div>
        <label className="flex" style={{ alignItems: 'center', gap: 8 }}>
          <span className="label-xs">Rank</span>
          <select
            className="field"
            style={{ width: 'auto', padding: '7px 10px' }}
            value={String(bucket)}
            onChange={(e) => setPickedBucket(Number(e.target.value))}
            aria-label="Choose the rank to read matchups at"
          >
            {ITEM_BUCKETS.map((b) => (
              <option key={String(b.key)} value={String(b.key)}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="faint" style={{ fontSize: 11, margin: '0 0 14px', lineHeight: 1.45 }}>
        Lowest win rates for your three most-played heroes at the selected rank. Rates are all players&rsquo; games on that hero at that rank — not this player&rsquo;s record.
        {through ? ` Data through ${through}.` : ''}
      </p>

      {state.kind === 'loading' ? (
        <p className="muted" style={{ padding: '14px 2px' }}>Loading matchups…</p>
      ) : state.kind === 'error' ? (
        <EmptyState title="Matchups not available yet" message={buildAheadMessage(state.error)} icon="swords" />
      ) : state.kind === 'empty' ? (
        <EmptyState title="No matchups yet" message="No matches recorded for this player yet." icon="swords" />
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
          {state.cards.map((c) => (
            <HeroCard key={c.hero.hero_id} card={c} />
          ))}
        </div>
      )}
    </div>
  );
}
