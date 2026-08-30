//Unranked/Ranked match_mode control (ranked-axis 047) — flips the shared ?ranked= store via
//useMatchMode. Mounted only where the API serves per match_mode: leaderboard + player breakdowns.
import { useMatchMode } from '../../../lib/useMatchMode';
import type { MatchMode } from '../../../types/api';

export default function MatchModeToggle({ ariaLabel = 'Match mode' }: { ariaLabel?: string }) {
  const { matchMode, setMatchMode } = useMatchMode();
  const opt = (value: MatchMode, label: string) => (
    <button
      type="button"
      className={'minitog' + (matchMode === value ? ' on' : '')}
      aria-pressed={matchMode === value}
      onClick={() => setMatchMode(value)}
    >
      {label}
    </button>
  );
  return (
    <div className="brkfilter gm-toggle" role="group" aria-label={ariaLabel}>
      {opt('Unranked', 'Unranked')}
      {opt('Ranked', 'Ranked')}
    </div>
  );
}
