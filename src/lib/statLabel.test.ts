import { describe, it, expect } from 'vitest';
import { prettyLabel, statLabel } from './statLabel';

describe('prettyLabel', () => {
  it('segments a boundary-less lowercase key into readable stat words', () => {
    expect(prettyLabel('abilityresourceregenpersecond')).toBe('Ability Resource Regen Per Second');
  });

  it('splits on camelCase / PascalCase boundaries', () => {
    expect(prettyLabel('MaxHealth')).toBe('Max Health');
    expect(prettyLabel('BaseWeaponDamageIncrease')).toBe('Base Weapon Damage Increase');
  });

  it('splits on underscores', () => {
    expect(prettyLabel('max_health_regen')).toBe('Max Health Regen');
  });

  it('breaks a letter–digit boundary', () => {
    expect(prettyLabel('tier2Cost')).toBe('Tier 2 Cost');
  });

  it('keeps unknown lowercase runs as one word rather than dropping data', () => {
    expect(prettyLabel('zephyr')).toBe('Zephyr');
  });

  it('is empty-safe', () => {
    expect(prettyLabel('')).toBe('');
  });
});

describe('statLabel', () => {
  it('prefers the display name and strips the single leading "E" enum tag', () => {
    expect(statLabel('max_health', 'EMaxHealth')).toBe('Max Health');
    expect(statLabel('ability_resource_regen', 'EAbilityResourceRegenPerSecond')).toBe(
      'Ability Resource Regen Per Second',
    );
  });

  it('falls back to segmenting the key when no display name is served', () => {
    expect(statLabel('abilityresourceregenpersecond')).toBe('Ability Resource Regen Per Second');
  });
});
