//Section head — the design's kicker + heading on the left, the note and any trailing
//action right-aligned on the heading baseline. `note` is where a section states its
//window and source.
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
        <Heading className={level === 3 ? 'h-sec h-sec-sm' : 'h-sec'} id={id}>
          {title}
        </Heading>
      </div>
      {(note || action) && (
        <div className="sechead-action">
          {note && <span className="sechead-note">{note}</span>}
          {action}
        </div>
      )}
    </header>
  );
}
