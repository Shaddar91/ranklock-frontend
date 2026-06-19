//Small status pill. `tone` maps to the win/loss/gold semantic styles; default is
//the neutral chip.
import type { ReactNode } from 'react';

interface ChipProps {
  children: ReactNode;
  tone?: 'neutral' | 'win' | 'loss' | 'gold';
  title?: string;
}

export default function Chip({ children, tone = 'neutral', title }: ChipProps) {
  const cls = 'chip' + (tone !== 'neutral' ? ' ' + tone : '');
  return (
    <span className={cls} title={title}>
      {children}
    </span>
  );
}
