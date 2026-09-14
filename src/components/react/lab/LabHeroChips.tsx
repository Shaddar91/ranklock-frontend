//The design's hero pills: the most-picked few, the rest behind "All N". Used for the lab's hero
//row and for the target picker, which the design draws with the same chip.
import { useMemo, useState } from 'react';
import { GameIcon } from '../ui/index';

export interface ChipHero {
  hero_id: number;
  hero_name: string;
  icon_url: string | null;
  picks: number;
}

interface LabHeroChipsProps {
  label: string;
  heroes: ChipHero[];
  //hero ids this control may actually select; empty means "no restriction served yet".
  enabled: ReadonlySet<number>;
  heroId: number | null;
  onHero: (id: number) => void;
  limit: number;
  size: number;
}

export default function LabHeroChips({ label, heroes, enabled, heroId, onHero, limit, size }: LabHeroChipsProps) {
  const [all, setAll] = useState(false);

  const ranked = useMemo(() => [...heroes].sort((a, b) => b.picks - a.picks), [heroes]);
  const shown = useMemo(() => {
    if (all) return [...heroes].sort((a, b) => a.hero_name.localeCompare(b.hero_name));
    const head = ranked.slice(0, limit);
    const active = ranked.find((h) => h.hero_id === heroId);
    return active && !head.includes(active) ? [active, ...head.slice(0, limit - 1)] : head;
  }, [heroes, ranked, all, heroId, limit]);

  return (
    <>
      {shown.map((h) => {
        const usable = enabled.size === 0 || enabled.has(h.hero_id);
        return (
          <button
            key={h.hero_id}
            type="button"
            role="radio"
            aria-checked={h.hero_id === heroId}
            disabled={!usable}
            title={usable ? h.hero_name : `${h.hero_name}: no base-stats row in this patch's capture`}
            className={'lab-hchip' + (size < 26 ? ' lab-hchip-sm' : '') + (h.hero_id === heroId ? ' on' : '')}
            onClick={() => usable && onHero(h.hero_id)}
          >
            <GameIcon kind="hero" name={h.hero_name} src={h.icon_url} size={size} />
            {h.hero_name}
          </button>
        );
      })}
      {ranked.length > shown.length || all ? (
        <button
          type="button"
          className="lab-hmore"
          aria-label={all ? `Show fewer ${label}` : `Show all ${ranked.length} ${label}`}
          onClick={() => setAll((v) => !v)}
        >
          {all ? 'Fewer ←' : `All ${ranked.length} ${label} →`}
        </button>
      ) : null}
    </>
  );
}
