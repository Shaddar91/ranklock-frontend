import { describe, expect, it } from 'vitest';
import { hreflangAlternates, localePath, pagePath, stripLocalePrefix } from './i18n';

describe('pagePath', () => {
  it('adds the trailing slash the static host serves without a redirect', () => {
    expect(pagePath('/heroes')).toBe('/heroes/');
    expect(pagePath('/heroes/13')).toBe('/heroes/13/');
    expect(pagePath('heroes')).toBe('/heroes/');
  });
  it('leaves root, already-canonical and file routes alone', () => {
    expect(pagePath('/')).toBe('/');
    expect(pagePath('/heroes/')).toBe('/heroes/');
    expect(pagePath('/rss.xml')).toBe('/rss.xml');
    expect(pagePath('/sitemap.xml')).toBe('/sitemap.xml');
  });
  it('keeps query and hash after the slash', () => {
    expect(pagePath('/privacy#consent')).toBe('/privacy/#consent');
    expect(pagePath('/heroes?bracket=high')).toBe('/heroes/?bracket=high');
  });
});

describe('localePath / hreflangAlternates', () => {
  it('prefixes non-default locales and keeps the slash form', () => {
    expect(localePath('en', '/heroes')).toBe('/heroes/');
    expect(localePath('ru', '/heroes')).toBe('/ru/heroes/');
    expect(localePath('ru', '/')).toBe('/ru/');
    expect(localePath('en', '/')).toBe('/');
  });
  it('round-trips through stripLocalePrefix', () => {
    expect(stripLocalePrefix(localePath('ru', '/heroes/13'))).toBe('/heroes/13');
    expect(stripLocalePrefix('/ru/')).toBe('/');
  });
  it('emits x-default + translated locales only, all slash-form', () => {
    const alts = hreflangAlternates('/ru/heroes/13');
    expect(alts[0]).toEqual({ hreflang: 'x-default', path: '/heroes/13/' });
    expect(alts.every((a) => a.path.endsWith('/'))).toBe(true);
    expect(alts.some((a) => a.hreflang === 'ru')).toBe(false);
  });
});
