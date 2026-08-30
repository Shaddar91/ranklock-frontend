import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

//Every internal page link must use the trailing-slash form the static host serves
//directly; the no-slash form costs a 307 and splits canonicals (GSC 2026-08).
const ROOT = join(__dirname, '..');
const EXT = new Set(['.astro', '.tsx', '.ts', '.md', '.mdx']);
const NO_SLASH = [
  /href="(\/[a-z][a-z0-9/-]*[a-z0-9])"/g,
  /href: '(\/[a-z][a-z0-9/-]*[a-z0-9])'/g,
  /href=\{`(\/[a-z]+\/)\$\{[^}]+\}`\}/g,
  /\]\((\/[a-z][a-z0-9/-]*[a-z0-9])\)/g,
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (EXT.has(p.slice(p.lastIndexOf('.'))) && !p.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

describe('internal links', () => {
  it('all use the trailing-slash form', () => {
    const offenders: string[] = [];
    for (const file of walk(ROOT)) {
      const src = readFileSync(file, 'utf8');
      for (const re of NO_SLASH) {
        for (const m of src.matchAll(re)) offenders.push(`${file.slice(ROOT.length)}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
