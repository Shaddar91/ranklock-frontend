import { describe, expect, it } from 'vitest';
import { encodeBuild } from '../../../lib/buildShare';
import {
  abilitySteps,
  abilitySummaries,
  boardItems,
  buildContents,
  buildModifiers,
  investmentBonusText,
  matchServedOrder,
  parseImport,
  phaseGroups,
  purchaseRows,
  slotNote,
  tierAbilities,
  type BuildEntry,
} from './analyzeModel';
import type { CatalogItem } from '../creator/buildModel';
import type { ComputedStats, InvestmentRow } from '../../../lib/computeStats';
import type { AbilityOrder, HeroAbilityNumerics, LaneCurvePoint } from '../../../types/api';

const COMPONENT = 334300056;
const UPGRADE = 564937160;

function item(id: number, cost: number, extra: Partial<CatalogItem> = {}): CatalogItem {
  return {
    item_id: id,
    item_name: `Item ${id}`,
    item_slot_type: 'spirit',
    item_tier: 2,
    cost,
    icon: null,
    modifiers: [],
    ...extra,
  };
}

const catalog = new Map<number, CatalogItem>([
  [COMPONENT, item(COMPONENT, 1600)],
  [UPGRADE, item(UPGRADE, 6200)],
  [11, item(11, 800)],
]);

const entries = (ids: number[]): BuildEntry[] => ids.map((itemId) => ({ itemId, category: 'Core' }));

describe('parseImport', () => {
  it('takes a bare build id', () => {
    expect(parseImport(' 393691 ')).toEqual({ kind: 'id', buildId: 393691 });
  });

  it('digs the id out of a link', () => {
    expect(parseImport('https://ranklock.app/builds/184023/')).toEqual({ kind: 'id', buildId: 184023 });
    expect(parseImport('https://x.test/lab?build_id=77&x=1')).toEqual({ kind: 'id', buildId: 77 });
  });

  it('round-trips a RankLock share link into a board, no fetch', () => {
    const link = `https://ranklock.app/build-lab#${encodeBuild({ heroId: 6, items: [11, UPGRADE] })}`;
    const ref = parseImport(link);
    expect(ref.kind).toBe('board');
    if (ref.kind !== 'board') throw new Error('expected a board');
    expect(ref.build.items).toEqual([11, UPGRADE]);
    expect(ref.build.heroId).toBe(6);
  });

  it('refuses an in-game Build Browser code instead of guessing at it', () => {
    const ref = parseImport('A3F-QQZK-MMTP');
    expect(ref.kind).toBe('error');
    if (ref.kind !== 'error') throw new Error('expected an error');
    expect(ref.message).toContain('Build Browser codes cannot be read here');
  });

  it('rejects an empty field', () => {
    expect(parseImport('   ').kind).toBe('error');
  });
});

describe('buildContents', () => {
  const build = {
    categories: [
      { name: '1', description: '', items: [{ item_id: 11 }, { item_id: COMPONENT }] },
      { name: '', description: '', items: [] },
      { name: '2', description: '', items: [{ item_id: 11 }, { item_id: UPGRADE }, { item_id: null }] },
    ],
    ability_order: {
      currency_changes: [
        { ability_id: 1, currency_type: 2, delta: 0 },
        { ability_id: 1, currency_type: 1, delta: -1 },
        { ability_id: 2, currency_type: 2, delta: 0 },
        { ability_id: 1, currency_type: 1, delta: -2 },
      ],
    },
  };

  it('keeps first occurrence only and counts categories that carry items', () => {
    const c = buildContents(build);
    expect(c.entries.map((e) => e.itemId)).toEqual([11, COMPONENT, UPGRADE]);
    expect(c.categories).toBe(2);
    expect(c.items).toBe(3);
    expect(c.points).toBe(4);
  });

  it('caps the board at the 12 slots the game has', () => {
    const many = entries(Array.from({ length: 20 }, (_, i) => (i === 0 ? 11 : COMPONENT + i)));
    expect(boardItems(many, new Map([...catalog, ...many.map((e) => [e.itemId, item(e.itemId, 100)] as const)])).length).toBe(12);
  });
});

describe('purchaseRows', () => {
  it('pays cost minus the owned component on an upgrade row', () => {
    const rows = purchaseRows(entries([COMPONENT, UPGRADE]), catalog);
    expect(rows[0]!.paid).toBe(1600);
    expect(rows[1]!.upgradeFrom?.id).toBe(COMPONENT);
    expect(rows[1]!.paid).toBe(6200 - 1600);
    expect(rows[1]!.running).toBe(1600 + 4600);
  });

  it('pays the full price when the component was never bought', () => {
    const rows = purchaseRows(entries([UPGRADE]), catalog);
    expect(rows[0]!.upgradeFrom).toBeNull();
    expect(rows[0]!.paid).toBe(6200);
  });

  it('carries an id the catalog does not know without inventing a cost', () => {
    const rows = purchaseRows(entries([99999]), catalog);
    expect(rows[0]!.cost).toBeNull();
    expect(rows[0]!.paid).toBeNull();
    expect(rows[0]!.running).toBe(0);
  });
});

