//Golden tests for the build-stat calculator. Numbers are hand-derived from the live
//Infernus snapshot + item rows in buildFixtures.ts. The statlocker cross-check is the
//owner-supplied 4-tuple; the ordering + imbue/conditional builds lock the "hard 30 %".
import { describe, it, expect } from 'vitest';
import { computeStats, investmentTrack, levelScaling, type Spend, type StatLine } from './computeStats';
import { INFERNUS_ASSETS, INFERNUS_BASE, CATALOG } from './buildFixtures';

function line(lines: StatLine[], key: string): StatLine | undefined {
  return lines.find((l) => l.key === key);
}

//Item ids from the fixture (names in comments for the reader).
const TRANSCENDENT_COOLDOWN = 915014646;
const BALLISTIC_ENCHANTMENT = 3294954488;
const HOLLOW_POINT = 2678489038;
const EXTRA_HEALTH = 3633614685;
const INFUSER = 1797283378;
const DIVINERS_KEVLAR = 2820116164;
const BOUNDLESS_SPIRIT = 2519598785;
const SHADOW_STRIKE = 2319629810;
const NULLIFICATION_BURST = 3949773228;
const GLASS_CANNON = 365620721;
const SUPERIOR_COOLDOWN = 3261353684;
const EXTRA_SPIRIT = 968099481;
const NAPALM = 491391007; //Infernus signature1 (from /heroes/1/abilities)

describe('computeStats — statlocker cross-check (Infernus)', () => {
  //Reconstructed from the live catalog to reproduce the owner's statlocker screenshot targets.
  //The exact screenshot item list was not in the repo, so this 9-item build lands on three of the
  //four targets exactly and Max Health at 1,990 — base 830 + 1,160 flat, the integer item
  //granularity floor (the published 1,991 is one point above any reachable flat-HP sum).
  const build = {
    heroId: 1,
    items: [
      TRANSCENDENT_COOLDOWN, BALLISTIC_ENCHANTMENT, HOLLOW_POINT, EXTRA_HEALTH, INFUSER,
      DIVINERS_KEVLAR, BOUNDLESS_SPIRIT, SHADOW_STRIKE, NULLIFICATION_BURST,
    ],
  };
  const out = computeStats(INFERNUS_BASE, CATALOG, build);

  it('Max Health = 1,990 (base 830 × scale + 1,160 flat)', () => {
    expect(line(out.vitality, 'max_health')!.value).toBe(1990);
  });
  it('Spirit Power = 106 (flat; Boundless +15 % is inert at base 0 — proves base×scale+flat)', () => {
    expect(line(out.spirit, 'spirit_power')!.value).toBe(106);
  });
  it('Cooldown Reduction = −25 %', () => {
    expect(line(out.spirit, 'cooldown')!.value).toBe(-25);
  });
  it('Ability Range = +22 %', () => {
    expect(line(out.spirit, 'ability_range')!.value).toBe(22);
  });
  it('souls total = 52,798', () => {
    expect(out.spend.total).toBe(52798);
  });
});

describe('computeStats — application order (base × scale THEN flat adds)', () => {
  //Extra Health (+210 flat HP) + Glass Cannon (−13 % max health). The two orderings diverge:
  //  base×scale+flat = 830×0.87 + 210 = 932.1   (owner §4, what we implement)
  //  (base+flat)×scale = (830+210)×0.87 = 904.8  (the wrong order)
  const build = { heroId: 1, items: [EXTRA_HEALTH, GLASS_CANNON] };
  const out = computeStats(INFERNUS_BASE, CATALOG, build);

  it('applies the base scaler before the flat add (932.1, not 904.8)', () => {
    const hp = line(out.vitality, 'max_health')!.value;
    expect(hp).toBeCloseTo(932.1, 1);
    expect(hp).not.toBeCloseTo(904.8, 1);
  });
  it('surfaces Glass Cannon +80 % weapon damage', () => {
    expect(line(out.weapon, 'weapon_damage')!.value).toBe(80);
  });
});

