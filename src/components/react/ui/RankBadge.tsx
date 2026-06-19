//Rank emblem + optional label. Emblems are bundled design assets (public/assets/
//ranks/), looked up by tier via lib/ranks.
import { getRank, rankImg, subLabel } from '../../../lib/ranks';
import { cssVars } from '../../../lib/cssVars';

interface RankBadgeProps {
  tier: number;
  sub?: number | null;
  size?: number;
  glow?: boolean;
  showLabel?: boolean;
  sublabel?: string;
}

export default function RankBadge({ tier, sub, size = 44, glow = true, showLabel = false, sublabel }: RankBadgeProps) {
  const r = getRank(tier);
  return (
    <div className="flex" style={{ alignItems: 'center', gap: 10 }}>
      <div
        className={'rankbadge' + (glow ? ' glow' : '')}
        style={cssVars({ '--rk': r.color + '66' }, { width: size, height: size })}
      >
        <img src={rankImg(tier)} alt={r.name} loading="lazy" />
      </div>
      {showLabel && (
        <div style={{ lineHeight: 1.2 }}>
          <div className="display" style={{ fontWeight: 600, fontSize: size > 40 ? 16 : 14, color: r.color }}>
            {sublabel || subLabel(tier, sub)}
          </div>
          {sub != null && (
            <div className="label-xs" style={{ fontSize: 10 }}>
              Tier {tier} · Sub {sub}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
