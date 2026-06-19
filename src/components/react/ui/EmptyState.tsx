//Zero / empty state — the build-ahead surface (requirements §8.1): when an
//endpoint isn't live yet (or returns no rows) the UI shows this instead of
//crashing or a white screen.
import type { ReactNode } from 'react';
import Icon, { type IconName } from './Icon';

interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: IconName;
  action?: ReactNode;
}

export default function EmptyState({ title, message, icon = 'inbox', action }: EmptyStateProps) {
  return (
    <div className="empty" role="status">
      <Icon name={icon} size={30} className="empty-ic" />
      <div className="empty-title">{title}</div>
      {message && <div className="empty-sub">{message}</div>}
      {action}
    </div>
  );
}
