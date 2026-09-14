//The sort presets that ride the right edge of the Heroes page-head row.
import { activeHeroPreset, HERO_SORT_PRESETS, useHeroesSort } from '../../../lib/heroesIndexState';

export default function HeroesSortPresets() {
  const { sort, setSort } = useHeroesSort();
  const preset = activeHeroPreset(sort);
  return (
    <div className="sortpresets" role="group" aria-label="Sort the hero table">
      {HERO_SORT_PRESETS.map((p) => {
        const on = preset?.key === p.key;
        return (
          <button
            type="button"
            key={p.key}
            className={'sortpreset' + (on ? ' on' : '')}
            aria-pressed={on}
            onClick={() => setSort(p.sort)}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
