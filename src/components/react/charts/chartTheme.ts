//Shared Recharts styling so all charts pick up the active gaslamp skin (the
//chart primitives read CSS custom properties, so they re-theme live with the
//rest of the app). Imported by every chart island.
import type { CSSProperties } from 'react';

//The value type Recharts hands a Tooltip `formatter` (it may be undefined or an
//array). Widen our formatters to this so they satisfy Recharts' Formatter type.
export type ChartFmtValue = number | string | ReadonlyArray<number | string> | undefined;

export const tooltipContentStyle: CSSProperties = {
  background: 'var(--raised)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text)',
  fontSize: 12,
  fontFamily: 'var(--mono)',
  boxShadow: '0 8px 24px -12px rgba(0,0,0,.7)',
};

export const tooltipLabelStyle: CSSProperties = {
  color: 'var(--muted)',
  fontFamily: 'var(--display)',
  marginBottom: 2,
};

export const tooltipItemStyle: CSSProperties = {
  color: 'var(--text-2)',
};

//Axis tick text styling (Recharts `tick` prop).
export const axisTick = { fill: 'var(--faint)', fontSize: 10, fontFamily: 'var(--mono)' } as const;

export const gridStroke = 'var(--border)';

//Series colors expressed as CSS vars (live theme-aware).
export const seriesColor = {
  you: 'var(--cyan-bright)',
  cohort: 'var(--muted)',
  amber: 'var(--amber-acc)',
  sapphire: 'var(--sapphire-acc)',
  loss: 'var(--loss)',
  win: 'var(--win)',
} as const;
