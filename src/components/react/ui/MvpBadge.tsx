//Per-match MVP ranking (1 = best on the team → brass). Rank 1 also gets a trophy
//glyph so first place reads without relying on the brass color.
import Icon from './Icon';

interface MvpBadgeProps {
  rank: number;
  outOf?: number;
}

export default function MvpBadge({ rank, outOf = 6 }: MvpBadgeProps) {
  const top = rank <= 1;
  return (
    <span className={'mvp' + (top ? ' top' : '')} title={`MVP rank ${rank} / ${outOf}`}>
      {top ? <Icon name="trophy" size={11} /> : null}
      {rank}
    </span>
  );
}