describe('computeStats — imbue routing + conditionals + effective cost', () => {
  //Superior Cooldown (−20 % CD) imbued onto Napalm: cooldown is ability-scoped, so it leaves the
  //global Spirit panel and lands on the ability line only (owner §4). Extra Spirit is flagged
  //conditional; the global toggle includes/excludes its +10 spirit power whole.
  const baseBuild = {
    heroId: 1,
    items: [SUPERIOR_COOLDOWN, EXTRA_SPIRIT, EXTRA_HEALTH],
    imbueTargets: { [SUPERIOR_COOLDOWN]: NAPALM },
    conditionalItems: [EXTRA_SPIRIT],
  };

  it('imbued cooldown is off the global panel and on the ability line', () => {
    const out = computeStats(INFERNUS_BASE, CATALOG, { ...baseBuild, conditionalsOn: [EXTRA_SPIRIT] });
    expect(line(out.spirit, 'cooldown')).toBeUndefined();
    const abilityLines = out.perAbility[NAPALM] ?? [];
    expect(abilityLines).toHaveLength(1);
    const first = abilityLines[0];
    expect(first?.itemId).toBe(SUPERIOR_COOLDOWN);
    expect(first?.lines.find((l) => l.key === 'cooldown')?.value).toBe(-20);
  });

  it('conditional toggle gates the flagged item whole', () => {
    const on = computeStats(INFERNUS_BASE, CATALOG, { ...baseBuild, conditionalsOn: [EXTRA_SPIRIT] });
    const off = computeStats(INFERNUS_BASE, CATALOG, { ...baseBuild, conditionalsOn: [] });
    expect(line(on.spirit, 'spirit_power')!.value).toBe(10);
    expect(line(off.spirit, 'spirit_power')).toBeUndefined();
  });

  it('souls total uses effective cost when an item upgrades from a component', () => {
    //Extra Spirit (800) modelled as the component Superior Cooldown upgrades from: the 800 is
    //deducted once. (The catalog carries no lineage today; this locks the deduction mechanism.)
    const out = computeStats(INFERNUS_BASE, CATALOG, {
      ...baseBuild,
      conditionalsOn: [EXTRA_SPIRIT],
      upgradesFrom: { [SUPERIOR_COOLDOWN]: EXTRA_SPIRIT },
    });
    expect(out.spend.total).toBe(3200 + 800 + 800);
    expect(out.spend.effectiveTotal).toBe(3200 + 800 + 800 - 800);
  });

  it('spend splits by item slot category', () => {
    const out = computeStats(INFERNUS_BASE, CATALOG, { ...baseBuild, conditionalsOn: [EXTRA_SPIRIT] });
    expect(out.spend.spirit).toBe(3200 + 800); //Superior Cooldown + Extra Spirit
    expect(out.spend.vitality).toBe(800); //Extra Health
  });
});

const ASSETS = { assets: INFERNUS_ASSETS };

function spendOf(partial: Partial<Spend>): Spend {
  return { weapon: 0, vitality: 0, spirit: 0, flex: 0, total: 0, effectiveTotal: 0, ...partial };
}

describe('computeStats — investment track (11 thresholds, live cost_bonuses)', () => {
  const track = investmentTrack(INFERNUS_ASSETS, spendOf({ spirit: 0 }))!;

  it('serves 11 steps ending 22,400 / 28,800 — not the design 13-tick track', () => {
    const thresholds = track.spirit.steps.map((s) => s.threshold);
    expect(thresholds).toEqual([800, 1600, 2400, 3200, 4800, 6400, 8000, 11200, 16000, 22400, 28800]);
  });

  it('the seventh step is 8,000 — the design read it as 9,600', () => {
    expect(track.spirit.steps[6]!.threshold).toBe(8000);
    expect(track.spirit.steps.map((s) => s.threshold)).not.toContain(9600);
  });

  it('the 4,800 step is the spike: +19 spirit in one step against +4 the step before', () => {
    const below = investmentTrack(INFERNUS_ASSETS, spendOf({ spirit: 4799 }))!.spirit;
    const at = investmentTrack(INFERNUS_ASSETS, spendOf({ spirit: 4800 }))!.spirit;
    expect(below.applied).toEqual({ index: 4, threshold: 3200, bonus: 19 });
    expect(at.applied).toEqual({ index: 5, threshold: 4800, bonus: 38 });
    expect(at.applied!.bonus - below.applied!.bonus).toBe(19);
    expect(below.applied!.bonus - below.steps[2]!.bonus).toBe(4);
  });

  it('the highest step at or below the spend pays — 9,600 spent sits on the 8,000 step', () => {
    const row = investmentTrack(INFERNUS_ASSETS, spendOf({ spirit: 9600 }))!.spirit;
    expect(row.applied).toEqual({ index: 7, threshold: 8000, bonus: 52 });
    expect(row.next!.threshold).toBe(11200);
    expect(row.toNext).toBe(1600);
  });

  it('each category is paid in its own modifier (weapon damage %, BASE health %, flat spirit)', () => {
    expect(track.weapon.prop).toBe('MODIFIER_VALUE_WEAPON_DAMAGE_INCREASE');
    expect(track.vitality.prop).toBe('MODIFIER_VALUE_BASE_HEALTH_PERCENT');
    expect(track.spirit.prop).toBe('MODIFIER_VALUE_TECH_POWER');
  });

  it('no assets ⇒ no track at all (omit, never promise)', () => {
    expect(investmentTrack(null, spendOf({ spirit: 9600 }))).toBeNull();
    expect(computeStats(INFERNUS_BASE, CATALOG, { heroId: 1, items: [EXTRA_HEALTH] }).investment).toBeNull();
  });
});

