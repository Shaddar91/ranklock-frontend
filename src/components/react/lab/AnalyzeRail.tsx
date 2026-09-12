//Lab §6 rail — the investment track already folded into the panels, the hero's stats with this
//build, and the abilities at T1-T3. Every theoretical figure prints C24's standing note plus the
//assumption keys its own calculation raised.
import { useState } from 'react';
import { EmptyState, Icon, SectionHeader } from '../ui/index';
import { count, fixed } from '../../../lib/format';
import { statLabel } from '../../../lib/statLabel';
import { groupBaseStats, statUnit } from '../../../lib/baseStatGroups';
import { abilitiesWithBuild, ASSUMPTIONS, THEORETICAL_NOTE, type AbilityValue } from '../../../lib/labCalc';
import { CATEGORIES, CATEGORY_LABEL, type Category } from '../creator/buildModel';
import { investmentBonusText, type TierAbility } from './analyzeModel';
import type { BuildModifiers } from '../../../lib/labCalc';
import type { ComputedStats, StatLine } from '../../../lib/computeStats';

//The spike step the shop's own track pays out of turn (+19 against +4 the step before).
const SPIKE_THRESHOLD = 4800;
const TIERS = [1, 2, 3] as const;

interface AnalyzeRailProps {
  stats: ComputedStats;
  mods: BuildModifiers;
  tierAbilities: TierAbility[];
  baseStats: { key: string; value: number; label: string }[];
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

function InvestmentTrack({ stats }: { stats: ComputedStats }) {
  const investment = stats.investment;
  if (!investment) {
    return (
      <p className="faint" style={{ fontSize: 12.5, margin: 0 }}>
        This hero's assets payload carries no investment track — nothing to show.
      </p>
    );
  }
  return (
    <div className="grid" style={{ gap: 12 }}>
      {CATEGORIES.map((cat: Category) => {
        const row = investment[cat];
        const max = row.steps[row.steps.length - 1]?.threshold ?? 0;
        const filled = max > 0 ? Math.min(100, (row.spend / max) * 100) : 0;
        return (
          <div key={cat}>
            <div className="between" style={{ gap: 10, alignItems: 'baseline' }}>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{CATEGORY_LABEL[cat]}</span>
              <span className="flex" style={{ gap: 9, alignItems: 'baseline' }}>
                <span className="tnum amber-c" style={{ fontSize: 12.5 }}>{count(row.spend)} souls</span>
                <span className="tnum" style={{ fontSize: 12.5, color: 'var(--win)' }}>
                  {investmentBonusText(row) ?? 'no step paid yet'}
                </span>
              </span>
            </div>
            <div
              style={{ position: 'relative', height: 7, borderRadius: 4, background: 'var(--surface-2)', margin: '6px 0 4px' }}
              role="img"
              aria-label={`${CATEGORY_LABEL[cat]} investment: ${count(row.spend)} of ${count(max)} souls`}
            >
              <div style={{ width: `${filled}%`, height: '100%', borderRadius: 4, background: 'var(--cyan)' }} />
              {row.steps.map((s) => (
                <span
                  key={s.threshold}
                  title={`${count(s.threshold)} souls → +${s.bonus}`}
                  style={{
                    position: 'absolute',
                    left: `${max > 0 ? (s.threshold / max) * 100 : 0}%`,
                    top: -2,
                    width: s.threshold === SPIKE_THRESHOLD ? 2.5 : 1.5,
                    height: 11,
                    background: s.threshold === SPIKE_THRESHOLD ? 'var(--brass-2, var(--gold))' : 'var(--border)',
                  }}
                />
              ))}
            </div>
            <span className="faint tnum" style={{ fontSize: 11.5 }}>
              {row.next
                ? `next step at ${count(row.next.threshold)} · ${count(row.toNext ?? 0)} more souls`
                : 'track complete'}
              {` · ${row.steps.length} steps to ${count(max)}`}
            </span>
          </div>
        );
      })}
      <p className="faint" style={{ fontSize: 11.5, margin: 0 }}>
        Counts owned items, the highest step at or below the spend pays · the spike sits at {count(SPIKE_THRESHOLD)}.
        This bonus is already inside the panels below, not an extra on top.
      </p>
    </div>
  );
}

function StatsWithBuild({
  stats,
  baseStats,
  hasBoard,
  boardCount,
}: {
  stats: ComputedStats;
  baseStats: { key: string; value: number; label: string }[];
  hasBoard: boolean;
  boardCount: number;
}) {
  const [tab, setTab] = useState<Category>('weapon');
  const lines: StatLine[] = stats[tab];
  const investRow = stats.investment?.[tab] ?? null;
  const { groups, raw } = groupBaseStats(baseStats);

  return (
    <div className="grid" style={{ gap: 10 }}>
      <div className="tabs" role="tablist" aria-label="Stat category">
        {CATEGORIES.map((c: Category) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={tab === c}
            className={'tab' + (tab === c ? ' on' : '')}
            onClick={() => setTab(c)}
          >
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      {!hasBoard ? (
        <p className="faint" style={{ fontSize: 12.5, margin: 0 }}>
          Import a build or start from a served set — these rows read the board it fills.
        </p>
      ) : (
        <section className="panel catpanel">
          {investRow?.applied && (
            <div className="statrow">
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Investment bonus</span>
              <span className="flex" style={{ alignItems: 'center', gap: 8 }}>
                <span className="faint tnum" style={{ fontSize: 12 }}>{count(investRow.spend)} souls →</span>
                <span className="sv tnum" style={{ color: 'var(--win)' }}>{investmentBonusText(investRow)}</span>
              </span>
            </div>
          )}
          {lines.length === 0 ? (
            <p className="faint" style={{ fontSize: 12.5, padding: '12px 15px', margin: 0 }}>
              Nothing on this board changes a {CATEGORY_LABEL[tab].toLowerCase()} stat.
            </p>
          ) : (
            lines.map((line) => (
              <div key={line.key} className="statrow">
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{line.label}</span>
                <span className="flex" style={{ alignItems: 'center', gap: 8 }}>
                  {line.base > 0 && <span className="faint tnum" style={{ fontSize: 12 }}>{num(line.base)} →</span>}
                  <span className="sv tnum cyan-c">{lineValue(line.unit, line.value)}</span>
                </span>
              </div>
            ))
          )}
        </section>
      )}

      <p className="faint" style={{ fontSize: 11.5, margin: 0 }}>
        Read over the {boardCount} items the 9 + 3 board holds. Investment bonus applies on top of item stats.
        Resists stack multiplicatively; percentages inside a stat add before applying.
      </p>

      {baseStats.length > 0 && (
        <details>
          <summary className="label-xs" style={{ cursor: 'pointer', color: 'var(--muted)' }}>
            This hero's served starting stats · {baseStats.length}
          </summary>
          <div className="grid" style={{ gap: 14, marginTop: 10 }}>
            {groups.map((g) => (
              <section key={g.key}>
                <div className="label-xs" style={{ marginBottom: 6, color: 'var(--cyan)', letterSpacing: '0.1em' }}>{g.label}</div>
                <div className="stat-grid">
                  {g.stats.map((s) => (
                    <div key={s.key} className="tile statile">
                      <div className="label-xs" title={s.label} style={{ overflowWrap: 'anywhere' }}>{s.label}</div>
                      <div className="display tnum" style={{ fontSize: 20, fontWeight: 700 }}>
                        {num(s.value)}
                        {statUnit(s.key) && (
                          <span className="muted" style={{ fontSize: 12, fontWeight: 600, marginLeft: 3 }}>{statUnit(s.key)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
            {raw.length > 0 && (
              <span className="faint" style={{ fontSize: 11.5 }}>
                {raw.length} raw engine values omitted — {raw.map((r) => statLabel(r.key)).slice(0, 3).join(', ')}…
              </span>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

function ValueRow({ label, value, unit }: { label: string; value: AbilityValue | null; unit?: string }) {
  if (!value) return null;
  const changed = Math.abs(value.value - value.base) > 0.0001;
  return (
    <div className="statrow">
      <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{label}</span>
      <span className="flex" style={{ alignItems: 'center', gap: 8 }}>
        {changed && <span className="faint tnum" style={{ fontSize: 11.5 }}>{num(value.base)} →</span>}
        <span className={'sv tnum' + (changed ? ' cyan-c' : '')}>
          {num(value.value)}
          {unit && <span className="faint" style={{ fontSize: 11, marginLeft: 2 }}>{unit}</span>}
        </span>
      </span>
    </div>
  );
}

function AbilitiesWithBuild({
  tierAbilities: rows,
  mods,
  tier,
  onTier,
}: {
  tierAbilities: TierAbility[];
  mods: BuildModifiers;
  tier: number;
  onTier: (tier: number) => void;
}) {
  const folded = abilitiesWithBuild(rows.map((r) => r.baseline), mods);
  const assumed = [...new Set(folded.flatMap((f) => f.assumed))];
  const extra = [...new Set(rows.flatMap((r) => r.notes))];

  if (rows.length === 0) {
    return (
      <p className="faint" style={{ fontSize: 12.5, margin: 0 }}>
        This hero's assets payload carries no per-ability numerics — nothing to fold a build into.
      </p>
    );
  }

  return (
    <div className="grid" style={{ gap: 10 }}>
      <div className="tabs" role="tablist" aria-label="Ability tier">
        {TIERS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tier === t}
            className={'tab' + (tier === t ? ' on' : '')}
            onClick={() => onTier(t)}
          >
            T{t}
          </button>
        ))}
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 10 }}>
        {folded.map((f, i) => {
          const labels = rows[i]!.labels;
          return (
            <section key={f.abilityId} className="panel catpanel">
              <div className="cat-h">
                <span className="display" style={{ flex: 1, fontSize: 13 }}>{f.name}</span>
              </div>
              {f.damage == null && f.cooldown == null && f.duration == null && f.range == null ? (
                <p className="faint" style={{ fontSize: 12, padding: '10px 14px', margin: 0 }}>
                  Upstream serves no damage, cooldown, duration or range for this ability.
                </p>
              ) : (
                <>
                  <ValueRow label={labels.damage} value={f.damage} />
                  <ValueRow label={labels.cooldown} value={f.cooldown} unit="s" />
                  <ValueRow label={labels.duration} value={f.duration} unit="s" />
                  <ValueRow label={labels.range} value={f.range} unit="m" />
                </>
              )}
            </section>
          );
        })}
      </div>
      <p className="faint" style={{ fontSize: 11.5, margin: 0 }}>
        At T{tier}, with {num(mods.spiritPower)} spirit power from this board
        {mods.cdr.length > 0 ? ` and ${mods.cdr.length} cooldown-reduction source${mods.cdr.length === 1 ? '' : 's'}` : ' and no cooldown reduction'}.
        {' '}{THEORETICAL_NOTE}
      </p>
      {[...assumed.map((k) => ASSUMPTIONS[k]), ...extra].map((line) => (
        <p key={line} className="faint" style={{ fontSize: 11.5, margin: 0 }}>{line}</p>
      ))}
    </div>
  );
}

export default function AnalyzeRail({ stats, mods, tierAbilities, baseStats, hasBoard, boardCount, tier, onTier }: AnalyzeRailProps) {
  if (baseStats.length === 0 && stats.investment == null) {
    return (
      <EmptyState
        title="Base stats not available yet"
        message="Base stats are captured once per patch. This patch's capture hasn't landed yet."
        icon="chart"
      />
    );
  }
  return (
    <div className="grid" style={{ gap: 20, alignContent: 'start' }}>
      <section className="panel panel-pad grid" style={{ gap: 10 }}>
        <div className="flex" style={{ alignItems: 'center', gap: 8 }}>
          <Icon name="coins" size={15} color="var(--cyan-bright)" />
          <span className="display" style={{ fontSize: 14 }}>Investment by category</span>
        </div>
        <InvestmentTrack stats={stats} />
      </section>

      <section className="grid" style={{ gap: 10 }}>
        <SectionHeader kicker="What it adds up to" title="Hero stats with this build" level={3} />
        <StatsWithBuild stats={stats} baseStats={baseStats} hasBoard={hasBoard} boardCount={boardCount} />
      </section>

      <section className="grid" style={{ gap: 10 }}>
        <SectionHeader kicker="What it does to the kit" title="Abilities with this build" level={3} />
        <AbilitiesWithBuild tierAbilities={tierAbilities} mods={mods} tier={tier} onTier={onTier} />
      </section>
    </div>
  );
}
