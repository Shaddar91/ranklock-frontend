//Section head — the design's kicker + heading + note row, with an optional trailing
//action (a link or button). `note` is where a section states its window and source.
import type { ReactNode } from 'react';

interface SectionHeaderProps {
  kicker: string;
  title: ReactNode;
  note?: ReactNode;
  action?: ReactNode;
  id?: string;
  level?: 2 | 3;
}

export default function SectionHeader({ kicker, title, note, action, id, level = 2 }: SectionHeaderProps) {
  const Heading = level === 3 ? 'h3' : 'h2';
  return (
    <header className="sechead">
      <div className="sechead-main">
        <div className="kicker">{kicker}</div>
        <Heading className="h-sec" id={id} style={{ fontSize: level === 3 ? 15 : 20, margin: '2px 0 0' }}>
          {title}
        </Heading>
        {note && <p className="sechead-note">{note}</p>}
      </div>
      {action && <div className="sechead-action">{action}</div>}
    </header>
  );
}
