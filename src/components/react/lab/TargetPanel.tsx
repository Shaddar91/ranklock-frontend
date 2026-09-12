//Lab §9 — pick a target, a level and your ability tier, then read the four duel cards off C24's
//calculators. A card whose input no served payload carries prints the gap instead of a number.
import { useMemo } from 'react';
import { GameIcon } from '../ui/index';
import { count, fixed } from '../../../lib/format';
import {
  ASSUMPTIONS,
  burstDamage,
  effectiveHpPair,
  LAB_LEVELS,
  targetHp as hpAtLevel,
  theirTimeToKill,
  timeToKill,
  THEORETICAL_NOTE,
  type AssumptionKey,
  type Ranged,
} from '../../../lib/labCalc';
import type { ComputedStats, WeaponDps } from '../../../lib/computeStats';
import type { TierAbility } from './analyzeModel';
import type { HeroBaseStats } from '../../../types/api';

const TIERS = [1, 2, 3] as const;

//No served route carries bullet damage, fire cycle, clip or reload, so neither hero's gun DPS
//can be derived — the two gun cards state that rather than inventing a band.
const NO_WEAPON_BASELINE =
  'No served payload carries a weapon baseline (bullet damage, fire cycle, clip size, reload), so no gun DPS can be derived.';

interface TargetPanelProps {
  targets: HeroBaseStats[];
  icons: Map<number, string | null>;
  targetId: number | null;
  onTarget: (id: number) => void;
  level: number;
  onLevel: (level: number) => void;
  tier: number;
  onTier: (tier: number) => void;
  //per-level max health off the target's own assets payload; null while it loads or is absent.
  targetHpPerLevel: number | null;
  //the target's own gun, derived the same way yours is — null while no weapon baseline is served.
  targetWeaponDps: WeaponDps | null;
  yourStats: ComputedStats;
  yourAbilities: TierAbility[];
  spiritPower: number;
}

function statValue(stats: ComputedStats, key: string): number | null {
  for (const cat of ['weapon', 'vitality', 'spirit'] as const) {
    const line = stats[cat].find((l) => l.key === key);
    if (line) return line.value;
  }
  return null;
}

function baseValue(hero: HeroBaseStats | null, key: string): number | null {
  const raw = (hero?.stats ?? {})[key] as { value?: unknown } | number | undefined;
  if (typeof raw === 'number') return raw;
  return typeof raw?.value === 'number' ? raw.value : null;
}

function rangeText(r: Ranged, unit: string, dp = 1): string {
  return `${fixed(r.lo, dp)}–${fixed(r.hi, dp)}${unit}`;
}

function Card({
  label,
  value,
  sub,
  gap,
}: {
  label: string;
  value: string | null;
  sub: string;
  gap?: string;
}) {
  return (
    <div className="tile" style={{ padding: '11px 13px' }}>
      <div className="label-xs">{label}</div>
      {value == null ? (
        <p className="faint" style={{ fontSize: 12, margin: '6px 0 0' }}>{gap}</p>
      ) : (
        <>
          <div className="display tnum" style={{ fontSize: 23, fontWeight: 700, lineHeight: 1, marginTop: 5 }}>
            {value}
          </div>
          <div className="faint" style={{ fontSize: 11.5, marginTop: 4 }}>{sub}</div>
        </>
      )}
    </div>
  );
}

function Switch({
  label,
  options,
  active,
  onPick,
}: {
  label: string;
  options: readonly { value: number; text: string }[];
  active: number;
  onPick: (value: number) => void;
}) {
  return (
    <div className="flex" style={{ alignItems: 'center', gap: 6 }}>
      <span className="label-xs">{label}</span>
      <span className="tabs" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={'tab' + (active === o.value ? ' on' : '')}
            style={{ padding: '3px 10px', fontSize: 12 }}
            onClick={() => onPick(o.value)}
          >
            {o.text}
          </button>
        ))}
      </span>
    </div>
  );
}

