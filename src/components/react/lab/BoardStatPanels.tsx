//Lab §10 — the three computed stat cards, "base → with board", each opening on the investment
//bonus the board's spend already paid out. Formats only; every number is computeStats' own.
import { count, DASH, fixed } from '../../../lib/format';
import { CATEGORIES, CATEGORY_LABEL, type Category } from '../creator/buildModel';
import { investmentBonusText } from './analyzeModel';
import type { ComputedStats, StatLine } from '../../../lib/computeStats';

function num(n: number): string {
  return Number.isInteger(n) ? count(n) : fixed(n, 1);
}

function lineValue(line: StatLine): string {
  return line.unit === 'percent' ? `${line.value > 0 ? '+' : ''}${num(line.value)}%` : num(line.value);
}

function Row({ label, base, value, accent }: { label: string; base: string; value: string; accent?: string }) {
  return (
    <div className="lab-srow lab-srow-wide">
      <span>{label}</span>
      <span className="b tnum">{base}</span>
      <span className="g">→</span>
      <span className="v tnum" style={accent ? { color: accent } : undefined}>{value}</span>
    </div>
  );
}

export default function BoardStatPanels({ stats, boardCount }: { stats: ComputedStats; boardCount: number }) {
  return (
    <>
      {CATEGORIES.map((cat: Category) => {
        const lines = stats[cat];
        const invest = stats.investment?.[cat] ?? null;
        const bonus = invest ? investmentBonusText(invest) : null;
        return (
          <section key={cat} className={`lab-cp cat-${cat}`}>
            <div className="lab-cp-h">
              <i aria-hidden="true" />
              {CATEGORY_LABEL[cat]}
              <span>base → with board</span>
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
              <p className="lab-note">Nothing on this board changes a {CATEGORY_LABEL[cat].toLowerCase()} stat.</p>
            ) : (
              lines.map((line) => (
                <Row
                  key={line.key}
                  label={line.label}
                  base={line.base > 0 ? num(line.base) : DASH}
                  value={lineValue(line)}
                />
              ))
            )}
          </section>
        );
      })}
      <p className="lab-note" style={{ marginTop: 0 }}>
        Read over the {boardCount} items on the 9 + 3 board. The investment bonus is already inside the rows below
        it, not an extra on top. Resists stack multiplicatively; percentages inside one stat add before they apply.
      </p>
    </>
  );
}