describe('phaseGroups', () => {
  //wire p50 is THOUSANDS of souls, so 2 = 2,000 souls.
  const curve: LaneCurvePoint[] = [
    { minute_bucket: 1, t_seconds: 300, sample_players: 9, p25: null, p50: 2, p75: null },
    { minute_bucket: 4, t_seconds: 900, sample_players: 9, p25: null, p50: 9, p75: null },
    { minute_bucket: 8, t_seconds: 1800, sample_players: 9, p25: null, p50: 25, p75: null },
  ];

  it('bands rows by the minute the running total becomes affordable', () => {
    const rows = purchaseRows(entries([11, COMPONENT, UPGRADE]), catalog);
    const groups = phaseGroups(rows, curve);
    expect(groups.map((g) => g.name)).toEqual(['Laning', 'Mid game']);
    expect(groups[0]!.rows.map((r) => r.itemId)).toEqual([11, COMPONENT]);
    expect(groups[0]!.souls).toBe(2400);
    expect(groups[1]!.rows.map((r) => r.itemId)).toEqual([UPGRADE]);
  });

  it('collapses to one unbanded group when no curve is served', () => {
    const groups = phaseGroups(purchaseRows(entries([11]), catalog), []);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.name).toBe('Purchase order');
  });
});

describe('slotNote', () => {
  it('names the flex slots the board needs', () => {
    expect(slotNote(9)).toBe('fits the 9 base slots');
    expect(slotNote(11)).toBe('needs 2 flex slots (2 enemy Walkers down)');
    expect(slotNote(10)).toBe('needs 1 flex slot (1 enemy Walker down)');
    expect(slotNote(15)).toContain('3 past the 12-slot board');
  });
});

describe('abilitySteps', () => {
  //Live shape (probed 2026-09-12): currency_type 2 / delta 0 is the unlock, type 1 a tier.
  const order = {
    currency_changes: [
      { ability_id: 10, currency_type: 2, delta: 0 },
      { ability_id: 20, currency_type: 2, delta: 0 },
      { ability_id: 20, currency_type: 1, delta: -1 },
      { ability_id: 20, currency_type: 1, delta: -2 },
      { ability_id: 10, currency_type: 1, delta: -1 },
      { ability_id: 20, currency_type: 1, delta: -5 },
    ],
  };

  it('reads the unlock apart from the tiers', () => {
    const steps = abilitySteps(order);
    expect(steps.map((s) => s.tier)).toEqual([null, null, 1, 2, 1, 3]);
    expect(steps[5]!.points).toBe(5);
    expect(steps[0]!.pos).toBe(1);
  });

  it("summarises where each ability's points land", () => {
    const rows = abilitySummaries(abilitySteps(order));
    const twenty = rows.find((r) => r.abilityId === 20)!;
    expect(twenty.unlockAt).toBe(2);
    expect(twenty.tiers).toEqual([{ tier: 1, at: 3 }, { tier: 2, at: 4 }, { tier: 3, at: 6 }]);
  });

  it('reads an absent order as no points', () => {
    expect(abilitySteps(undefined)).toEqual([]);
    expect(abilitySteps({ currency_changes: 'nope' })).toEqual([]);
  });
});

describe('matchServedOrder', () => {
  const served = (abilities: number[], win_rate: number, matches: number): AbilityOrder => ({
    abilities,
    wins: 0,
    losses: 0,
    matches,
    players: 0,
    win_rate,
  });
  const steps = abilitySteps({
    currency_changes: [1, 2, 1, 3].map((ability_id) => ({ ability_id, currency_type: 1, delta: -1 })),
  });

  it('takes an exact match', () => {
    const m = matchServedOrder(steps, [served([9, 9], 0.4, 10), served([1, 2, 1, 3], 0.56, 1880)]);
    expect(m?.order.matches).toBe(1880);
    expect(m?.prefix).toBeNull();
  });

  it('falls back to a shorter served order that matches the opening run', () => {
    const m = matchServedOrder(steps, [served([1, 2, 1], 0.52, 12410)]);
    expect(m?.prefix).toBe(3);
  });

  it('invents nothing when no served order matches', () => {
    expect(matchServedOrder(steps, [served([3, 2, 1, 1], 0.6, 99)])).toBeNull();
    expect(matchServedOrder(steps, undefined)).toBeNull();
  });
});

