//Lab §11 — the 16-point ability order as click-to-cycle chips. An order is valid only when every
//ability holds exactly four points; a valid order's rate is a served lookup, never a computed one.
import { GameIcon, SectionHeader } from '../ui/index';
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

const SLOT_COLOR = ['var(--cyan)', 'var(--amber)', 'var(--win)', 'var(--gold)'];

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
          text: minMatches == null ? 'No served rate — no rate shown' : `Under ${count(minMatches)} matches · no rate shown`,
          color: 'var(--muted)',
        };

  return (
    <section className="grid" style={{ gap: 10 }}>
      <SectionHeader
        kicker="Is my order good"
        title="Ability order"
        note={`Click a point to cycle the ability. ${ORDER_RULE}${window ? ` Served rates: ${window}.` : ''}`}
      />
      <div className="panel panel-pad grid" style={{ gap: 11 }}>
        <div className="flex" style={{ gap: 4, flexWrap: 'wrap' }}>
          {order.map((slot, i) => {
            const ability = abilities[slot - 1];
            return (
              <span key={i} className="grid" style={{ gap: 3, justifyItems: 'center' }}>
                <button
                  type="button"
                  className="tile"
                  style={{
                    width: 34,
                    height: 34,
                    padding: 0,
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                    borderColor: SLOT_COLOR[slot - 1],
                    color: SLOT_COLOR[slot - 1],
                    fontWeight: 700,
                  }}
                  title={`Point ${i + 1} — ${ability?.name ?? `ability ${slot}`} · click to cycle`}
                  aria-label={`Point ${i + 1}: ${ability?.name ?? `ability ${slot}`}`}
                  onClick={() => onOrder(cycleOrder(order, i))}
                >
                  {ability ? <GameIcon kind="item" name={ability.name} src={ability.icon_url} size={24} /> : slot}
                </button>
                <span className="faint tnum" style={{ fontSize: 9.5 }}>{i + 1}</span>
              </span>
            );
          })}
        </div>

        <div
          className="between"
          style={{ gap: 12, flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 10 }}
        >
          <div className="flex" style={{ gap: 10, flexWrap: 'wrap' }}>
            {ABILITY_SLOTS.map((slot) => {
              const n = counts[slot - 1] as number;
              const ability = abilities[slot - 1];
              return (
                <span
                  key={slot}
                  className="flex mono tnum"
                  style={{ alignItems: 'center', gap: 6, fontSize: 12, color: n === POINTS_PER_ABILITY ? 'var(--text-2)' : 'var(--loss)' }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: SLOT_COLOR[slot - 1] }} aria-hidden="true" />
                  {ability?.name ?? `Ability ${slot}`} × {n}
                </span>
              );
            })}
          </div>
          <span className="mono tnum" style={{ fontSize: 13, fontWeight: 600, color: rate.color }}>{rate.text}</span>
        </div>

        {abilities.length < POINTS_PER_ABILITY && (
          <p className="faint" style={{ fontSize: 11.5, margin: 0 }}>
            This hero serves {abilities.length} abilities, so the points cannot be named — the chips cycle slot numbers
            and no served rate can be matched.
          </p>
        )}
      </div>
    </section>
  );
}
