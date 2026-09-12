//Headline-stat tile — a big tabular value with a label, optional unit, optional
//sub-line, and an optional corner icon. Decorative filigree corners.
//`variant="band"` is the hero/item band card: no corners, mono value, trend beside it.
import type { ReactNode } from 'react';
import Icon, { type IconName } from './Icon';

interface StatTileProps {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  trend?: ReactNode;
  color?: string;
  icon?: IconName;
  variant?: 'tile' | 'band';
}

export default function StatTile({ label, value, unit, sub, trend, color, icon, variant = 'tile' }: StatTileProps) {
  const band = variant === 'band';
  return (
    <div className={band ? 'statile statile-band' : 'tile statile'}>
      {!band && <span className="corner tl" />}
      {!band && <span className="corner br" />}
      <div className="between statile-head">
        <span className="label-xs">{label}</span>
        {icon && !band && <Icon name={icon} size={14} color="var(--faint)" />}
      </div>
      <div className="statile-value tnum" style={color ? { color } : undefined}>
        {value}
        {unit && <span className="statile-unit">{unit}</span>}
        {trend && <span className="statile-trend">{trend}</span>}
      </div>
      {sub && <div className="statile-sub">{sub}</div>}
    </div>
  );
}
