//Golden tests for the Build Lab calculators. Each case pins a formula the design or the research
//got wrong or left implicit: the multiplicative CDR stack, the interpolated affordable-at, the
//compounding resist stack, and the fact that every theoretical output ships its labels.
import { describe, it, expect } from 'vitest';
import {
  ASSUMPTIONS,
  CHANNEL_MAX,
  ENEMY_DPS_BAND,
  MAX_LEVEL,
  PACE_FAST,
  PACE_SLOW,
  THEORETICAL_NOTE,
  abilitiesWithBuild,
  abilityWithBuild,
  affordableAt,
  affordableWindow,
  burstDamage,
  cumulativeCosts,
  effectiveHp,
  effectiveHpPair,
  multiplicativeCdr,
  spiritScaleOf,
  targetHp,
  theirTimeToKill,
  timeToKill,
} from './labCalc';

//A two-point souls curve: 4,000 at 3:00 and 12,000 at 6:00, so a build costing 8,000 lands
//exactly halfway between the served points and has to be interpolated.
const CURVE = [
  { t_seconds: 180, p25: 3000, p50: 4000, p75: 5000 },
  { t_seconds: 360, p25: 9000, p50: 12000, p75: 15000 },
];

describe('labCalc — affordable at', () => {
  it('interpolates between two served points (8,000 souls ⇒ 4:30)', () => {
    const at = affordableAt(CURVE, 8000, 'p50')!;
    expect(at.tSeconds).toBe(270);
    expect(at.interpolated).toBe(true);
    expect(at.percentile).toBe('p50');
  });

  it('lands on the served point when the cost matches it exactly', () => {
    const at = affordableAt(CURVE, 12000, 'p50')!;
    expect(at.tSeconds).toBe(360);
    expect(at.interpolated).toBe(false);
  });

  it('reads the percentile it is asked for', () => {
    expect(affordableAt(CURVE, 6000, 'p25')!.tSeconds).toBe(270); //3,000 → 9,000
    expect(affordableAt(CURVE, 10000, 'p75')!.tSeconds).toBe(270); //5,000 → 15,000
  });

  it('never extrapolates past the tail — an unreachable cost has no minute', () => {
    expect(affordableAt(CURVE, 40000, 'p50')).toBeNull();
    expect(affordableAt([], 8000)).toBeNull();
  });

  it('an empty board is affordable at 0:00', () => {
    expect(affordableAt(CURVE, 0)!.tSeconds).toBe(0);
  });

  it('the slow / fast window moves the cost, and says the factors are editorial', () => {
    const window = affordableWindow(CURVE, 8000, 'p50');
    expect(PACE_SLOW).toBe(1.2);
    expect(PACE_FAST).toBe(0.85);
    expect(window.mid!.tSeconds).toBe(270);
    expect(window.slow!.tSeconds).toBeCloseTo(306, 6); //cost 9,600
    expect(window.fast!.tSeconds).toBeCloseTo(243, 6); //cost 6,800
    expect(window.assumed).toContain('pace-factors');
  });

  it('cumulative costs are the timeline x-input', () => {
    expect(cumulativeCosts([800, 3200, 4000])).toEqual([800, 4000, 8000]);
  });
});

describe('labCalc — abilities with the build', () => {
  const ABILITY = { abilityId: 1, name: 'Napalm', damage: 100, spiritScaling: 1.5, cooldown: 10, duration: 6, range: 30 };

  it('cooldown compounds, it never sums — 25 % and 20 % give 6.0 s, not 5.5 s', () => {
    const out = abilityWithBuild(ABILITY, { spiritPower: 0, cdr: [0.25, 0.2], durationPct: 0, rangePct: 0 });
    expect(out.cooldown!.value).toBeCloseTo(6, 6); //10 × 0.75 × 0.80
    expect(out.cooldown!.value).not.toBeCloseTo(5.5, 6); //the additive line the panel displays
    expect(multiplicativeCdr([0.25, 0.2])).toBeCloseTo(0.4, 6);
  });

  it('a single CDR source is identical either way — the stack is where they diverge', () => {
    const out = abilityWithBuild(ABILITY, { spiritPower: 0, cdr: [0.25], durationPct: 0, rangePct: 0 });
    expect(out.cooldown!.value).toBeCloseTo(7.5, 6);
  });

  it('damage adds spirit power × the served scale, and says the shape is assumed', () => {
    const out = abilityWithBuild(ABILITY, { spiritPower: 40, cdr: [], durationPct: 0, rangePct: 0 });
    expect(out.damage).toEqual({ base: 100, value: 160, fromSpirit: 60 });
    expect(out.assumed).toContain('spirit-scaling');
  });

  it('no served scale ⇒ the damage EXCLUDES spirit and says so', () => {
    const out = abilityWithBuild({ ...ABILITY, spiritScaling: null }, {
      spiritPower: 40,
      cdr: [],
      durationPct: 0,
      rangePct: 0,
    });
    expect(out.damage!.value).toBe(100);
    expect(out.damage!.fromSpirit).toBe(0);
    expect(out.assumed).toContain('spirit-scaling-missing');
  });

  it('duration and range take the summed percent', () => {
    const out = abilityWithBuild(ABILITY, { spiritPower: 0, cdr: [], durationPct: 22, rangePct: 22 });
    expect(out.duration!.value).toBeCloseTo(7.32, 6);
    expect(out.range!.value).toBeCloseTo(36.6, 6);
  });

  it('an absent numeric stays absent — never a zero standing in for one', () => {
    const out = abilityWithBuild({ abilityId: 2, name: 'Unknown' }, {
      spiritPower: 40,
      cdr: [0.25],
      durationPct: 10,
      rangePct: 10,
    });
    expect(out.damage).toBeNull();
    expect(out.cooldown).toBeNull();
    expect(out.duration).toBeNull();
    expect(out.range).toBeNull();
  });

  it('reads the spirit scale only off an ETechPower row that carries one', () => {
    expect(spiritScaleOf({ stat: 'ETechPower', scale: 0.6 })).toBe(0.6);
    expect(spiritScaleOf({ stat: 'ETechPower' })).toBeNull();
    expect(spiritScaleOf({ stat: 'ETechDuration', scale: 0.6 })).toBeNull();
    expect(spiritScaleOf(undefined)).toBeNull();
  });

  it('folds a whole kit at once', () => {
    const out = abilitiesWithBuild([ABILITY, { ...ABILITY, abilityId: 2 }], {
      spiritPower: 0,
      cdr: [0.25, 0.2],
      durationPct: 0,
      rangePct: 0,
    });
    for (const a of out) expect(a.cooldown!.value).toBeCloseTo(6, 6);
  });
});

