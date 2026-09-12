//Hero Overview §6-§9 as one hydration root: the blocks that answer the sticky rank
//filter (matchups, item buys) plus the patch/editorial/footnote rows that must stay in
//DOM order after them. Astro server-renders it, so the static HTML is unchanged.
import QueryProvider from '../QueryProvider';
import MatchupPanels, { type MatchupPanelsProps } from './MatchupPanels';
import HeroItemTables, { type HeroItemTablesProps } from './HeroItemTables';
import PatchHistory, { type PatchHistoryProps } from './PatchHistory';
import { servedBandLabel, useHeroBracket } from '../../../lib/heroBracket';
import { useGameMode } from '../../../lib/useGameMode';

export interface HeroFootnoteStrings {
  matchWindow: string;
  itemWindow: string;
  kitPatch: string;
  abilityOrderFloor: number | null;
}

export interface HeroMetaIslandProps {
  matchups: MatchupPanelsProps;
  items: HeroItemTablesProps;
  patches: PatchHistoryProps;
  footnote: HeroFootnoteStrings;
}

function Footnote({ footnote }: { footnote: HeroFootnoteStrings }) {
  const { bracket } = useHeroBracket();
  const { mode } = useGameMode();
  const modeLabel = mode === 'StreetBrawl' ? 'Street Brawl' : 'Normal';
  const floor =
    footnote.abilityOrderFloor == null
      ? ''
      : `, ability orders under ${footnote.abilityOrderFloor.toLocaleString('en-US')} matches hidden`;
  return (
    <p className="hero-footnote">
      {`Win rates, KDA, souls, matchups and item buys: RankLock public matches · ${modeLabel} · ${servedBandLabel(bracket)} · ${footnote.matchWindow}. ` +
        `Item win rates and ability orders: deadlock-api.com aggregates, ${footnote.itemWindow}${floor}; the sample sits beside every rate. ` +
        `Kit and base stats: client ${footnote.kitPatch}. Rank means badge tier, never an MMR number.`}
    </p>
  );
}

export default function HeroMetaIsland({ matchups, items, patches, footnote }: HeroMetaIslandProps) {
  return (
    <QueryProvider>
      <div className="hero-meta">
        <MatchupPanels {...matchups} />
        <HeroItemTables {...items} />
        <PatchHistory {...patches} />
        <Footnote footnote={footnote} />
      </div>
    </QueryProvider>
  );
}
