//Categorized-performance primitives (C5): a single stat line + the collapsible
//panel that groups them. Ported from the prototype's StatLine/CatPanel (pages2),
//re-typed against the derived StatRow model (lib/playstyle). A panel whose rows
//are all build-ahead (unserved) collapses to an EmptyState rather than a wall of
//em-dashes.
import { useState } from 'react';
import { Delta, EmptyState, Icon, type IconName } from '../ui/index';
import type { StatRow } from '../../../lib/playstyle';

export function StatLine({ row, compare }: { row: StatRow; compare: boolean }) {
  return (
    <div className="statrow">
      <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{row.label}</span>
      {compare ? (
        <span className="flex" style={{ alignItems: 'center' }}>
          <span className="sv tnum cyan-c" style={{ minWidth: 78, textAlign: 'right' }}>
            {row.value}
            {row.unit && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{row.unit}</span>}
          </span>
          <span className="sv tnum" style={{ minWidth: 78, textAlign: 'right', color: 'var(--muted)', fontWeight: 500 }}>
            {row.cohort ?? '—'}
            {row.cohort && row.unit && <span style={{ fontSize: 11 }}>{row.unit}</span>}
          </span>
        </span>
      ) : (
        <span className="flex" style={{ alignItems: 'center', gap: 12 }}>
          <span className="sv tnum">
            {row.value}
            {row.unit && <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 1 }}>{row.unit}</span>}
          </span>
          <span style={{ minWidth: 62, textAlign: 'right' }}>
            {row.delta != null ? <Delta value={row.delta} better={row.better} /> : <span className="faint" style={{ fontSize: 12 }}>—</span>}
          </span>
        </span>
      )}
    </div>
  );
}

interface CatPanelProps {
  title: string;
  icon: IconName;
  rows: StatRow[];
  more?: StatRow[];
  compare: boolean;
  emptyMessage?: string;
}

export function CatPanel({ title, icon, rows, more = [], compare, emptyMessage }: CatPanelProps) {
  const [open, setOpen] = useState(false);
  const anyServed = [...rows, ...more].some((r) => r.served);
  return (
    <div className="panel catpanel">
      <div className="cat-h">
        <Icon name={icon} size={15} color="var(--cyan-bright)" />
        <span className="display" style={{ flex: 1 }}>
          {title}
        </span>
        {compare && anyServed && (
          <span className="flex" style={{ fontSize: 9.5 }}>
            <span className="label-xs cyan-c" style={{ fontSize: 9.5, width: 78, textAlign: 'right' }}>
              You
            </span>
            <span className="label-xs" style={{ fontSize: 9.5, width: 78, textAlign: 'right' }}>
              Cohort
            </span>
          </span>
        )}
      </div>
      {anyServed ? (
        <>
          {rows.map((r) => (
            <StatLine key={r.label} row={r} compare={compare} />
          ))}
          {open && more.map((r) => <StatLine key={r.label} row={r} compare={compare} />)}
          {more.length > 0 && (
            <button className="cat-expand" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
              {open ? 'Show less' : `${more.length} more`}
              <Icon name={open ? 'up' : 'down'} size={13} />
            </button>
          )}
        </>
      ) : (
        <div style={{ padding: 12 }}>
          <EmptyState title="Not served yet" message={emptyMessage ?? 'Comes online with the analytics pipeline.'} icon="chart" />
        </div>
      )}
    </div>
  );
}
