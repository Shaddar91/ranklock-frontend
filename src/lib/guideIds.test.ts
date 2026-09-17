//Rules of the guide id scheme: the parent slug splits on the first `--`, the canonical guide is
//token-less, and a hero's siblings order canonical-first then by the build-token enum order.
import { expect, it } from 'vitest';
import {
  BUILD_TOKENS,
  compareGuideIds,
  guidePath,
  parseGuideId,
  type PublishedGuide,
} from './guideIds';

it('splits a canonical id into the hero slug with no token', () => {
  expect(parseGuideId('ivy')).toEqual({ slug: 'ivy', token: null });
});

it('splits an archetype id into the parent slug and its build token', () => {
  expect(parseGuideId('ivy--weapon')).toEqual({ slug: 'ivy', token: 'weapon' });
  expect(parseGuideId('grey-talon--tank')).toEqual({ slug: 'grey-talon', token: 'tank' });
});

it('mints the canonical path for a token-less id and the sibling path for an archetype id', () => {
  expect(guidePath('ivy')).toBe('/heroes/ivy/guide/');
  expect(guidePath('grey-talon--tank')).toBe('/heroes/grey-talon/guide/tank/');
});

it('orders a hero\'s guides canonical-first, then by the build-token enum order, never alphabetically', () => {
  const ids = ['mcginnis--tank', 'mcginnis--support', 'mcginnis', 'mcginnis--weapon', 'mcginnis--spirit'];
  expect([...ids].sort(compareGuideIds)).toEqual([
    'mcginnis',
    'mcginnis--weapon',
    'mcginnis--spirit',
    'mcginnis--support',
    'mcginnis--tank',
  ]);
  expect(BUILD_TOKENS).toEqual(['weapon', 'spirit', 'support', 'tank', 'hybrid']);
});

//The grouping guideRoutes.publishedGuides builds over the collection, replayed on stub entries.
const publishedGuidesFrom = (entries: { id: string; title: string }[]): Map<string, PublishedGuide[]> => {
  const byHero = new Map<string, PublishedGuide[]>();
  for (const entry of entries.slice().sort((a, b) => compareGuideIds(a.id, b.id))) {
    const { slug, token } = parseGuideId(entry.id);
    const list = byHero.get(slug) ?? [];
    list.push({ id: entry.id, token, path: guidePath(entry.id), title: entry.title });
    byHero.set(slug, list);
  }
  return byHero;
};

it('groups stub entries into the publishedGuides map, one ordered list per hero', () => {
  const map = publishedGuidesFrom([
    { id: 'mcginnis--support', title: 'McGinnis Support build guide' },
    { id: 'ivy', title: 'Ivy guide' },
    { id: 'mcginnis', title: 'McGinnis guide' },
    { id: 'mcginnis--weapon', title: 'McGinnis Weapon build guide' },
  ]);
  expect(map.get('mcginnis')).toEqual([
    { id: 'mcginnis', token: null, path: '/heroes/mcginnis/guide/', title: 'McGinnis guide' },
    { id: 'mcginnis--weapon', token: 'weapon', path: '/heroes/mcginnis/guide/weapon/', title: 'McGinnis Weapon build guide' },
    { id: 'mcginnis--support', token: 'support', path: '/heroes/mcginnis/guide/support/', title: 'McGinnis Support build guide' },
  ]);
  expect(map.get('ivy')).toEqual([
    { id: 'ivy', token: null, path: '/heroes/ivy/guide/', title: 'Ivy guide' },
  ]);
});
