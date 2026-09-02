//Tier-list island (client:load on /tier-list). Astro server-renders it at build
//time from `initialRows`, so the six tier blocks are real HTML with no JS; the
//rank filter then refetches that band and re-grades it client-side.
import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, isComputing, queryKeys } from '../../lib/apiClient';
import { computingMessage } from '../../lib/apiStates';
import { useGameMode } from '../../lib/useGameMode';
import QueryProvider from './QueryProvider';
import { GameIcon, TierPill } from './ui/index';
import BracketFilter, { type BracketValue } from './ui/BracketFilter';
import { RANKS, getRank } from '../../lib/ranks';
import { heroPath } from '../../lib/heroSlugs';
import { count, pct, pickShare } from '../../lib/format';
import { gradedCount, tierBlocks, type TierBlock } from '../../lib/tierList';
import type { HeroSummary } from '../../types/api';

//Same 12-tier ladder the heroes table filters on (lib/ranks index === tier === badge/10).
const FULL_TIERS: number[] = RANKS.filter((r) => r.tier > 0).map((r) => r.tier);

const bandParam = (v: BracketValue): number | undefined => (v === 'all' ? undefined : v);

const bandLabel = (v: BracketValue): string => (v === 'all' ? 'all ranks' : getRank(v).name);

function blockSummary(block: TierBlock<HeroSummary>): string {
  const n = block.heroes.length;
  const heroes = `${n} ${n === 1 ? 'hero' : 'heroes'}`;
  const span =
    block.lowest === block.highest ? pct(block.highest) : `${pct(block.lowest)} to ${pct(block.highest)}`;
  return `${heroes}, ${span} win rate, ${count(block.picks)} picks.`;
}

function HeroCard({ hero, totalPicks }: { hero: HeroSummary; totalPicks: number }) {
  const winning = (hero.win_rate ?? 0) >= 50;
  return (
    <li className="tl-card">
      <a href={heroPath(hero.hero_name)}>
        <GameIcon kind="hero" name={hero.hero_name} src={hero.icon_url} size={36} />
        <span className="tl-card-body">
          <span className="display tl-card-name">{hero.hero_name}</span>
          <span className="tl-card-sub mono">
            <span>{pct(pickShare(hero.picks, totalPicks))} pick share</span>
            <span>{count(hero.picks)} picks</span>
          </span>
        </span>
        <span className={'tnum tl-card-wr' + (winning ? '' : ' tl-card-wr--low')} aria-label="Win rate">
          {pct(hero.win_rate)}
        </span>
      </a>
    </li>
  );
}

function TierListInner({ initialRows }: { initialRows: HeroSummary[] }) {
  const { mode } = useGameMode();
  const [band, setBand] = useState<BracketValue>('all');

  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.heroes({ band: band === 'all' ? 'all' : band, game_mode: mode }),
    queryFn: () => api.getHeroes({ band: bandParam(band), game_mode: mode }),
    //The build-time seed is the DEFAULT-mode all-ranks page, so it applies to that view only.
    initialData: band === 'all' && mode === 'Normal' ? initialRows : undefined,
    placeholderData: keepPreviousData,
  });

  const rows = useMemo(() => data ?? [], [data]);
  const blocks = useMemo(() => tierBlocks(rows), [rows]);
  const totalPicks = useMemo(() => rows.reduce((sum, h) => sum + (h.picks ?? 0), 0), [rows]);
  const graded = gradedCount(blocks);

  const emptyLine = isComputing(error)
    ? computingMessage('the hero win rates behind this tier list are being generated', error)
    : isError
      ? 'The stats API did not answer, so no hero could be graded on this view.'
      : isPending
        ? 'Loading hero win rates.'
        : `No hero has enough tracked matches at ${bandLabel(band)} to be graded.`;

  return (
    <div className="tl">
      <div className="between tl-controls">
        <span className="label-xs">Re-grade at your rank</span>
        <BracketFilter value={band} onChange={setBand} tiers={FULL_TIERS} />
      </div>

      {graded === 0 ? (
        <p className="tl-empty">{emptyLine}</p>
      ) : (
        <>
          <p className="tl-scope">
            {graded} heroes graded at {bandLabel(band)}.
          </p>
          {blocks.map((block) => (
            <section key={block.tier} className="tl-tier" aria-labelledby={`tier-${block.tier}`}>
              <header className="tl-tier-head">
                <span aria-hidden="true">
                  <TierPill tier={block.tier} />
                </span>
                <h2 className="h-sec" id={`tier-${block.tier}`}>
                  {block.tier} tier
                </h2>
                <span className="label-xs tl-cut">{block.label}</span>
              </header>
              {block.heroes.length === 0 ? (
                <p className="tl-tier-sum faint">No hero at {bandLabel(band)} grades {block.tier}.</p>
              ) : (
                <>
                  <p className="tl-tier-sum">{blockSummary(block)}</p>
                  <ul className="tl-cards">
                    {block.heroes.map((h) => (
                      <HeroCard key={h.hero_id} hero={h} totalPicks={totalPicks} />
                    ))}
                  </ul>
                </>
              )}
            </section>
          ))}
        </>
      )}
    </div>
  );
}

export default function TierListIsland({ initialRows }: { initialRows: HeroSummary[] }) {
  return (
    <QueryProvider>
      <TierListInner initialRows={initialRows} />
    </QueryProvider>
  );
}
