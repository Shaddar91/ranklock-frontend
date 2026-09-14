//Heroes index sticky rank bar — its own island so it sits above <main>, flush under the nav.
import FilterBar from '../ui/FilterBar';
import { useHeroesBracket } from '../../../lib/heroesIndexState';
import { RANKS } from '../../../lib/ranks';

const TIERS: number[] = RANKS.filter((r) => r.tier > 0).map((r) => r.tier);

interface HeroesFilterBarProps {
  currentPath: string;
  patch?: string | null;
  through?: string | null;
}

export default function HeroesFilterBar({ currentPath, patch, through }: HeroesFilterBarProps) {
  const { bracket, setBracket } = useHeroesBracket();
  return (
    <FilterBar
      bracket={bracket}
      onBracketChange={setBracket}
      currentPath={currentPath}
      tiers={TIERS}
      bleed
      patch={patch}
      through={through}
    />
  );
}
