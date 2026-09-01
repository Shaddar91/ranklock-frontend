//No-slop gate: greps src/ for banned marketing/AI-filler words so they cannot
//return to user-facing copy. Fails the lint run on any hit.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = 'src';
const EXTS = new Set(['.astro', '.ts', '.tsx', '.md', '.mdx']);

const BANNED = [
  /\bsubstrate\b/i,
  /\bleverag(e|es|ed|ing)\b/i,
  /\bcomprehensive(ly)?\b/i,
  /\bseamless(ly)?\b/i,
  /\brobust(ly|ness)?\b/i,
  /\bdelv(e|es|ed|ing)\b/i,
  /\blandscape\b/i,
  /\btheorycrafting layer\b/i,
  /\bcoaching layer\b/i,
  /\butiliz(e|es|ed|ing)\b/i,
  /\bfacilitat(e|es|ed|ing)\b/i,
  /\bempower(s|ed|ing|ment)?\b/i,
  /\bstreamlin(e|es|ed|ing)\b/i,
  /\bcutting-edge\b/i,
  /\bparadigm\b/i,
  /\bgame.chang(er|ing)\b/i,
  /\btapestry\b/i,
  /\bmultifaceted\b/i,
  /\bmeticulous(ly)?\b/i,
  /\bparamount\b/i,
  /\btransformative\b/i,
  /\bsupercharg(e|es|ed|ing)\b/i,
  /\bever-evolving\b/i,
  /\bfoster(s|ed|ing)?\b/i,
  /\bembark(s|ed|ing)?\b/i,
  /\bstate-of-the-art\b/i,
  /\bworld-class\b/i,
  /\bbest-in-class\b/i,
  /\belevate your\b/i,
  /\bunlock the (power|potential|full)\b/i,
];

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (EXTS.has(extname(p))) files.push(p);
  }
};
walk(ROOT);

const hits = [];
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((text, i) => {
    for (const re of BANNED) {
      const m = text.match(re);
      if (m) hits.push({ file, line: i + 1, word: m[0], text: text.trim().slice(0, 120) });
    }
  });
}

if (hits.length > 0) {
  console.error(`no-slop-check: ${hits.length} banned word(s) found:\n`);
  for (const h of hits) console.error(`  ${h.file}:${h.line}  [${h.word}]  ${h.text}`);
  console.error('\nRewrite these in plain, concrete language (see the site copy rules).');
  process.exit(1);
}
console.log(`no-slop-check: clean (${files.length} files scanned).`);