export default function TargetPanel({
  targets,
  icons,
  targetId,
  onTarget,
  level,
  onLevel,
  tier,
  onTier,
  targetHpPerLevel,
  targetWeaponDps,
  yourStats,
  yourAbilities,
  spiritPower,
}: TargetPanelProps) {
  const target = targets.find((h) => h.hero_id === targetId) ?? null;
  const targetBaseHp = baseValue(target, 'max_health');
  const hp = targetBaseHp == null ? null : hpAtLevel(targetBaseHp, targetHpPerLevel ?? 0, level);

  const burst = useMemo(
    () =>
      burstDamage(
        yourAbilities
          .filter((a) => (a.baseline.damage ?? 0) > 0)
          .map((a) => ({ damage: a.baseline.damage as number, spiritScaling: a.baseline.spiritScaling })),
        spiritPower,
      ),
    [yourAbilities, spiritPower],
  );

  const yourHp = statValue(yourStats, 'max_health') ?? 0;
  const ehp = effectiveHpPair(yourHp, [statValue(yourStats, 'bullet_resist') ?? 0], [statValue(yourStats, 'spirit_resist') ?? 0]);
  const dps = yourStats.weaponDps;
  const ttk = hp == null || dps == null ? null : timeToKill(hp, dps.sustainedDps, dps.burstDps);
  const theirTtk =
    ehp.vsBullets == null || targetWeaponDps == null
      ? null
      : theirTimeToKill(ehp.vsBullets.ehp, targetWeaponDps.sustainedDps);

  const assumed = useMemo(() => {
    const keys: AssumptionKey[] = [];
    for (const r of [burst, ttk, theirTtk] as (Ranged | null)[]) if (r) keys.push(...r.assumed);
    if (ehp.vsBullets) keys.push(...ehp.vsBullets.assumed);
    return [...new Set(keys)];
  }, [burst, ttk, theirTtk, ehp.vsBullets]);

  return (
    <section className="panel panel-pad grid" style={{ gap: 11 }}>
      <span className="label-xs" style={{ color: 'var(--cyan)' }}>Target</span>

      <div className="flex" role="radiogroup" aria-label="Target hero" style={{ gap: 5, overflowX: 'auto', paddingBottom: 3 }}>
        {targets.map((h) => {
          const on = h.hero_id === targetId;
          return (
            <button
              key={h.hero_id}
              type="button"
              role="radio"
              aria-checked={on}
              className="tile flex"
              style={{
                alignItems: 'center',
                gap: 6,
                flex: 'none',
                padding: '3px 10px 3px 3px',
                borderRadius: 20,
                cursor: 'pointer',
                borderColor: on ? 'var(--cyan)' : undefined,
                color: on ? 'var(--text)' : 'var(--text-2)',
              }}
              onClick={() => onTarget(h.hero_id)}
            >
              <GameIcon kind="hero" name={h.hero_name} src={icons.get(h.hero_id)} size={20} />
              <span className="display" style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{h.hero_name}</span>
            </button>
          );
        })}
      </div>

      <div className="flex" style={{ gap: 14, flexWrap: 'wrap' }}>
        <Switch
          label="Level"
          options={LAB_LEVELS.map((l) => ({ value: l, text: String(l) }))}
          active={level}
          onPick={onLevel}
        />
        <Switch
          label="Your tiers"
          options={TIERS.map((t) => ({ value: t, text: `T${t}` }))}
          active={tier}
          onPick={onTier}
        />
      </div>

      <div className="grid" style={{ gap: 8 }}>
        <Card
          label="Time to kill with the gun"
          value={ttk ? rangeText(ttk, 's') : null}
          sub={hp == null ? '' : `${count(hp)} HP at level ${level} · DPS ${dps ? `${fixed(dps.sustainedDps, 0)}–${fixed(dps.burstDps, 0)}` : ''}`}
          gap={NO_WEAPON_BASELINE}
        />
        <Card
          label="Burst · every served ability once"
          value={burst ? `${count(Math.round(burst.lo))}–${count(Math.round(burst.hi))}` : null}
          sub={
            hp == null || burst == null
              ? `at T${tier} · ${fixed(spiritPower, 0)} spirit power · no resists`
              : `${Math.round((burst.lo / hp) * 100)}–${Math.round((burst.hi / hp) * 100)}% of ${count(hp)} HP · at T${tier} · ${fixed(spiritPower, 0)} spirit power · no resists`
          }
          gap={
            yourAbilities.length === 0
              ? "This hero's assets payload carries no per-ability numerics — no burst to add up."
              : 'None of this hero’s served abilities carries a damage value at this tier.'
          }
        />
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
          <Card
            label="Your effective HP"
            value={ehp.vsBullets ? count(Math.round(ehp.vsBullets.ehp)) : null}
            sub={`vs bullets · ${ehp.vsSpirit ? count(Math.round(ehp.vsSpirit.ehp)) : '—'} vs spirit · ${count(Math.round(yourHp))} raw`}
            gap="Add items with health or resists — an empty board has no effective HP to state."
          />
          <Card
            label="Their time to kill you"
            value={theirTtk ? rangeText(theirTtk, 's') : null}
            sub={`${target?.hero_name ?? 'Target'} gun only · ±12% DPS band`}
            gap={NO_WEAPON_BASELINE}
          />
        </div>
      </div>

      <p className="faint" style={{ fontSize: 11.5, margin: 0 }}>
        Target health = its served base plus {targetHpPerLevel == null ? 'its per-level growth' : `${fixed(targetHpPerLevel, 1)} per level`}, at level {level}. {THEORETICAL_NOTE}
      </p>
      {assumed.map((k) => (
        <p key={k} className="faint" style={{ fontSize: 11.5, margin: 0 }}>{ASSUMPTIONS[k]}</p>
      ))}
    </section>
  );
}