describe('tierAbilities', () => {
  const ability: HeroAbilityNumerics = {
    ability_id: 7,
    class_name: 'citadel_ability_x',
    slot: 'signature1',
    order: 1,
    name: 'Siphon Life',
    properties: [
      { name: 'AbilityCooldown', label: 'Cooldown', value: 42, kind: 'cooldown' },
      { name: 'AbilityDuration', label: 'Duration', value: 4, kind: 'duration' },
      { name: 'AbilityCastRange', label: 'Cast Range', value: 30, kind: 'range' },
      {
        name: 'DPS',
        label: 'Damage Per Second',
        value: 22,
        kind: 'tech_damage',
        scaling: { stat: 'ETechPower', scale: 0.6 },
      },
    ],
    tiers: [
      { tier: 1, upgrades: [{ name: 'AbilityCooldown', bonus: -20 }] },
      { tier: 2, upgrades: [{ name: 'AbilityDuration', bonus: '2' }] },
      { tier: 3, upgrades: [{ name: 'DPS', bonus: 18 }] },
    ],
  };

  it('applies every tier up to the selected one', () => {
    const t1 = tierAbilities([ability], 1)[0]!;
    expect(t1.baseline.cooldown).toBe(22);
    expect(t1.baseline.duration).toBe(4);
    expect(t1.baseline.damage).toBe(22);

    const t3 = tierAbilities([ability], 3)[0]!;
    expect(t3.baseline.cooldown).toBe(22);
    expect(t3.baseline.duration).toBe(6);
    expect(t3.baseline.damage).toBe(40);
    expect(t3.labels.damage).toBe('Damage Per Second');
  });

  it('carries the served spirit scaling and nothing else', () => {
    expect(tierAbilities([ability], 1)[0]!.baseline.spiritScaling).toBe(0.6);
    const noScale = { ...ability, properties: ability.properties.map((p) => ({ ...p, scaling: undefined })) };
    expect(tierAbilities([noScale], 1)[0]!.baseline.spiritScaling).toBeNull();
  });

  it('flags a tier that lists two upgrades on one stat instead of silently adding them', () => {
    const twin = {
      ...ability,
      tiers: [{ tier: 1, upgrades: [{ name: 'DPS', bonus: 18 }, { name: 'DPS', bonus: 0.12 }] }],
    };
    expect(tierAbilities([twin], 1)[0]!.notes[0]).toContain('two upgrades on DPS');
  });
});

describe('buildModifiers', () => {
  const stats = {
    weapon: [],
    vitality: [],
    spirit: [
      { key: 'spirit_power', label: 'Spirit Power', category: 'spirit', unit: 'flat', base: 0, value: 30, delta: 30 },
      { key: 'ability_duration', label: 'Ability Duration', category: 'spirit', unit: 'percent', base: 0, value: 12, delta: 12 },
    ],
    perAbility: {},
    spend: { weapon: 0, vitality: 0, spirit: 0, flex: 0, total: 0, effectiveTotal: 0 },
    investment: null,
    levelScaling: null,
    weaponDps: null,
  } as ComputedStats;

  it('keeps cooldown reduction per source so C24 can compound it', () => {
    const cdrItem = (id: number, value: number) =>
      item(id, 3000, { modifiers: [{ property_type: 'MODIFIER_VALUE_COOLDOWN_REDUCTION_PERCENTAGE', value, is_percent: true }] });
    const mods = buildModifiers(stats, [1, 2], new Map([[1, cdrItem(1, 25)], [2, cdrItem(2, 20)]]));
    expect(mods.cdr).toEqual([0.25, 0.2]);
    expect(mods.spiritPower).toBe(30);
    expect(mods.durationPct).toBe(12);
    expect(mods.rangePct).toBe(0);
  });
});

describe('investmentBonusText', () => {
  const row = (prop: string, bonus: number): InvestmentRow => ({
    category: 'spirit',
    prop,
    spend: 5000,
    steps: [],
    applied: { index: 5, threshold: 4800, bonus },
    next: null,
    toNext: null,
  });

  it("prints the payout in the shop's own wording", () => {
    expect(investmentBonusText(row('MODIFIER_VALUE_TECH_POWER', 38))).toBe('+38 spirit power');
    expect(investmentBonusText(row('MODIFIER_VALUE_WEAPON_DAMAGE_INCREASE', 42))).toBe('+42% weapon damage');
    expect(investmentBonusText(row('MODIFIER_VALUE_BASE_HEALTH_PERCENT', 45))).toBe('+45% max health');
  });

  it('says nothing when no step has been paid', () => {
    expect(investmentBonusText({ ...row('MODIFIER_VALUE_TECH_POWER', 0), applied: null })).toBeNull();
  });
});
