import { describe, it, expect } from 'vitest';
import { abilityCards, baseStatRows, perLevelRows, plainText, statChips } from './heroKit';
import type { HeroAbility, HeroAssetsResponse } from '../types/api';

describe('plainText', () => {
  it('strips the inline markup upstream ships inside ability text', () => {
    expect(plainText('Throw a dagger that <span class="highlight">sleeps</span> the target.')).toBe(
      'Throw a dagger that sleeps the target.',
    );
    expect(plainText('<svg viewBox="0 0 1 1"><path d="M0"/></svg>Damage')).toBe('Damage');
    expect(plainText('a&nbsp;b<br/>c')).toBe('a b c');
    expect(plainText(null)).toBe('');
  });
});

describe('statChips', () => {
  it('keeps only labelled properties that carry a real value', () => {
    const chips = statChips([
      { name: 'AbilityCooldown', value: 30, label: 'Cooldown', unit: 's', kind: 'cooldown' },
      { name: 'AbilityCastRange', value: '0', label: 'Cast Range', unit: 'm', kind: 'range' },
      { name: 'AbilityResourceCost', value: '5', kind: 'cast' },
    ]);
    expect(chips).toEqual([{ k: 'Cooldown', v: '30s' }]);
  });

  it('orders cooldown and damage ahead of the rest and caps the row', () => {
    const chips = statChips(
      [
        { name: 'SleepDuration', value: '2.75', label: 'Sleep Duration', unit: 's', kind: 'duration' },
        { name: 'Damage', value: 65, label: 'Damage', kind: 'tech_damage' },
        { name: 'AbilityCooldown', value: 30, label: 'Cooldown', unit: 's', kind: 'cooldown' },
      ],
      2,
    );
    expect(chips.map((c) => c.k)).toEqual(['Cooldown', 'Damage']);
    expect(chips[1]?.v).toBe('65');
  });

  it('does not double a unit upstream already baked into the value', () => {
    expect(statChips([{ name: 'SleepMoveSpeed', value: '1.5m', label: 'Sleep Movespeed', unit: 'm', kind: 'move_speed' }])).toEqual([
      { k: 'Sleep Movespeed', v: '1.5m' },
    ]);
  });
});

describe('abilityCards', () => {
  const abilities: HeroAbility[] = [
    { ability_id: 11, class_name: 'a', slot: 'signature2', order: 2, name: 'Smoke Bomb' },
    { ability_id: 10, class_name: 'b', slot: 'signature1', order: 1, name: 'Sleep Dagger', description: { desc: 'Throw a <b>dagger</b>.' } },
    { ability_id: 99, class_name: 'c', slot: 'ability_innate1', order: 11, name: 'Dash' },
  ];

  it('keeps the four signature slots in slot order and drops innates', () => {
    const { cards } = abilityCards(abilities, null);
    expect(cards.map((c) => c.name)).toEqual(['Sleep Dagger', 'Smoke Bomb']);
    expect(cards.map((c) => c.key)).toEqual([1, 2]);
  });

  it('records which source rendered the text', () => {
    expect(abilityCards(abilities, null).textSource).toBe('abilities-route');
    const assets = {
      abilities: [{ ability_id: 11, class_name: 'a', slot: 'signature2', order: 2, description: 'Drop a smoke.', properties: [], tiers: [] }],
    } as unknown as HeroAssetsResponse;
    const noRouteText: HeroAbility[] = [{ ability_id: 11, class_name: 'a', slot: 'signature2', order: 2, name: 'Smoke Bomb' }];
    const out = abilityCards(noRouteText, assets);
    expect(out.textSource).toBe('assets-localization');
    expect(out.cards[0]?.description).toBe('Drop a smoke.');
    expect(abilityCards([], null).textSource).toBe('none');
  });

  it('prefers the tier description and falls back to the upgrade values', () => {
    const assets = {
      abilities: [
        {
          ability_id: 10,
          class_name: 'b',
          slot: 'signature1',
          order: 1,
          properties: [],
          tiers: [
            { tier: 1, upgrades: [{ name: 'AbilityCooldown', bonus: -20 }] },
            { tier: 2, upgrades: [{ name: 'Radius', bonus: '2m' }], description: '<span>+2m</span> Radius' },
          ],
        },
      ],
    } as unknown as HeroAssetsResponse;
    const { cards } = abilityCards([abilities[1] as HeroAbility], assets);
    expect(cards[0]?.tiers).toEqual([
      { label: 'T1', effect: '-20 Cooldown' },
      { label: 'T2', effect: '+2m Radius' },
    ]);
  });
});

describe('base and per-level panels', () => {
  it('reads the client stat objects and labels them', () => {
    const rows = baseStatRows({
      max_health: { display_stat_name: 'EMaxHealth', value: 800 },
      crit_damage_received_scale: { display_stat_name: 'ECritDamageReceivedScale', value: 1 },
      stamina: { display_stat_name: 'EStamina', value: 3 },
    });
    expect(rows).toEqual([
      { k: 'Max Health', v: '800' },
      { k: 'Stamina', v: '3' },
    ]);
  });

  it('is empty rather than fabricated when the payload has no stats', () => {
    expect(baseStatRows(null)).toEqual([]);
    expect(perLevelRows(undefined)).toEqual([]);
  });

  it('drops the zeroed per-level upgrades and signs the rest', () => {
    expect(
      perLevelRows({
        MODIFIER_VALUE_BASE_HEALTH_FROM_LEVEL: 49,
        MODIFIER_VALUE_TECH_POWER: 1.1,
        MODIFIER_VALUE_BONUS_ATTACK_RANGE: 0,
      }),
    ).toEqual([
      { k: 'Max health', v: '+49' },
      { k: 'Spirit power', v: '+1.1' },
    ]);
  });
});
