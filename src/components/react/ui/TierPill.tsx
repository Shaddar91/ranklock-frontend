//Meta tier-list pill (S through F), colored per the shared TIER_COLOR map.
import { TIER_COLOR } from '../../../lib/ranks';
import { cssVars } from '../../../lib/cssVars';

interface TierPillProps {
  tier: string;
}

export default function TierPill({ tier }: TierPillProps) {
  const color = TIER_COLOR[tier] ?? 'var(--muted)';
  return (
    <span className="tierpill" style={cssVars({ '--tc': color })} title={`Tier ${tier}`}>
      {tier}
    </span>
  );
}
