//Items index sticky rank bar — its own island so it can sit above <main>, where the
//prototype puts it (flush under the nav, full bleed).
import FilterBar from '../ui/FilterBar';
import { useItemsBracket } from '../../../lib/itemsIndexState';

interface ItemsFilterBarProps {
  currentPath: string;
  patch?: string | null;
  through?: string | null;
}

export default function ItemsFilterBar({ currentPath, patch, through }: ItemsFilterBarProps) {
  const { bracket, setBracket } = useItemsBracket();
  return (
    <FilterBar
      bracket={bracket}
      onBracketChange={setBracket}
      currentPath={currentPath}
      bleed
      patch={patch}
      through={through}
    />
  );
}
