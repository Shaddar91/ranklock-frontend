//Hero picker for the Build Creator: the roster as portrait tiles instead of a dropdown.
//Portraits come from GET /heroes (icon_url), joined onto the base-stats snapshot by hero_id;
//a hero missing from that join keeps GameIcon's monogram tile.
import { useMemo, useState } from 'react';
import { GameIcon } from '../ui/index';
import type { HeroBaseStats } from '../../../types/api';

interface HeroPickerProps {
  heroes: HeroBaseStats[];
  iconOf: Map<number, string | null>;
  heroId: number | null;
  onHero: (id: number) => void;
}

export default function HeroPicker({ heroes, iconOf, heroId, onHero }: HeroPickerProps) {
  const [term, setTerm] = useState('');

  const rows = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (needle === '') return heroes;
    return heroes.filter((h) => h.hero_name.toLowerCase().includes(needle));
  }, [heroes, term]);

  const selected = heroes.find((h) => h.hero_id === heroId) ?? null;

  return (
    <section className="panel panel-pad">
      <div className="between" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <span className="label-xs">
          Hero ·{' '}
          <span className="cyan-c">{selected?.hero_name ?? 'pick one'}</span>
        </span>
        <input
          className="field"
          type="search"
          value={term}
          placeholder="Find a hero…"
          onChange={(e) => setTerm(e.target.value)}
          aria-label="Search heroes by name"
          style={{ width: 200, padding: '7px 12px', fontSize: 13 }}
        />
      </div>

      {rows.length === 0 ? (
        <p className="faint" style={{ fontSize: 12.5, margin: 0 }}>No hero matches that name.</p>
      ) : (
        <div className="heropick" role="radiogroup" aria-label="Select a hero">
          {rows.map((h) => {
            const on = h.hero_id === heroId;
            return (
              <button
                key={h.hero_id}
                type="button"
                role="radio"
                aria-checked={on}
                className={'heropick-t' + (on ? ' on' : '')}
                onClick={() => onHero(h.hero_id)}
              >
                <GameIcon kind="hero" name={h.hero_name} src={iconOf.get(h.hero_id)} size={52} />
                <span className="heropick-n">{h.hero_name}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
