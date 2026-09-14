//Lab §6 rail — the investment track, the hero's stats with this build, and the abilities at
//T1-T3, as the design's three cards. Every theoretical figure prints C24's standing note plus the
//assumption keys its own calculation raised.
import { useState } from 'react';
import { AbilityGlyph, EmptyState } from '../ui/index';
import { count, DASH, fixed } from '../../../lib/format';
import { abilitiesWithBuild, ASSUMPTIONS, THEORETICAL_NOTE, type AbilityValue } from '../../../lib/labCalc';
import { CATEGORIES, CATEGORY_LABEL, type Category } from '../creator/buildModel';
import { investmentBonusText, type TierAbility } from './analyzeModel';
import type { BuildModifiers } from '../../../lib/labCalc';
import type { ComputedStats } from '../../../lib/computeStats';

//The spike step the shop's own track pays out of turn (+19 against +4 the step before).
const SPIKE_THRESHOLD = 4800;
const TIERS = [1, 2, 3] as const;

interface AnalyzeRailProps {
  stats: ComputedStats;
  mods: BuildModifiers;
  tierAbilities: TierAbility[];
  //ability id → the hero's signature slot 1..4 and its glyph, for the design's key chips.
  slots: Record<string, number>;
  icons: Record<string, string | null>;
  heroName: string | null;
  level: number;
  hasBoard: boolean;
  boardCount: number;
  //`labTier` is shared with Create §9, so the switch lives above this component.
  tier: number;
  onTier: (tier: number) => void;
}

function num(n: number): string {
  return Number.isInteger(n) ? count(n) : fixed(n, 1);
}

function lineValue(unit: 'flat' | 'percent', value: number): string {
  return unit === 'percent' ? `${value > 0 ? '+' : ''}${num(value)}%` : num(value);
}

function abilityCell(value: AbilityValue | null, unit = ''): string {
  return value == null ? DASH : `${num(value.value)}${unit}`;
}

