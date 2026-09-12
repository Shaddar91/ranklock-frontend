//Zero / empty state (requirements §8.1) — shown when an endpoint isn't live yet or
//returns no rows. `tone="cold"` is the design's dashed Computing box.
import type { ReactNode } from 'react';
import Icon, { type IconName } from './Icon';

interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: IconName;
  action?: ReactNode;
  tone?: 'plain' | 'cold';
}

export default function EmptyState({ title, message, icon = 'inbox', action, tone = 'plain' }: EmptyStateProps) {
  const cold = tone === 'cold';
  return (
    <div className={cold ? 'empty empty-cold' : 'empty'} role="status">
      {!cold && <Icon name={icon} size={30} className="empty-ic" />}
      <div className="empty-title">{title}</div>
      {message && <div className="empty-sub">{message}</div>}
      {action}
    </div>
  );
}
