//Section header — optional kicker + an <h2>, with an optional right-aligned slot
//(filters, toggles). Used to open each panel/section.
import type { ReactNode } from 'react';

interface SecHeadProps {
  kicker?: string;
  title: string;
  right?: ReactNode;
}

export default function SecHead({ kicker, title, right }: SecHeadProps) {
  return (
    <div className="between" style={{ marginBottom: 16, gap: 16, flexWrap: 'wrap' }}>
      <div>
        {kicker && (
          <div className="kicker" style={{ marginBottom: 6 }}>
            {kicker}
          </div>
        )}
        <h2 className="h-sec">{title}</h2>
      </div>
      {right}
    </div>
  );
}
