//Lab §9 — pick a target, a level and your ability tier, then read the four duel cards off C24's
//calculators. A card whose input no served payload carries prints the gap instead of a number.
import { useMemo } from 'react';
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
import LabHeroChips, { type ChipHero } from './LabHeroChips';
import type { ComputedStats, WeaponDps } from '../../../lib/computeStats';
import type { TierAbility } from './analyzeModel';
import type { HeroBaseStats } from '../../../types/api';

const TIERS = [1, 2, 3] as const;
const TARGET_CHIPS = 4;

//No served route carries bullet damage, fire cycle, clip or reload, so neither hero's gun DPS
//can be derived — the two gun cards state that rather than inventing a band.
const NO_WEAPON_BASELINE =
  'No served payload carries a weapon baseline (bullet damage, fire cycle, clip size, reload), so no gun DPS can be derived.';

interface TargetPanelProps {
  targets: HeroBaseStats[];
  icons: Map<number, string | null>;
  picks: Map<number, number>;
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

function countRange(lo: number, hi: number): string {
  return lo === hi ? count(lo) : `${count(lo)} to ${count(hi)}`;
}

function baseValue(hero: HeroBaseStats | null, key: string): number | null {
  const raw = (hero?.stats ?? {})[key] as { value?: unknown } | number | undefined;
  if (typeof raw === 'number') return raw;
  return typeof raw?.value === 'number' ? raw.value : null;
}

//A band only widens where something is measured or channelled; otherwise print the one figure.
function rangeText(r: Ranged, unit: string, dp = 1): string {
  const lo = fixed(r.lo, dp);
  const hi = fixed(r.hi, dp);
  return lo === hi ? `${lo}${unit}` : `${lo} to ${hi}${unit}`;
}

function Card({
  label,
  value,
  beside,
  sub,
  gap,
  small,
}: {
  label: string;
  value: string | null;
  beside?: string;
  sub?: string;
  gap: string;
  small?: boolean;
}) {
  return (
    <div className={small ? 'lab-tcard lab-tcard-sm' : 'lab-tcard'}>
      <div className="lab-tcard-l">{label}</div>
      {value == null ? (
        <p className="lab-tcard-s">{gap}</p>
      ) : (
        <>
          <div className="lab-tcard-v">
            <b>{value}</b>
            {beside && <span>{beside}</span>}
          </div>
          {sub && <p className="lab-tcard-s">{sub}</p>}
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
    <div className="lab-switch">
      <span className="label-xs">{label}</span>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={active === o.value}
          className={'lab-pick lab-pick-num' + (active === o.value ? ' on' : '')}
          onClick={() => onPick(o.value)}
        >
          {o.text}
        </button>
      ))}
    </div>
  );
}

export default function TargetPanel({
  targets,
  icons,
  picks,
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

  const chips = useMemo<ChipHero[]>(
    () =>
      targets.map((h) => ({
        hero_id: h.hero_id,
        hero_name: h.hero_name,
        icon_url: icons.get(h.hero_id) ?? null,
        picks: picks.get(h.hero_id) ?? 0,
      })),
    [targets, icons, picks],
  );

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
    <section className="lab-card">
      <div className="lab-card-k" style={{ marginBottom: 10 }}>Target</div>

      <div className="lab-tgt-chips" role="radiogroup" aria-label="Target hero">
        <LabHeroChips
          label="heroes"
          heroes={chips}
          enabled={new Set()}
          heroId={targetId}
          onHero={onTarget}
          limit={TARGET_CHIPS}
          size={22}
        />
      </div>

      <div className="lab-tgt-switches">
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

      <div className="lab-tcards">
        <Card
          label="Time to kill with the gun"
          value={ttk ? rangeText(ttk, 's') : null}
          beside={
            hp == null
              ? undefined
              : `${count(hp)} HP · DPS ${dps ? `${fixed(dps.sustainedDps, 0)} to ${fixed(dps.burstDps, 0)}` : ''}`
          }
          sub={`at level ${level}, every bullet hits, 0 to 25 m`}
          gap={NO_WEAPON_BASELINE}
        />
        <Card
          label="Burst · every served ability once"
          value={burst ? countRange(Math.round(burst.lo), Math.round(burst.hi)) : null}
          beside={
            hp == null || burst == null
              ? undefined
              : `${countRange(Math.round((burst.lo / hp) * 100), Math.round((burst.hi / hp) * 100))}% of ${count(hp)} HP`
          }
          sub={`at T${tier} · ${fixed(spiritPower, 0)} spirit power · no resists`}
          gap={
            yourAbilities.length === 0
              ? "This hero's assets payload carries no per-ability numerics. No burst to add up."
              : 'None of this hero’s served abilities carries a damage value at this tier.'
          }
        />
        <div className="lab-tcards-2">
          <Card
            small
            label="Your effective HP"
            value={ehp.vsBullets ? count(Math.round(ehp.vsBullets.ehp)) : null}
            sub={`vs bullets · ${ehp.vsSpirit ? count(Math.round(ehp.vsSpirit.ehp)) : '—'} vs spirit`}
            gap="Add items with health or resists. An empty board has no effective HP to state."
          />
          <Card
            small
            label="Their time to kill you"
            value={theirTtk ? rangeText(theirTtk, 's') : null}
            sub={`${target?.hero_name ?? 'Target'} gun only · ±12% DPS`}
            gap={NO_WEAPON_BASELINE}
          />
        </div>
      </div>

      <p className="lab-note">
        Target health = its served base plus{' '}
        {targetHpPerLevel == null ? 'its per-level growth' : `${fixed(targetHpPerLevel, 1)} per level`}, at level{' '}
        {level}. {THEORETICAL_NOTE}
        {assumed.map((k) => ` ${ASSUMPTIONS[k]}`).join('')}
      </p>
    </section>
  );
}
