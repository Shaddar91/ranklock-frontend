//Rank-bucket filter — a row of rank-emblem buttons labelled by TIER RANGE, not
//MMR. This is the concrete fix for the items bracket-label bug (requirements
//§B.5 / §7.7): every option reads e.g. "Ascendant – Eternus" with the band's
//rank emblems, never an MMR-score range. Shared by the heroes (low/mid/high/top)
//and items (0–5 integer) selectors — each passes its own bucket list + key type.
//
//Built on the same .brkfilter/.brk CSS as the C3 BracketFilter; real <button>s
//with aria-pressed, the active band glows in its top tier's rank color.
import { getRank, rankImg } from '../../../lib/ranks';
import { cssVars } from '../../../lib/cssVars';
import type { RankBucket } from '../../../lib/brackets';

interface BucketFilterProps {
  buckets: readonly RankBucket[];
  value: RankBucket['key'];
  onChange: (key: RankBucket['key']) => void;
  //screen-reader group label (e.g. "Hero win-rate by rank").
  ariaLabel?: string;
}

export default function BucketFilter({ buckets, value, onChange, ariaLabel = 'Rank bracket' }: BucketFilterProps) {
  return (
    <div className="brkfilter" role="group" aria-label={ariaLabel}>
      {buckets.map((b) => {
        const active = b.key === value;
        //Represent the band by its TOP tier emblem + color (e.g. Eternus for the
        //Ascendant–Eternus band); "All ranks" carries no emblem.
        const topTier = b.tiers.length ? Math.max(...b.tiers) : null;
        const color = topTier != null ? getRank(topTier).color : undefined;
        return (
          <button
            type="button"
            key={String(b.key)}
            className={'brk' + (active ? ' on' : '')}
            aria-pressed={active}
            onClick={() => onChange(b.key)}
            title={b.label}
            style={active && color ? cssVars({ '--bc': color }) : undefined}
          >
            {topTier != null && <img src={rankImg(topTier)} alt="" aria-hidden="true" />}
            <span className="brk-name display">{b.label}</span>
          </button>
        );
      })}
    </div>
  );
}
