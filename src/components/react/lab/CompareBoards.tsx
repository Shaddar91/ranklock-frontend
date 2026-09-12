//Lab §12 — your board against a served one, per-stat deltas with board cost inverted (cheaper
//wins). Only a served set or a published build carries a win rate; a hand-filled board never does.
import { SectionHeader } from '../ui/index';
import { count, fixed, pct } from '../../../lib/format';
import { COMPARE_OMITTED, compareRows, type CompareRow, type StartFromPreset } from './createModel';
import type { ComputedStats } from '../../../lib/computeStats';

const CUSTOM_BOARD = '— custom board';

interface CompareBoardsProps {
  a: ComputedStats;
  b: ComputedStats | null;
  options: StartFromPreset[];
  activeKey: string | null;
  onPick: (preset: StartFromPreset) => void;
}

function cell(row: CompareRow, value: number): string {
  if (row.unit === 'souls') return `${count(value)} souls`;
  if (row.unit === 'percent') return `${value > 0 ? '+' : ''}${fixed(value, 1)}%`;
  return Number.isInteger(value) ? count(value) : fixed(value, 1);
}

function delta(row: CompareRow): { text: string; color: string } {
  if (row.better == null) return { text: '·', color: 'var(--muted)' };
  const arrow = row.better === 'a' ? '▲' : '▼';
  return {
    text: `${arrow} ${cell(row, Math.abs(row.delta))}`,
    color: row.better === 'a' ? 'var(--win)' : 'var(--loss)',
  };
}

export default function CompareBoards({ a, b, options, activeKey, onPick }: CompareBoardsProps) {
  const active = options.find((o) => o.key === activeKey) ?? null;
  const rows = b ? compareRows(a, b) : [];
  const grid = 'minmax(0, 1.4fr) 120px 120px 110px';

  return (
    <section className="grid" style={{ gap: 10 }}>
      <SectionHeader
        kicker="A vs B"
        title="Compare boards"
        note="A is your board. Board cost inverts — the cheaper board takes the delta."
        action={
          <div className="flex" style={{ gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="label-xs">Board B</span>
            {options.map((o) => (
              <button
                key={o.key}
                type="button"
                className={'tab' + (activeKey === o.key ? ' on' : '')}
                style={{ padding: '4px 10px', fontSize: 12 }}
                title={o.hint}
                disabled={o.itemIds.length === 0}
                onClick={() => onPick(o)}
              >
                {o.label}
              </button>
            ))}
          </div>
        }
      />

      {b == null || active == null ? (
        <p className="faint" style={{ fontSize: 12.5, margin: 0 }}>
          Pick a served board above to compare against — no served set for this hero means no B column.
        </p>
      ) : (
        <div className="panel" style={{ overflow: 'hidden' }}>
          <div className="grid" style={{ gridTemplateColumns: grid, gap: 12, padding: '10px 13px 6px' }}>
            <span className="label-xs">Stat</span>
            <span className="label-xs" style={{ textAlign: 'right' }}>A · your board</span>
            <span className="label-xs" style={{ textAlign: 'right' }}>B · {active.label}</span>
            <span className="label-xs" style={{ textAlign: 'right' }}>Δ</span>
          </div>
          {rows.map((row) => {
            const d = delta(row);
            return (
              <div
                key={row.key}
                className="grid"
                style={{
                  gridTemplateColumns: grid,
                  gap: 12,
                  alignItems: 'center',
                  padding: '7px 13px',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{row.label}</span>
                <span className="mono tnum" style={{ fontSize: 12, fontWeight: 600, textAlign: 'right' }}>{cell(row, row.a)}</span>
                <span className="mono tnum faint" style={{ fontSize: 12, textAlign: 'right' }}>{cell(row, row.b)}</span>
                <span className="mono tnum" style={{ fontSize: 12, fontWeight: 600, textAlign: 'right', color: d.color }}>{d.text}</span>
              </div>
            );
          })}
          <div
            className="grid"
            style={{ gridTemplateColumns: grid, gap: 12, alignItems: 'center', padding: '7px 13px', borderTop: '1px solid var(--border)' }}
          >
            <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>Win rate · matches</span>
            <span className="mono faint" style={{ fontSize: 12, textAlign: 'right' }}>{CUSTOM_BOARD}</span>
            <span className="mono tnum" style={{ fontSize: 12, textAlign: 'right', color: active.rate ? 'var(--cyan-bright)' : 'var(--muted)' }}>
              {active.rate ? `${pct(active.rate.winRate)} · ${count(active.rate.matches)}` : 'no served rate'}
            </span>
            <span className="mono faint" style={{ fontSize: 12, textAlign: 'right' }}>·</span>
          </div>
          <p className="faint" style={{ fontSize: 11.5, margin: 0, padding: '9px 13px', borderTop: '1px solid var(--border)' }}>
            {active.rate
              ? `B's rate: ${active.rate.window}. A custom board carries none — only served sets and published builds do.`
              : 'Neither board carries a win rate: a custom board never does, and this preset is assembled from per-item rows rather than a scored set.'}
            {' '}{COMPARE_OMITTED}
          </p>
        </div>
      )}
    </section>
  );
}
