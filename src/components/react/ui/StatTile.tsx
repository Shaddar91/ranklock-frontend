//Headline-stat tile — a big tabular value with a label, optional unit, optional
//sub-line, and an optional corner icon. Decorative filigree corners.
import type { ReactNode } from 'react';
import Icon, { type IconName } from './Icon';

interface StatTileProps {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  color?: string;
  icon?: IconName;
}

export default function StatTile({ label, value, unit, sub, color, icon }: StatTileProps) {
  return (
    <div className="tile statile">
      <span className="corner tl" />
      <span className="corner br" />
      <div className="between" style={{ marginBottom: 6 }}>
        <span className="label-xs">{label}</span>
        {icon && <Icon name={icon} size={14} color="var(--faint)" />}
      </div>
      <div className="display tnum" style={{ fontSize: 28, fontWeight: 700, color: color || 'var(--text)', lineHeight: 1 }}>
        {value}
        {unit && <span style={{ fontSize: 15, color: 'var(--muted)', marginLeft: 2 }}>{unit}</span>}
      </div>
      {sub && <div style={{ marginTop: 6 }}>{sub}</div>}
    </div>
  );
}
