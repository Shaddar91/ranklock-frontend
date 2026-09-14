//Lab §11 — the 16-point ability order as click-to-cycle slot chips. An order is valid only when
//every ability holds exactly four points; a valid order's rate is a served lookup, never computed.
import { AbilityGlyph, SectionHeader } from '../ui/index';
import { count, pct } from '../../../lib/format';
import {
  ABILITY_SLOTS,
  ORDER_RULE,
  cycleOrder,
  matchOrderRate,
  orderIsValid,
  slotCounts,
  POINTS_PER_ABILITY,
} from './createModel';
import type { AbilityOrder, HeroAbility } from '../../../types/api';

interface OrderEditorProps {
  order: number[];
  onOrder: (order: number[]) => void;
  abilities: HeroAbility[];
  served: AbilityOrder[] | undefined;
  minMatches: number | null;
  window: string | null;
}

export default function OrderEditor({ order, onOrder, abilities, served, minMatches, window }: OrderEditorProps) {
  const counts = slotCounts(order);
  const valid = orderIsValid(order);
  const abilityIds = abilities.map((a) => a.ability_id);
  const match = matchOrderRate(order, abilityIds, served);

  const rate = !valid
    ? { text: 'Invalid order', color: 'var(--loss)' }
    : match
      ? {
          text: `${match.prefix == null ? 'this order' : `first ${match.prefix} points`} · ${pct(match.order.win_rate * 100)} · ${count(match.order.matches)} matches`,
          color: 'var(--win)',
        }
      : {
          text: minMatches == null ? 'No served rate · no rate shown' : `Under ${count(minMatches)} matches · no rate shown`,
          color: 'var(--muted)',
        };

  return (
    <section>
      <SectionHeader kicker="Is my order good" title="Ability order" note="Click a point to cycle the ability" />
      <div className="lab-card">
        <div className="lab-abrow lab-ord">
          {order.map((slot, i) => {
            const ability = abilities[slot - 1];
            return (
              <span key={i} className="lab-ab">
                <button
                  type="button"
                  className={`kit-key k${slot}`}
                  title={`Point ${i + 1}: ${ability?.name ?? `ability ${slot}`} · click to cycle`}
                  aria-label={`Point ${i + 1}: ${ability?.name ?? `ability ${slot}`}`}
                  onClick={() => onOrder(cycleOrder(order, i))}
                >
                  <AbilityGlyph slot={slot} icon={ability?.icon_url} />
                </button>
                <span className="lab-ab-lvl">{i + 1}</span>
              </span>
            );
          })}
        </div>

        <div className="lab-ord-foot">
          <div className="lab-ord-legend">
            {ABILITY_SLOTS.map((slot) => {
              const n = counts[slot - 1] as number;
              const ability = abilities[slot - 1];
              return (
                <span
                  key={slot}
                  className={`k${slot} tnum`}
                  title={ability?.name ?? `Ability ${slot}`}
                  style={{ color: n === POINTS_PER_ABILITY ? 'var(--text-2)' : 'var(--loss)' }}
                >
                  <i aria-hidden="true" />
                  {slot} × {n}
                </span>
              );
            })}
          </div>
          <span className="mono tnum" style={{ fontSize: 13, fontWeight: 600, color: rate.color }}>{rate.text}</span>
        </div>

        <p className="lab-note">
          {ORDER_RULE}
          {window ? ` Served rates: ${window}.` : ''}
          {abilities.length < POINTS_PER_ABILITY
            ? ` This hero serves ${abilities.length} abilities, so the points cannot be named and no served rate can be matched.`
            : ''}
        </p>
      </div>
    </section>
  );
}
