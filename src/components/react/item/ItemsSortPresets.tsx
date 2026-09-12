//The four sort presets that ride the right edge of the Items page-head row.
import { activePreset, SORT_PRESETS } from '../../../lib/itemsIndex';
import { useItemsSort } from '../../../lib/itemsIndexState';

export default function ItemsSortPresets() {
  const { sort, setSort } = useItemsSort();
  const preset = activePreset(sort);
  return (
    <div className="sortpresets" role="group" aria-label="Sort the item table">
      {SORT_PRESETS.map((p) => {
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
