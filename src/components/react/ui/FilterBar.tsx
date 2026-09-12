//The sticky rank / game-mode / freshness bar shared by the hero pages and the Items
//index (design 01 §2). Sticks BELOW the 60px nav — override via `top` when a page
//stacks another sticky row above it.
import BracketFilter, { type BracketValue } from './BracketFilter';
import GameModeToggle from './GameModeToggle';
import DataAgeChip from '../DataAgeChip';
import { getRank } from '../../../lib/ranks';
import { cssVars } from '../../../lib/cssVars';

//The 11 RANKED tiers; Obscurus(0) is the unranked bucket and is never a filter option.
const RANKED_TIERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export function bracketLabel(value: BracketValue): string {
  return value === 'all' ? 'All ranks' : getRank(value).name;
}

interface FilterBarProps {
  bracket: BracketValue;
  onBracketChange: (value: BracketValue) => void;
  currentPath?: string;
  tiers?: number[];
  top?: number;
}

export default function FilterBar({
  bracket,
  onBracketChange,
  currentPath = '',
  tiers = RANKED_TIERS,
  top,
}: FilterBarProps) {
  return (
    <div
      className="filterbar"
      style={top == null ? undefined : cssVars({ '--fb-top': `${top}px` })}
      data-badge="emblem-only"
    >
      <div className="filterbar-inner">
        <div className="filterbar-rank">
          <span className="kicker">Rank</span>
          <BracketFilter value={bracket} onChange={onBracketChange} tiers={tiers} />
          <span className="label-xs filterbar-label">{bracketLabel(bracket)}</span>
        </div>
        <div className="filterbar-right">
          <GameModeToggle currentPath={currentPath} />
          <DataAgeChip inline />
        </div>
      </div>
    </div>
  );
}