describe('computeStats — investment applied to the panels', () => {
  it('vitality pays a percent of BASE health, folded before the flat add', () => {
    const build = { heroId: 1, items: [EXTRA_HEALTH] };
    const bare = computeStats(INFERNUS_BASE, CATALOG, build);
    const withTrack = computeStats(INFERNUS_BASE, CATALOG, build, ASSETS);
    expect(bare.spend.vitality).toBe(800);
    expect(line(bare.vitality, 'max_health')!.value).toBe(1040); //830 + 210
    //800 spent ⇒ +9 % of BASE health: 830 × 1.09 + 210.
    expect(line(withTrack.vitality, 'max_health')!.value).toBeCloseTo(1114.7, 4);
    expect(withTrack.investment!.vitality.applied).toEqual({ index: 1, threshold: 800, bonus: 9 });
  });

  it('weapon pays a weapon-damage percent onto the standalone bonus line', () => {
    const out = computeStats(INFERNUS_BASE, CATALOG, { heroId: 1, items: [HOLLOW_POINT] }, ASSETS);
    expect(out.spend.weapon).toBe(3200);
    expect(line(out.weapon, 'weapon_damage')!.value).toBe(53); //35 item + 18 track
  });

  it('spirit pays flat spirit power', () => {
    const out = computeStats(INFERNUS_BASE, CATALOG, { heroId: 1, items: [EXTRA_SPIRIT] }, ASSETS);
    expect(line(out.spirit, 'spirit_power')!.value).toBe(17); //10 item + 7 track
  });

  it('9,600 spirit spent pays the 8,000 step, not a 9,600 tick', () => {
    const out = computeStats(INFERNUS_BASE, CATALOG, {
      heroId: 1,
      items: [SUPERIOR_COOLDOWN, TRANSCENDENT_COOLDOWN],
    }, ASSETS);
    expect(out.spend.spirit).toBe(9600);
    expect(out.investment!.spirit.applied!.threshold).toBe(8000);
    expect(line(out.spirit, 'spirit_power')!.value).toBe(52);
  });

  it('a category with nothing spent pays nothing', () => {
    const out = computeStats(INFERNUS_BASE, CATALOG, { heroId: 1, items: [EXTRA_SPIRIT] }, ASSETS);
    expect(out.investment!.weapon.applied).toBeNull();
    expect(out.investment!.weapon.next!.threshold).toBe(800);
  });
});

