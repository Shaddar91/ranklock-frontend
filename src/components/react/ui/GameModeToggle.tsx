//Global Normal/Brawl game-mode segmented control (migration 022). Mounted next to
//the table filters on the mode-separated meta pages — Heroes, Tier list, Items,
//Leaderboard and Patches — and flips the shared `?mode=` store via useGameMode so every aggregate
//island re-reads + refetches in lockstep (the store is URL-backed, so an in-page
//toggle drives the islands exactly as the old header-mounted one did). Styled with the
//codebase's .brkfilter/.minitog segmented-control vocabulary.
//
//Kept OFF every other surface, and it must stay off: the player profile (/players/*)
//is identity, which is mode-AGNOSTIC — a Brawl filter blanked it for accounts with
//zero Brawl games — and /matches/* per-match lists carry no mode. Do not re-add it there.
//
//Only the two COMPETITIVE modes are ever offered — non-competitive modes
//(CoopBot/PrivateLobby/Tutorial/…) are excluded from stats and never surface here.
//
//Normal-only surfaces: lane analytics (Lane Lab) have no Brawl meaning (laning /
//9-minute / duration concepts), so on those routes the toggle HARD-GATES to Normal
//and says so in copy — it never silently implies a Brawl view exists there.
import { useGameMode } from '../../../lib/useGameMode';

//Route prefixes whose data is Normal-only — the toggle locks to Normal here. Lane
//Lab is the lane-analytics surface; the Improve/coaching panels are Normal-only too
//but live INSIDE the player page (a mixed surface), so they self-gate at the panel
//level rather than locking the whole-page toggle.
const NORMAL_ONLY_PREFIXES = ['/lane-lab'];

const isNormalOnly = (path: string): boolean =>
  NORMAL_ONLY_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));

export default function GameModeToggle({ currentPath = '' }: { currentPath?: string }) {
  const { mode, setMode } = useGameMode();

  //On a Normal-only route, render a locked indicator instead of a switch — honest
  //about the fact that Brawl is not an option for this surface.
  if (isNormalOnly(currentPath)) {
    return (
      <div
        className="brkfilter gm-toggle gm-toggle--locked"
        role="group"
        aria-label="Game mode — Normal only on this page"
        title="Lane analytics are Normal-only — Brawl has no laning data."
      >
        <span className="minitog on" aria-current="true">Normal</span>
        <span className="gm-only">only</span>
      </div>
    );
  }

  return (
    <div className="brkfilter gm-toggle" role="group" aria-label="Game mode">
      <button
        type="button"
        className={'minitog' + (mode === 'Normal' ? ' on' : '')}
        aria-pressed={mode === 'Normal'}
        onClick={() => setMode('Normal')}
      >
        Normal
      </button>
      <button
        type="button"
        className={'minitog' + (mode === 'StreetBrawl' ? ' on' : '')}
        aria-pressed={mode === 'StreetBrawl'}
        onClick={() => setMode('StreetBrawl')}
      >
        Brawl
      </button>
    </div>
  );
}
