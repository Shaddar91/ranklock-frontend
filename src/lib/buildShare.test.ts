import { describe, it, expect, beforeEach, vi } from 'vitest';
import { encodeBuild, decodeBuild, buildShareHash, readBuildFromHash, saveDraft, loadDrafts, deleteDraft } from './buildShare';
import type { BuildInput } from './computeStats';

//node test env has no localStorage — back it with an in-memory Map so the persistence path runs.
const mem = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
});

const build: BuildInput = {
  heroId: 1,
  patch: '2026-08-22',
  items: [915014646, 3294954488, 2678489038],
  imbueTargets: { 915014646: 491391007 },
  conditionalItems: [3294954488],
  conditionalsOn: [3294954488],
  upgradesFrom: { 2678489038: 3294954488 },
  abilityOrder: [491391007, 3516947824],
};

describe('buildShare — versioned fragment round-trip', () => {
  it('encodes to a b1: payload and decodes back byte-identical', () => {
    const payload = encodeBuild(build);
    expect(payload.startsWith('b1:')).toBe(true);
    expect(decodeBuild(payload)).toEqual(build);
  });

  it('round-trips through the URL fragment', () => {
    const hash = buildShareHash(build);
    expect(hash.startsWith('#b1:')).toBe(true);
    expect(readBuildFromHash(hash)).toEqual(build);
  });

  it('empty build yields an empty fragment', () => {
    expect(buildShareHash({ heroId: 1, items: [] })).toBe('');
  });

  it('drops absent optional fields (compact payload)', () => {
    const minimal: BuildInput = { heroId: 6, items: [1, 2] };
    const back = decodeBuild(encodeBuild(minimal))!;
    expect(back.heroId).toBe(6);
    expect(back.items).toEqual([1, 2]);
    expect(back.imbueTargets).toBeUndefined();
    expect(back.conditionalItems).toBeUndefined();
  });

  it('rejects malformed / wrong-version payloads', () => {
    expect(decodeBuild(null)).toBeNull();
    expect(decodeBuild('')).toBeNull();
    expect(decodeBuild('b2:abc')).toBeNull();
    expect(decodeBuild('b1:not-base64!!')).toBeNull();
    expect(decodeBuild('garbage')).toBeNull();
  });
});

describe('buildShare — localStorage drafts', () => {
  beforeEach(() => localStorage.clear());

  it('saves, lists newest-first, and deletes', () => {
    saveDraft({ id: 'a', name: 'Aggro', build }, 1000);
    const after = saveDraft({ id: 'b', name: 'Tank', build }, 2000);
    expect(after.map((d) => d.id)).toEqual(['b', 'a']);
    expect(loadDrafts()).toHaveLength(2);
    const left = deleteDraft('a');
    expect(left.map((d) => d.id)).toEqual(['b']);
  });

  it('upserts by id (no duplicates) and stamps updatedAt', () => {
    saveDraft({ id: 'a', name: 'v1', build }, 1000);
    const after = saveDraft({ id: 'a', name: 'v2', build }, 5000);
    expect(after).toHaveLength(1);
    expect(after[0]?.name).toBe('v2');
    expect(after[0]?.updatedAt).toBe(5000);
  });
});
