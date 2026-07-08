//Heroes meta table island (mount with client:load on /heroes).
//
//SSG-friendly: the page fetches the default ("all ranks") rows at BUILD time and
//passes them as `initialRows`; React Query is seeded with them as `initialData`,
//so this island's FIRST (server) render already contains the real table markup —
//the SEO HTML has hero names + win-rates present without JS (the success
//criterion). Switching the rank tier then refetches that band client-side
//(api.getHeroes({ band }), band = badge/10 0..11); `keepPreviousData` avoids a flash.
import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../lib/apiClient';
import { useGameMode } from '../../lib/useGameMode';
import QueryProvider from './QueryProvider';
import { DataTable, type DataTableColumn, GameIcon, WinBar, TierPill } from './ui/index';
import BracketFilter, { type BracketValue } from './ui/BracketFilter';
import { RANKS } from '../../lib/ranks';
import { DASH, fixed, kda, metaTier, pct, pickShare } from '../../lib/format';
import type { HeroSummary } from '../../types/api';

//The full 12-tier rank ladder (Obscurus…Eternus) drives the rank selector — the SAME ladder
//Lane Lab uses (lib/ranks RANKS index === tier === badge/10). Heroes previously exposed only the
//coarse 4-way low/mid/high/top buckets; migration 025's hero_band_mv serves one row per band, so
//the two selectors now share an identical rank set (ranklock-bug-heroes-page C3).
const FULL_TIERS: number[] = RANKS.filter((r) => r.tier > 0).map((r) => r.tier);

//A BracketValue → the API's `band` param (undefined for 'all' so the call omits the param and the
//backend serves the all-ranks hero_summary_mv). Mirrors LaneLabIsland's bandParam.
const bandParam = (v: BracketValue): number | undefined => (v === 'all' ? undefined : v);

function HeroCell({ hero }: { hero: HeroSummary }) {
  return (
    <a className="flex" href={`/heroes/${hero.hero_id}`} style={{ alignItems: 'center', gap: 10, textDecoration: 'none' }}>
      <GameIcon kind="hero" name={hero.hero_name} src={hero.icon_url} size={30} />
      <span className="display" style={{ fontWeight: 600, color: 'var(--text)' }}>
        {hero.hero_name}
      </span>
    </a>
  );
}

function HeroesTableInner({ initialRows }: { initialRows: HeroSummary[] }) {
  const { mode } = useGameMode();
  const [band, setBand] = useState<BracketValue>('all');

  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.heroes({ band: band === 'all' ? 'all' : band, game_mode: mode }),
    queryFn: () => api.getHeroes({ band: bandParam(band), game_mode: mode }),
    //The SSG seed is the DEFAULT-mode "all ranks" page — only apply it to that exact
    //view, so a `?mode=brawl` deep-link never paints Brawl-keyed rows from a Normal seed.
    initialData: band === 'all' && mode === 'Normal' ? initialRows : undefined,
    placeholderData: keepPreviousData,
  });

  const rows = data ?? [];
  const totalPicks = useMemo(() => rows.reduce((sum, h) => sum + (h.picks ?? 0), 0), [rows]);

  const columns = useMemo<DataTableColumn<HeroSummary>[]>(
    () => [
      { key: 'hero', header: 'Hero', sortValue: (h) => h.hero_name, render: (h) => <HeroCell hero={h} /> },
      {
        key: 'tier',
        header: 'Tier',
        sortValue: (h) => h.win_rate,
        render: (h) => {
          const t = metaTier(h.win_rate);
          return t ? <TierPill tier={t} /> : <span className="faint">{DASH}</span>;
        },
      },
      {
        key: 'wr',
        header: 'Win rate',
        numeric: true,
        sortValue: (h) => h.win_rate,
        render: (h) => (h.win_rate == null ? <span className="faint">{DASH}</span> : <WinBar wr={h.win_rate} />),
      },
      // NOTE: the "7d" (delta_win_rate_7d, 7-day win-rate momentum) column was removed — the backend
      // never populates that field yet (the win-rate-history snapshot it needs isn't built), so it was
      // always a cryptic, empty "—". Re-add with a clear "7-day Δ" header + tooltip once the momentum
      // producer exists. (Delta import kept for when it returns.)
      {
        key: 'pick',
        header: 'Pick %',
        numeric: true,
        sortValue: (h) => h.picks,
        render: (h) => <span className="tnum">{pct(pickShare(h.picks, totalPicks))}</span>,
      },
      {
        key: 'kda',
        header: 'KDA',
        numeric: true,
        sortValue: (h) => kda(h.avg_kills, h.avg_deaths, h.avg_assists),
        render: (h) => <span className="tnum">{fixed(kda(h.avg_kills, h.avg_deaths, h.avg_assists))}</span>,
      },
    ],
    [totalPicks],
  );

  return (
    <div>
      <div className="between" style={{ marginBottom: 14, gap: 16, flexWrap: 'wrap' }}>
        <span className="label-xs">Meta at your rank</span>
        <BracketFilter value={band} onChange={setBand} tiers={FULL_TIERS} />
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(h) => h.hero_id}
        loading={isPending}
        initialSort={{ key: 'wr', dir: -1 }}
        caption="Hero meta — win rate, pick rate and KDA by rank tier"
        emptyTitle={isError ? 'Hero meta unavailable' : 'No heroes for this rank yet'}
        emptyMessage={
          isError
            ? 'The stats API is offline — the meta table fills in when it comes back online.'
            : 'Nothing served for this rank tier yet. Try another rank or check back after the next data refresh. Low ranks are sampled thinly.'
        }
      />
    </div>
  );
}

export default function HeroesTable({ initialRows }: { initialRows: HeroSummary[] }) {
  return (
    <QueryProvider>
      <HeroesTableInner initialRows={initialRows} />
    </QueryProvider>
  );
}
