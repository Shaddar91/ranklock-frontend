//Hero Overview §2 — the sticky rank bar. Its own island so the sections between it and
//the data panels stay static HTML; both roots read one bracket from the shared store.
import FilterBar from '../ui/FilterBar';
import { useHeroBracket } from '../../../lib/heroBracket';

interface HeroFilterBarProps {
  currentPath: string;
  patch?: string | null;
  through?: string | null;
}

export default function HeroFilterBar({ currentPath, patch, through }: HeroFilterBarProps) {
  const { bracket, setBracket } = useHeroBracket();
  return <FilterBar bracket={bracket} onBracketChange={setBracket} currentPath={currentPath} bleed patch={patch} through={through} />;
}
