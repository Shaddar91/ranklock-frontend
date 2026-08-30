import { describe, expect, it } from 'vitest';
import { compareSharePath, compareShareUrl, readComparePair } from './compareShare';

describe('compareShareUrl', () => {
  it('builds the canonical share URL for a pair', () => {
    expect(compareShareUrl(76561198, 123456)).toBe('https://ranklock.app/compare/76561198/123456');
  });

  it('builds the site-relative path', () => {
    expect(compareSharePath(1, 2)).toBe('/compare/1/2');
  });
});

describe('readComparePair', () => {
  it('reads both ids from a compare pathname', () => {
    expect(readComparePair('/compare/123/456')).toEqual({ a: 123, b: 456 });
  });

  it('tolerates a locale prefix and a trailing slash', () => {
    expect(readComparePair('/fr/compare/123/456/')).toEqual({ a: 123, b: 456 });
  });

  it('rejects a missing second id', () => {
    expect(readComparePair('/compare/123')).toBeNull();
  });

  it('rejects non-numeric, non-integer, and non-positive segments', () => {
    expect(readComparePair('/compare/abc/456')).toBeNull();
    expect(readComparePair('/compare/1.5/456')).toBeNull();
    expect(readComparePair('/compare/0/456')).toBeNull();
    expect(readComparePair('/compare/123/-4')).toBeNull();
  });
});
