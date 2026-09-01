//Shared Share control for a loaded you-vs-them pair — rendered by the Compare tab and the Overview playstyle overlay so both copy the identical canonical /compare/{me}/{vs} link.
import { useState } from 'react';
import { Icon } from '../ui/index';
import { compareShareUrl } from '../../../lib/compareShare';
import { useGameMode } from '../../../lib/useGameMode';
import { useMatchMode } from '../../../lib/useMatchMode';

export function ShareCompareButton({ me, vs, heroId }: { me: number; vs: number; heroId: number }) {
  const { mode } = useGameMode();
  const { matchMode } = useMatchMode();
  const [copied, setCopied] = useState(false);
  function share() {
    try {
      void navigator.clipboard?.writeText(compareShareUrl(me, vs, { hero_id: heroId, game_mode: mode, match_mode: matchMode }));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      //clipboard unavailable (insecure context) — nothing to copy into.
    }
  }
  return (
    <button type="button" className={'share-btn' + (copied ? ' copied' : '')} onClick={share} aria-label="Copy the link to this comparison">
      <Icon name="share" size={15} />
      {copied ? 'Copied ✓' : 'Share'}
    </button>
  );
}
