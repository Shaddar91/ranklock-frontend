//Lab §5 — the build's ability points in spend order plus a per-ability summary, drawn as the
//design's slot chips carrying the ability art. The header rate is an exact (or served-prefix)
//lookup against /heroes/:id/ability-orders; no match prints no rate.
import { AbilityGlyph, SectionHeader } from '../ui/index';
import { count, pct } from '../../../lib/format';
import type { AbilityStep, AbilitySummary, OrderMatch } from './analyzeModel';
import type { HeroAbility } from '../../../types/api';

interface AbilityProgressionProps {
  steps: AbilityStep[];
  summaries: AbilitySummary[];
  abilities: Map<number, HeroAbility>;
  //ability id → the hero's signature slot 1..4, so a chip reads as the design's key number.
  slots: Record<string, number>;
  //true when the order is the hero's most-played served one rather than an imported build's.
  served: boolean;
  match: OrderMatch | null;
  minMatches: number | null;
  window: string | null;
}

const stepLabel = (s: AbilityStep) => (s.tier == null ? 'unlock' : `T${s.tier}`);

export default function AbilityProgression({
  steps,
  summaries,
  abilities,
  slots,
  served,
  match,
  minMatches,
  window,
}: AbilityProgressionProps) {
  if (steps.length === 0) return null;

  const rate = match
    ? `${match.prefix == null ? 'this order' : `first ${match.prefix} points`} · ${pct(match.order.win_rate * 100)} · ${count(match.order.matches)} matches`
    : null;
  const slotOf = (id: number) => slots[String(id)] ?? 0;
  //The design lists the kit in key order, not in the order the build happens to spend points.
  const bySlot = [...summaries].sort((a, b) => slotOf(a.abilityId) - slotOf(b.abilityId));

  return (
    <section>
      <SectionHeader
        kicker="What to level"
        title="Ability progression"
        action={
          <span className="mono tnum" style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)' }}>
            {rate ??
              `no served rate for this exact order${minMatches == null ? '' : ` — orders are floored at ${count(minMatches)} matches`}`}
          </span>
        }
      />
      <div className="lab-card grid" style={{ gap: 12 }}>
        <div className="lab-abrow">
          {steps.map((s) => {
            const a = abilities.get(s.abilityId);
            const slot = slotOf(s.abilityId);
            return (
              <span
                key={s.pos}
                className="lab-ab"
                title={`${a?.name ?? `Ability ${s.abilityId}`} — ${stepLabel(s)}`}
              >
                <span className={`kit-key k${slot || 1}`}>
                  <AbilityGlyph slot={slot} icon={a?.icon_url} />
                </span>
                <span className="lab-ab-lvl">{s.pos}</span>
              </span>
            );
          })}
        </div>
        <div className="lab-abprog">
          {bySlot.map((row) => {
            const a = abilities.get(row.abilityId);
            const slot = slotOf(row.abilityId);
            return (
              <div key={row.abilityId}>
                <span className={`kit-key k${slot || 1}`}>
                  <AbilityGlyph slot={slot} icon={a?.icon_url} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <span className="lab-abprog-n" style={{ display: 'block' }}>
                    {a?.name ?? `Ability ${row.abilityId}`}
                  </span>
                  <span className="lab-abprog-s">
                    {[
                      row.unlockAt == null ? null : `unlock at point ${row.unlockAt}`,
                      ...row.tiers.map((t) => `T${t.tier} ${t.at}`),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
        <p className="lab-note">
          {served ? "This hero's most-played served order — import a build to read its own." : ''}
          {window ? ` Served rates: ${window}.` : ''}
        </p>
      </div>
    </section>
  );
}
