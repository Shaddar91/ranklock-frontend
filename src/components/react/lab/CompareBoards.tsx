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

  return (
    <section>
      <SectionHeader
        kicker="A vs B"
        title="Compare boards"
        action={
          <span className="lab-pickrow">
            <span className="label-xs" style={{ letterSpacing: '0.16em' }}>Board B</span>
            {options.map((o) => (
              <button
                key={o.key}
                type="button"
                className={'lab-pick' + (activeKey === o.key ? ' on' : '')}
                title={o.hint}
                disabled={o.itemIds.length === 0}
                onClick={() => onPick(o)}
              >
                {o.label}
              </button>
            ))}
          </span>
        }
      />

      {b == null || active == null ? (
        <p className="lab-note" style={{ marginTop: 0 }}>
          Pick a served board above to compare against. A is your board, and board cost inverts, so the cheaper
          board takes the delta.
        </p>
      ) : (
        <div className="lab-card lab-card-flush">
          <div className="lab-cmprow lab-cmphead">
            <span>Stat</span>
            <span>A · your board</span>
            <span>B · {active.label}</span>
            <span>Δ</span>
          </div>
          {rows.map((row) => {
            const d = delta(row);
            return (
              <div key={row.key} className="lab-cmprow">
                <span>{row.label}</span>
                <span className="a tnum">{cell(row, row.a)}</span>
                <span className="b tnum">{cell(row, row.b)}</span>
                <span className="d tnum" style={{ color: d.color }}>{d.text}</span>
              </div>
            );
          })}
          <div className="lab-cmprow">
            <span>30-day win rate · matches</span>
            <span className="a mono">{CUSTOM_BOARD}</span>
            <span className="b tnum" style={{ color: active.rate ? 'var(--win)' : 'var(--muted)' }}>
              {active.rate ? `${pct(active.rate.winRate)} · ${count(active.rate.matches)}` : 'no served rate'}
            </span>
            <span className="d">·</span>
          </div>
          <p className="lab-tblnote">
            {active.rate
              ? `B's rate: ${active.rate.window}. A custom board carries none: only served sets and published builds do.`
              : 'Neither board carries a win rate: a custom board never does, and this preset is assembled from per-item rows rather than a scored set.'}
            {' '}
            {COMPARE_OMITTED}
          </p>
        </div>
      )}
    </section>
  );
}
