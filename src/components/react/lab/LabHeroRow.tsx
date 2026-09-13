//The lab's hero control (design `lab`, Create): one card holding the roster chips. The prototype's
//Analyze takes its hero from the imported build; live has to name one before an import exists, so
//the same row serves all three tabs.
import { useMemo } from 'react';
import LabHeroChips, { type ChipHero } from './LabHeroChips';
import type { HeroBaseStats, HeroSummary } from '../../../types/api';

const COLLAPSED = 8;

interface LabHeroRowProps {
  roster: HeroSummary[];
  playable: HeroBaseStats[];
  heroId: number | null;
  onHero: (id: number) => void;
}

export default function LabHeroRow({ roster, playable, heroId, onHero }: LabHeroRowProps) {
  const enabled = useMemo(() => new Set(playable.map((h) => h.hero_id)), [playable]);
  const heroes = useMemo<ChipHero[]>(() => {
    const named = roster.filter((h) => h.hero_name?.trim());
    return named.length > 0
      ? named.map((h) => ({ hero_id: h.hero_id, hero_name: h.hero_name, icon_url: h.icon_url, picks: h.picks }))
      : playable.map((h) => ({ hero_id: h.hero_id, hero_name: h.hero_name, icon_url: null, picks: 0 }));
  }, [roster, playable]);

  return (
    <div className="lab-herorow" role="radiogroup" aria-label="Hero">
      <span className="label-xs">Hero</span>
      {heroes.length === 0 ? (
        <span className="faint" style={{ fontSize: 12.5 }}>The hero roster has not been served yet.</span>
      ) : (
        <LabHeroChips
          label="heroes"
          heroes={heroes}
          enabled={enabled}
          heroId={heroId}
          onHero={onHero}
          limit={COLLAPSED}
          size={26}
        />
      )}
    </div>
  );
}
