//Rank-bracket filter — a row of rank emblems acting as a single-select toggle
//(plus "All"). Real <button>s with aria-pressed; the active emblem glows in the
//rank's own color. Pair with [data-badge="emblem-only"|"label-only"] on an
//ancestor to hide labels/emblems responsively.
import { getRank, rankImg } from '../../../lib/ranks';
import { cssVars } from '../../../lib/cssVars';

export type BracketValue = number | 'all';

interface BracketFilterProps {
  value: BracketValue;
  onChange: (value: BracketValue) => void;
  tiers?: number[];
}

export default function BracketFilter({ value, onChange, tiers = [4, 5, 6, 7, 8, 9, 10, 11] }: BracketFilterProps) {
  return (
    <div className="brkfilter" role="group" aria-label="Rank bracket">
      <button
        type="button"
        className={'brk' + (value === 'all' ? ' on' : '')}
        aria-pressed={value === 'all'}
        onClick={() => onChange('all')}
      >
        <span className="display" style={{ fontSize: 12 }}>
          All
        </span>
      </button>
      {tiers.map((t) => {
        const r = getRank(t);
        const active = value === t;
        return (
          <button
            type="button"
            key={t}
            className={'brk' + (active ? ' on' : '')}
            aria-pressed={active}
            onClick={() => onChange(t)}
            title={r.name}
            style={active ? cssVars({ '--bc': r.color }) : undefined}
          >
            <img src={rankImg(t)} alt="" aria-hidden="true" />
            <span className="brk-name display">{r.name}</span>
          </button>
        );
      })}
    </div>
  );
}
