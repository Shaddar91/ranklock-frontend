//Lab §9 — what the board does to the kit, as the design's one table: Damage / Cooldown / Duration
/// Range per ability at the selected tier.
import { AbilityGlyph, SectionHeader } from '../ui/index';
import { count, DASH, fixed } from '../../../lib/format';
import { abilitiesWithBuild, ASSUMPTIONS, THEORETICAL_NOTE, type AbilityValue, type BuildModifiers } from '../../../lib/labCalc';
import type { TierAbility } from './analyzeModel';

interface BoardAbilitiesProps {
  rows: TierAbility[];
  mods: BuildModifiers;
  slots: Record<string, number>;
  icons: Record<string, string | null>;
  tier: number;
}

function num(n: number): string {
  return Number.isInteger(n) ? count(n) : fixed(n, 1);
}

function cell(value: AbilityValue | null, unit = ''): string {
  return value == null ? DASH : `${num(value.value)}${unit}`;
}

export default function BoardAbilities({ rows, mods, slots, icons, tier }: BoardAbilitiesProps) {
  const folded = abilitiesWithBuild(rows.map((r) => r.baseline), mods);
  const assumed = [...new Set(folded.flatMap((f) => f.assumed))];
  const extra = [...new Set(rows.flatMap((r) => r.notes))];

  return (
    <section>
      <SectionHeader
        kicker="What does my spell do now"
        title={`Abilities with this board · tier ${tier}`}
      />
      <div className="lab-card lab-card-flush">
        {rows.length === 0 ? (
          <p className="lab-tblnote" style={{ borderTop: 0 }}>
            This hero's assets payload carries no per-ability numerics. Nothing to fold a board into.
          </p>
        ) : (
          <>
            <div className="lab-arow lab-arow-w lab-ahead">
              <span>Ability</span>
              <span>Damage</span>
              <span>Cooldown</span>
              <span>Duration</span>
              <span>Range</span>
            </div>
            {folded.map((f) => {
              const slot = slots[String(f.abilityId)] ?? 0;
              return (
                <div key={f.abilityId} className="lab-arow lab-arow-w">
                  <span className="n">
                    <span className={`kit-key k${slot || 1}`}>
                      <AbilityGlyph slot={slot} icon={icons[String(f.abilityId)]} />
                    </span>
                    <span className="nm">{f.name}</span>
                  </span>
                  <span className="d tnum">{cell(f.damage)}</span>
                  <span className="m tnum">{cell(f.cooldown, 's')}</span>
                  <span className="m tnum">{cell(f.duration, 's')}</span>
                  <span className="m tnum">{cell(f.range, 'm')}</span>
                </div>
              );
            })}
            <p className="lab-tblnote">
              {num(mods.spiritPower)} spirit power from the board
              {mods.cdr.length > 0
                ? ` · ${mods.cdr.length} cooldown-reduction source${mods.cdr.length === 1 ? '' : 's'}`
                : ' · no cooldown reduction on this board'}
              . {THEORETICAL_NOTE}
              {[...assumed.map((k) => ASSUMPTIONS[k]), ...extra].map((line) => ` ${line}`).join('')}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
