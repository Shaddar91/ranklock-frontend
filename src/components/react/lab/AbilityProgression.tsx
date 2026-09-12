//Lab §5 — the build's ability points in spend order plus a per-ability summary. The header rate
//is an exact (or served-prefix) lookup against /heroes/:id/ability-orders; no match prints no rate.
import { GameIcon, SectionHeader } from '../ui/index';
import { count, pct } from '../../../lib/format';
import type { AbilityStep, AbilitySummary, OrderMatch } from './analyzeModel';
import type { HeroAbility } from '../../../types/api';

interface AbilityProgressionProps {
  steps: AbilityStep[];
  summaries: AbilitySummary[];
  abilities: Map<number, HeroAbility>;
  match: OrderMatch | null;
  minMatches: number | null;
  window: string | null;
}

const stepLabel = (s: AbilityStep) => (s.tier == null ? 'unlock' : `T${s.tier}`);

export default function AbilityProgression({
  steps,
  summaries,
  abilities,
  match,
  minMatches,
  window,
}: AbilityProgressionProps) {
  if (steps.length === 0) {
    return (
      <section className="grid" style={{ gap: 10 }}>
        <SectionHeader
          kicker="What to level"
          title="Ability progression"
          note="This build carries no ability order — nothing to show."
        />
      </section>
    );
  }

  const rate = match
    ? `${match.prefix == null ? 'this order' : `first ${match.prefix} points`} · ${pct(match.order.win_rate * 100)} · ${count(match.order.matches)} matches`
    : null;

  return (
    <section className="grid" style={{ gap: 10 }}>
      <SectionHeader
        kicker="What to level"
        title="Ability progression"
        note={`${steps.length} points in the order the build spends them: one unlock per ability, then its tiers.${window ? ` Served rates: ${window}.` : ''}`}
        action={
          rate ? (
            <span className="mono tnum" style={{ fontSize: 12.5, color: 'var(--cyan-bright)' }}>{rate}</span>
          ) : (
            <span className="faint" style={{ fontSize: 12 }}>
              No served rate for this exact order
              {minMatches == null ? '' : ` — orders are floored at ${count(minMatches)} matches`}
            </span>
          )
        }
      />

      <div className="flex" style={{ gap: 6, flexWrap: 'wrap' }}>
        {steps.map((s) => {
          const a = abilities.get(s.abilityId);
          return (
            <span
              key={s.pos}
              className="tile"
              style={{ padding: '6px 7px', display: 'grid', justifyItems: 'center', gap: 3, minWidth: 46 }}
              title={`${a?.name ?? `Ability ${s.abilityId}`} — ${stepLabel(s)}${s.points > 0 ? ` · ${s.points} AP` : ''}`}
            >
              <GameIcon kind="item" name={a?.name ?? 'Ability'} src={a?.icon_url} size={26} />
              <span className="label-xs tnum" style={{ fontSize: 9.5 }}>{stepLabel(s)}</span>
              <span className="faint tnum" style={{ fontSize: 9.5 }}>{s.pos}</span>
            </span>
          );
        })}
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        {summaries.map((row) => {
          const a = abilities.get(row.abilityId);
          return (
            <div key={row.abilityId} className="tile" style={{ padding: '9px 11px' }}>
              <div className="flex" style={{ alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <GameIcon kind="item" name={a?.name ?? 'Ability'} src={a?.icon_url} size={22} />
                <span className="display" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                  {a?.name ?? `Ability ${row.abilityId}`}
                </span>
              </div>
              <span className="faint tnum" style={{ fontSize: 11.5 }}>
                {[
                  row.unlockAt == null ? null : `unlock at point ${row.unlockAt}`,
                  ...row.tiers.map((t) => `T${t.tier} ${t.at}`),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
