import { describe, it, expect } from 'vitest';
import { parsePatchNotes, type EntitySource } from './patchNotes';

//Changelog parsing + entity linking. The rule under test is "never guess a link":
//an unrecognised leading word must leave the line as plain text.

const SOURCE: EntitySource = {
  heroes: [
    { hero_name: 'Celeste', slug: 'celeste' },
    { hero_name: 'The Doorman', slug: 'the-doorman' },
    { hero_name: 'Mo & Krill', slug: 'mo-krill' },
    { hero_name: 'Shiv', slug: 'shiv' },
  ],
  items: [
    { item_id: 2947183272, name: 'Radiant Regeneration' },
    { item_id: 2059712766, name: 'Restorative Locket' },
    { item_id: 3133167885, name: 'Silencer' },
    { item_id: 1113837674, name: 'Silencer' },
    { item_id: 800008313, name: 'Decay' },
  ],
};

describe('parsePatchNotes', () => {
  it('returns an empty result for a missing changelog', () => {
    expect(parsePatchNotes(null, SOURCE)).toEqual({ lines: [], heroes: [], items: [], bullets: 0 });
  });

  it('links a hero named before the colon', () => {
    const notes = parsePatchNotes('- Celeste: Dazzling Trick cooldown increased from 32s to 34s', SOURCE);
    expect(notes.lines[0]?.entity).toEqual({ kind: 'hero', name: 'Celeste', href: '/heroes/celeste/' });
    expect(notes.lines[0]?.label).toBe('Celeste');
    expect(notes.lines[0]?.text).toBe(': Dazzling Trick cooldown increased from 32s to 34s');
    expect(notes.heroes).toEqual([{ kind: 'hero', name: 'Celeste', href: '/heroes/celeste/', lines: 1 }]);
  });

  it('links an item named before the colon', () => {
    const notes = parsePatchNotes('- Radiant Regeneration: Heal on cast reduced from 70 to 65', SOURCE);
    expect(notes.items).toEqual([
      { kind: 'item', name: 'Radiant Regeneration', href: '/items/2947183272/', lines: 1 },
    ]);
  });

  it('links an entity with no colon after it', () => {
    const notes = parsePatchNotes('- Decay now applies on the first hit', SOURCE);
    expect(notes.lines[0]?.label).toBe('Decay');
    expect(notes.lines[0]?.text).toBe(' now applies on the first hit');
  });

  it('resolves the article-less spelling of a hero name', () => {
    const notes = parsePatchNotes('- Doorman: Doorway range reduced from 70m to 65m', SOURCE);
    expect(notes.heroes[0]?.href).toBe('/heroes/the-doorman/');
    expect(notes.lines[0]?.label).toBe('Doorman');
  });

  it('matches a name whose punctuation differs from its slug', () => {
    const notes = parsePatchNotes("- Mo & Krill: Burrow cast time reduced", SOURCE);
    expect(notes.heroes[0]?.href).toBe('/heroes/mo-krill/');
  });

  it('picks the lowest catalog id when two items share a name', () => {
    const notes = parsePatchNotes('- Silencer: Spirit Resistance reduced', SOURCE);
    expect(notes.items[0]?.href).toBe('/items/1113837674/');
  });

  it('leaves an unrecognised line unlinked', () => {
    const notes = parsePatchNotes('- Urn Runner sprint bonus reduced from +2m to 0', SOURCE);
    expect(notes.lines[0]).toEqual({
      kind: 'bullet',
      entity: null,
      label: '',
      text: 'Urn Runner sprint bonus reduced from +2m to 0',
    });
    expect(notes.heroes).toEqual([]);
    expect(notes.items).toEqual([]);
  });

  it('does not treat prose punctuation deep in a line as an entity label', () => {
    const notes = parsePatchNotes(
      '- Fixed a bug where the wrong announcement played on the following objectives: rift, urn',
      SOURCE,
    );
    expect(notes.lines[0]?.entity).toBeNull();
  });

  it('reads bracketed section titles as headings and keeps loose prose as text', () => {
    const notes = parsePatchNotes('[ Items ]\n\nPrimary details:\n- Decay reworked', SOURCE);
    expect(notes.lines.map((l) => l.kind)).toEqual(['heading', 'text', 'bullet']);
    expect(notes.lines[0]?.text).toBe('Items');
    expect(notes.bullets).toBe(1);
  });

  it('counts every line that names the same entity and sorts the index by name', () => {
    const notes = parsePatchNotes(
      ['- Shiv: Alt Fire ammo cost reduced from 5 to 4', '- Shiv: Weapon now has fixed pellet spread', '- Celeste: Shining Wonder damage reduced from 165 to 140'].join('\n'),
      SOURCE,
    );
    expect(notes.heroes.map((h) => [h.name, h.lines])).toEqual([
      ['Celeste', 1],
      ['Shiv', 2],
    ]);
    expect(notes.bullets).toBe(3);
  });
});
