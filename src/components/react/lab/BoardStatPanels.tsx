//Lab §10 — the three computed stat cards, "base → with board", each opening on the investment
//bonus the board's spend already paid out. Formats only; every number is computeStats' own.
import { count, fixed } from '../../../lib/format';
import { CATEGORIES, CATEGORY_LABEL, type Category } from '../creator/buildModel';
import { investmentBonusText } from './analyzeModel';
import type { ComputedStats, StatLine } from '../../../lib/computeStats';

const CATEGORY_COLOR: Record<Category, string> = {
  weapon: 'var(--amber)',
  vitality: 'var(--win)',
  spirit: 'var(--cyan)',
};

function num(n: number): string {
  return Number.isInteger(n) ? count(n) : fixed(n, 1);
}

function lineValue(line: StatLine): string {
  return line.unit === 'percent' ? `${line.value > 0 ? '+' : ''}${num(line.value)}%` : num(line.value);
}

function Row({ label, base, value, accent }: { label: string; base: string | null; value: string; accent?: string }) {
  return (
    <div className="statrow" style={{ gap: 8 }}>
      <span style={{ fontSize: 12.5, color: 'var(--text-2)', minWidth: 0 }}>{label}</span>
      <span className="flex" style={{ alignItems: 'center', gap: 7, flex: 'none' }}>
        {base && <span className="faint tnum" style={{ fontSize: 11.5 }}>{base} →</span>}
        <span className="sv tnum" style={{ color: accent ?? 'var(--text)' }}>{value}</span>
      </span>
    </div>
  );
}

export default function BoardStatPanels({ stats, boardCount }: { stats: ComputedStats; boardCount: number }) {
  return (
    <section className="grid" style={{ gap: 8 }}>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 8 }}>
        {CATEGORIES.map((cat: Category) => {
          const lines = stats[cat];
          const invest = stats.investment?.[cat] ?? null;
          const bonus = invest ? investmentBonusText(invest) : null;
          return (
            <section key={cat} className="panel catpanel">
              <div className="cat-h">
                <span style={{ width: 8, height: 8, borderRadius: 2, background: CATEGORY_COLOR[cat] }} aria-hidden="true" />
                <span className="display" style={{ flex: 1 }}>{CATEGORY_LABEL[cat]}</span>
                <span className="label-xs">base → with board</span>
              </div>
              {bonus && invest && (
                <Row
                  label="Investment bonus"
                  base={`${count(invest.spend)} souls`}
                  value={bonus}
                  accent="var(--win)"
                />
              )}
              {lines.length === 0 ? (
                <p className="faint" style={{ fontSize: 12, padding: '10px 14px', margin: 0 }}>
                  Nothing on this board changes a {CATEGORY_LABEL[cat].toLowerCase()} stat.
                </p>
              ) : (
                lines.map((line) => (
                  <Row
                    key={line.key}
                    label={line.label}
                    base={line.base > 0 ? num(line.base) : null}
                    value={lineValue(line)}
                    accent="var(--cyan-bright)"
                  />
                ))
              )}
            </section>
          );
        })}
      </div>
      <p className="faint" style={{ fontSize: 11.5, margin: 0 }}>
        Read over the {boardCount} items on the 9 + 3 board. The investment bonus is already inside the rows below it,
        not an extra on top. Resists stack multiplicatively; percentages inside one stat add before they apply.
      </p>
    </section>
  );
}