function InvestmentCard({ stats }: { stats: ComputedStats }) {
  const investment = stats.investment;
  return (
    <section className="lab-card">
      <div className="lab-card-h" style={{ alignItems: 'baseline' }}>
        <span className="lab-card-k">Investment by category</span>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
          counts owned items · spike at {count(SPIKE_THRESHOLD)}
        </span>
      </div>
      {!investment ? (
        <p className="lab-note" style={{ marginTop: 0 }}>
          This hero's assets payload carries no investment track — nothing to show.
        </p>
      ) : (
        <>
          <div className="lab-inv">
            {CATEGORIES.map((cat: Category) => {
              const row = investment[cat];
              const max = row.steps[row.steps.length - 1]?.threshold ?? 0;
              const filled = max > 0 ? Math.min(100, (row.spend / max) * 100) : 0;
              return (
                <div key={cat} className={`cat-${cat}`}>
                  <div className="lab-inv-h">
                    <span className="lab-inv-l">
                      <i aria-hidden="true" />
                      {CATEGORY_LABEL[cat]} <span className="lab-inv-sp tnum">{count(row.spend)}</span>
                    </span>
                    <span className="lab-inv-b tnum">{investmentBonusText(row) ?? 'no step paid yet'}</span>
                  </div>
                  <div
                    className="lab-track"
                    role="img"
                    aria-label={`${CATEGORY_LABEL[cat]} investment: ${count(row.spend)} of ${count(max)} souls`}
                  >
                    <i style={{ width: `${filled}%` }} />
                    {row.steps.map((s) => (
                      <u
                        key={s.threshold}
                        className={s.threshold === SPIKE_THRESHOLD ? 'spike' : undefined}
                        style={{ left: `${max > 0 ? (s.threshold / max) * 100 : 0}%` }}
                      />
                    ))}
                  </div>
                  <div className="lab-inv-next tnum">
                    {row.next
                      ? `next step at ${count(row.next.threshold)} · ${count(row.toNext ?? 0)} more souls`
                      : 'track complete'}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function StatsCard({
  stats,
  heroName,
  level,
  hasBoard,
  boardCount,
}: {
  stats: ComputedStats;
  heroName: string | null;
  level: number;
  hasBoard: boolean;
  boardCount: number;
}) {
  const [tab, setTab] = useState<Category>('weapon');
  const lines = stats[tab];
  const investRow = stats.investment?.[tab] ?? null;

  return (
    <section className="lab-card">
      <div className="lab-card-h">
        <span className="lab-card-k">Hero stats with this build</span>
        <span className="lab-seg" role="tablist" aria-label="Stat category">
          {CATEGORIES.map((c: Category) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={tab === c}
              className={tab === c ? 'on' : undefined}
              onClick={() => setTab(c)}
            >
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </span>
      </div>
      <div className="lab-srow lab-shead">
        <span>
          {heroName ?? 'Hero'} · level {level}
        </span>
        <span>Base</span>
        <span />
        <span>With build</span>
      </div>
      {!hasBoard ? (
        <p className="lab-note">Import a build or start from a served set — these rows read the board it fills.</p>
      ) : (
        <>
          {investRow?.applied && (
            <div className="lab-srow">
              <span>Investment bonus</span>
              <span className="b tnum" title={`${count(investRow.spend)} souls spent in this category`}>{DASH}</span>
              <span className="g">→</span>
              <span className="v tnum" style={{ color: 'var(--win)' }}>{investmentBonusText(investRow)}</span>
            </div>
          )}
          {lines.length === 0 ? (
            <p className="lab-note">Nothing on this board changes a {CATEGORY_LABEL[tab].toLowerCase()} stat.</p>
          ) : (
            lines.map((line) => (
              <div key={line.key} className="lab-srow">
                <span>{line.label}</span>
                <span className="b tnum">{line.base > 0 ? num(line.base) : DASH}</span>
                <span className="g">→</span>
                <span className="v tnum">{lineValue(line.unit, line.value)}</span>
              </div>
            ))
          )}
        </>
      )}
      <p className="lab-note">
        Read over the {boardCount} items the 9 + 3 board holds. Investment bonus applies on top of item stats.
        Resists stack multiplicatively; percentages inside a stat add before applying.
      </p>
    </section>
  );
}

function AbilitiesCard({
  tierAbilities: rows,
  mods,
  slots,
  icons,
  tier,
  onTier,
}: {
  tierAbilities: TierAbility[];
  mods: BuildModifiers;
  slots: Record<string, number>;
  icons: Record<string, string | null>;
  tier: number;
  onTier: (tier: number) => void;
}) {
  const folded = abilitiesWithBuild(rows.map((r) => r.baseline), mods);
  const assumed = [...new Set(folded.flatMap((f) => f.assumed))];
  const extra = [...new Set(rows.flatMap((r) => r.notes))];

  return (
    <section className="lab-card">
      <div className="lab-card-h">
        <span className="lab-card-k">Abilities with this build</span>
        <span className="lab-switch">
          <span className="label-xs">Tier</span>
          {TIERS.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tier === t}
              className={'lab-pick lab-pick-num' + (tier === t ? ' on' : '')}
              onClick={() => onTier(t)}
            >
              T{t}
            </button>
          ))}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="lab-note" style={{ marginTop: 0 }}>
          This hero's assets payload carries no per-ability numerics — nothing to fold a build into.
        </p>
      ) : (
        <>
          <div className="lab-arow lab-ahead">
            <span>Ability</span>
            <span>Damage</span>
            <span>CD</span>
            <span>Dur.</span>
            <span>Range</span>
          </div>
          {folded.map((f) => {
            const slot = slots[String(f.abilityId)] ?? 0;
            return (
              <div key={f.abilityId} className="lab-arow">
                <span className="n">
                  <span className={`kit-key k${slot || 1}`}>
                    <AbilityGlyph slot={slot} icon={icons[String(f.abilityId)]} />
                  </span>
                  <span className="nm">{f.name}</span>
                </span>
                <span className="d tnum">{abilityCell(f.damage)}</span>
                <span className="m tnum">{abilityCell(f.cooldown, 's')}</span>
                <span className="m tnum">{abilityCell(f.duration, 's')}</span>
                <span className="m tnum">{abilityCell(f.range, 'm')}</span>
              </div>
            );
          })}
          <p className="lab-note">
            At T{tier}, with {num(mods.spiritPower)} spirit power from this board
            {mods.cdr.length > 0
              ? ` and ${mods.cdr.length} cooldown-reduction source${mods.cdr.length === 1 ? '' : 's'}`
              : ' and no cooldown reduction'}
            . {THEORETICAL_NOTE}
            {[...assumed.map((k) => ASSUMPTIONS[k]), ...extra].map((line) => ` ${line}`).join('')}
          </p>
        </>
      )}
    </section>
  );
}

export default function AnalyzeRail({
  stats,
  mods,
  tierAbilities,
  slots,
  icons,
  heroName,
  level,
  hasBoard,
  boardCount,
  tier,
  onTier,
}: AnalyzeRailProps) {
  if (stats.investment == null && tierAbilities.length === 0 && !hasBoard) {
    return (
      <EmptyState
        title="Base stats not available yet"
        message="Base stats are captured once per patch. This patch's capture hasn't landed yet."
        icon="chart"
      />
    );
  }
  return (
    <aside className="lab-rail">
      <InvestmentCard stats={stats} />
      <StatsCard stats={stats} heroName={heroName} level={level} hasBoard={hasBoard} boardCount={boardCount} />
      <AbilitiesCard tierAbilities={tierAbilities} mods={mods} slots={slots} icons={icons} tier={tier} onTier={onTier} />
    </aside>
  );
}