describe('labCalc — target, time to kill, burst', () => {
  it('target HP is base plus per-level growth, capped at level 36', () => {
    expect(targetHp(830, 39, 20)).toBe(1571);
    expect(targetHp(830, 39, 1)).toBe(830);
    expect(targetHp(830, 39, 99)).toBe(830 + 39 * (MAX_LEVEL - 1));
  });

  it('time to kill is a range: the fast DPS gives the low bound', () => {
    const ttk = timeToKill(1000, 80, 120)!;
    expect(ttk.lo).toBeCloseTo(8.3333, 4);
    expect(ttk.hi).toBeCloseTo(12.5, 4);
    expect(ttk.note).toBe(THEORETICAL_NOTE);
  });

  it('no DPS, no answer', () => {
    expect(timeToKill(1000, 0, 0)).toBeNull();
    expect(timeToKill(0, 80, 120)).toBeNull();
  });

  it('burst widens by the channel window on the channelled part only', () => {
    const out = burstDamage(
      [{ damage: 100, spiritScaling: 1.2 }, { damage: 200, spiritScaling: 0.8, channelled: true }],
      50,
    )!;
    expect(out.lo).toBeCloseTo(400, 6); //160 + 240
    expect(out.hi).toBeCloseTo(460, 6); //160 + 240 × 1.25
    expect(CHANNEL_MAX).toBe(1.25);
    expect(out.assumed).toContain('channel-window');
    expect(out.assumed).toContain('spirit-scaling');
  });

  it('an instant-only burst is a point, still carrying the note', () => {
    const out = burstDamage([{ damage: 100 }], 0)!;
    expect(out.lo).toBe(100);
    expect(out.hi).toBe(100);
    expect(out.note).toBe(THEORETICAL_NOTE);
  });
});

describe('labCalc — effective HP and their time to kill you', () => {
  it('two stacked resists compound — 30 % and 20 % give 1,785.7 eHP, not 2,000', () => {
    const out = effectiveHp(1000, [30, 20])!;
    expect(out.ehp).toBeCloseTo(1785.7143, 4); //1000 / (0.7 × 0.8)
    expect(out.ehp).not.toBeCloseTo(2000, 4); //the additive 50 % reading
    expect(out.combinedResist).toBeCloseTo(0.44, 6);
    expect(out.assumed).toContain('resists-multiplicative');
  });

  it('a negative resist amplifies', () => {
    expect(effectiveHp(1000, [-25])!.ehp).toBeCloseTo(800, 6);
  });

  it('total immunity has no finite answer', () => {
    expect(effectiveHp(1000, [100])).toBeNull();
    expect(effectiveHp(0, [30])).toBeNull();
  });

  it('bullets and spirit are answered separately', () => {
    const pair = effectiveHpPair(1000, [30, 20], [10]);
    expect(pair.vsBullets!.ehp).toBeCloseTo(1785.7143, 4);
    expect(pair.vsSpirit!.ehp).toBeCloseTo(1111.1111, 4);
  });

  it('their time to kill you spans the editorial ±12 % DPS band', () => {
    const out = theirTimeToKill(2000, 100)!;
    expect(ENEMY_DPS_BAND).toBe(0.12);
    expect(out.lo).toBeCloseTo(2000 / 112, 6);
    expect(out.hi).toBeCloseTo(2000 / 88, 6);
    expect(out.assumed).toContain('enemy-dps-band');
  });
});

describe('labCalc — every theoretical output ships its labels', () => {
  it('carries the standing note so the UI cannot render one bare', () => {
    const outputs = [
      timeToKill(1000, 80, 120)!,
      burstDamage([{ damage: 100 }], 0)!,
      theirTimeToKill(2000, 100)!,
      effectiveHp(1000, [30])!,
      abilityWithBuild({ abilityId: 1, name: 'x', damage: 100, cooldown: 10 }, {
        spiritPower: 0,
        cdr: [],
        durationPct: 0,
        rangePct: 0,
      }),
    ];
    for (const out of outputs) expect(out.note).toBe(THEORETICAL_NOTE);
  });

  it('every assumption key it emits has copy to render', () => {
    const emitted = [
      ...theirTimeToKill(2000, 100)!.assumed,
      ...effectiveHp(1000, [30])!.assumed,
      ...burstDamage([{ damage: 1, channelled: true }], 0)!.assumed,
      ...affordableWindow(CURVE, 8000).assumed,
      ...abilityWithBuild({ abilityId: 1, name: 'x', damage: 1, spiritScaling: 1 }, {
        spiritPower: 1,
        cdr: [],
        durationPct: 0,
        rangePct: 0,
      }).assumed,
    ];
    expect(emitted.length).toBeGreaterThan(0);
    for (const key of emitted) expect(ASSUMPTIONS[key]).toBeTruthy();
  });
});