describe('computeStats — per-level scaling', () => {
  it('level 1 is the identity — the goldens above are the level-1 build', () => {
    const build = { heroId: 1, items: [EXTRA_HEALTH] };
    const one = computeStats(INFERNUS_BASE, CATALOG, build, { assets: INFERNUS_ASSETS, level: 1 });
    const none = computeStats(INFERNUS_BASE, CATALOG, build, ASSETS);
    expect(line(one.vitality, 'max_health')!.value).toBe(line(none.vitality, 'max_health')!.value);
    expect(one.levelScaling!.level).toBe(1);
    expect(one.levelScaling!.rows.find((r) => r.statKey === 'max_health')!.applied).toBe(0);
  });

  it('health grows into the BASE term, so the investment percent scales it too', () => {
    const out = computeStats(INFERNUS_BASE, CATALOG, { heroId: 1, items: [EXTRA_HEALTH] }, {
      assets: INFERNUS_ASSETS,
      level: 20,
    });
    const hp = line(out.vitality, 'max_health')!;
    expect(hp.base).toBe(1571); //830 + 39 × 19
    expect(hp.value).toBeCloseTo(1922.39, 4); //1571 × 1.09 + 210
  });

  it('spirit power grows into the BASE term, so TECH_POWER_PERCENT bites at level', () => {
    const build = { heroId: 1, items: [EXTRA_SPIRIT, BOUNDLESS_SPIRIT] };
    const one = computeStats(INFERNUS_BASE, CATALOG, build, ASSETS);
    const twenty = computeStats(INFERNUS_BASE, CATALOG, build, { assets: INFERNUS_ASSETS, level: 20 });
    //7,200 spirit spent ⇒ +45 flat. Level 1: base 0, so the +15 % is inert (85 = 10 + 30 + 45).
    expect(line(one.spirit, 'spirit_power')!.value).toBe(85);
    //Level 20: base 1.1 × 19 = 20.9 scaled by 1.15, then the flat adds.
    expect(line(twenty.spirit, 'spirit_power')!.value).toBeCloseTo(109.035, 4);
  });

  it('the level cap clamps at 36', () => {
    const out = computeStats(INFERNUS_BASE, CATALOG, { heroId: 1, items: [] }, {
      assets: INFERNUS_ASSETS,
      level: 99,
    });
    expect(out.levelScaling!.level).toBe(36);
    expect(levelScaling(INFERNUS_ASSETS, 99)!.level).toBe(36);
  });

  it('no assets ⇒ no scaling rows', () => {
    expect(computeStats(INFERNUS_BASE, CATALOG, { heroId: 1, items: [] }, { level: 20 }).levelScaling).toBeNull();
  });
});

describe('computeStats — weapon DPS derivation', () => {
  //6 damage every 0.1 s, 20-round clip, 2 s reload: 60 burst DPS, 30 sustained.
  const BASELINE = { bulletDamage: 6, cycleTime: 0.1, clipSize: 20, reloadTime: 2 };

  it('omits the rows entirely without a weapon baseline (nothing served carries one)', () => {
    expect(computeStats(INFERNUS_BASE, CATALOG, { heroId: 1, items: [HOLLOW_POINT] }).weaponDps).toBeNull();
  });

  it('applies the build weapon-damage percent to both DPS rows', () => {
    const out = computeStats(INFERNUS_BASE, CATALOG, { heroId: 1, items: [HOLLOW_POINT] }, { weapon: BASELINE });
    const dps = out.weaponDps!;
    expect(dps.burstDps).toBeCloseTo(81, 6); //6 × 1.35 / 0.1
    expect(dps.sustainedDps).toBeCloseTo(40.5, 6); //20 × 8.1 / (20 × 0.1 + 2)
    const burstRow = dps.rows.find((r) => r.key === 'weapon_dps_burst')!;
    expect(burstRow.base).toBeCloseTo(60, 6);
  });

  it('fire rate shortens the cycle and ammo lengthens the clip', () => {
    const FAST: typeof CATALOG = [{
      item_id: 1, item_name: 'Test Rapid', item_slot_type: 'weapon', item_tier: 1, cost: 500,
      modifiers: [
        { property_type: 'MODIFIER_VALUE_FIRE_RATE', value: 25, is_percent: true },
        { property_type: 'MODIFIER_VALUE_AMMO_CLIP_SIZE', value: 5, is_percent: false },
        { property_type: 'MODIFIER_VALUE_RELOAD_SPEED', value: 100, is_percent: true },
      ],
    }];
    const dps = computeStats(INFERNUS_BASE, FAST, { heroId: 1, items: [1] }, { weapon: BASELINE }).weaponDps!;
    expect(dps.rows.find((r) => r.key === 'fire_rate_shots')!.value).toBeCloseTo(12.5, 6); //1 / (0.1 / 1.25)
    expect(dps.rows.find((r) => r.key === 'clip_size')!.value).toBe(25);
    expect(dps.rows.find((r) => r.key === 'reload_time')!.value).toBeCloseTo(1, 6);
    expect(dps.burstDps).toBeCloseTo(75, 6); //6 / 0.08
    expect(dps.sustainedDps).toBeCloseTo((25 * 6) / (25 * 0.08 + 1), 6);
  });
});
