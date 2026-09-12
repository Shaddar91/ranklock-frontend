//Hero Overview §2 — the sticky rank bar. Its own island so the sections between it and
//the data panels stay static HTML; both roots read one bracket from the shared store.
import FilterBar from '../ui/FilterBar';
import { useHeroBracket } from '../../../lib/heroBracket';

export default function HeroFilterBar({ currentPath }: { currentPath: string }) {
  const { bracket, setBracket } = useHeroBracket();
  return <FilterBar bracket={bracket} onBracketChange={setBracket} currentPath={currentPath} />;
}
