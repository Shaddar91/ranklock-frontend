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
  /\bnot just [^,.]{1,40}\bbut\b/i,
  /\bisn't just\b/i,
  /\bit's not about .{1,40}, it's about\b/i,
  /\bat the end of the day\b/i,
];

//Em/en dashes read as AI filler in copy. Enforced on prose only: content markdown in
//full, and elsewhere only after comments and the standalone empty-value dash are stripped.
const DASH = /[\u2014\u2013]/;
//The bare dash is the empty-value cell and the sentinel-label marker, not prose.
const LONE_DASH = /(['"`])\u2014\1|>\s*\u2014\s*<|(['"`])\u2014\s|^\s*\u2014\s*$/g;

//Strip //, /* */, {/* */} and <!-- --> so a dash in a code comment never fails the gate.
const stripComments = (src) => {
  const out = src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
  return out
    .split('\n')
    .map((l) => l.replace(/(^|\s)\/\/.*$/, '$1'))
    .join('\n');
};

//Content-only rules, run on src/content markdown where the copy is ours end to end.
//A build author is cited by standing and favourites, never by a Steam account id, and a
//paired-contrast punchline ("Farm the flank, not the lane.") is the bot rhythm to avoid.
const CONTENT_ONLY = [
  { re: /[^.\n]{8,90}, not (?!every|all|any|much|enough|once)[^.,\n]{2,45}\./, label: 'aphorism ", not X."' },
  { re: /[^.\n]{8,90} rather than [^.,\n]{2,45}\./, label: 'aphorism "rather than X."' },
  { re: /\bAccounts? \d{3,}/, label: 'names a player by account id' },
  { re: /[\u0400-\u04FF\u0370-\u03FF\u0590-\u05FF\u0600-\u06FF\u3040-\u30FF\u3400-\u9FFF]/, label: 'non-Latin author text' },
];
const isContent = (f) => f.replace(/\\/g, '/').startsWith('src/content/');

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
  const raw = readFileSync(file, 'utf8');
  const md = extname(file) === '.md' || extname(file) === '.mdx';
  const prose = (md ? raw : stripComments(raw)).split('\n');
  const lines = raw.split('\n');
  lines.forEach((text, i) => {
    for (const re of BANNED) {
      const m = text.match(re);
      if (m) hits.push({ file, line: i + 1, word: m[0], text: text.trim().slice(0, 120) });
    }
    if (/\.test\./.test(file)) return;
    if (DASH.test(prose[i].replace(LONE_DASH, ''))) {
      hits.push({ file, line: i + 1, word: 'em/en dash', text: text.trim().slice(0, 120) });
    }
    if (!isContent(file)) return;
    for (const { re, label } of CONTENT_ONLY) {
      if (re.test(text)) hits.push({ file, line: i + 1, word: label, text: text.trim().slice(0, 120) });
    }
  });
}

if (hits.length > 0) {
  console.error(`no-slop-check: ${hits.length} banned word(s) found:\n`);
  for (const h of hits) console.error(`  ${h.file}:${h.line}  [${h.word}]  ${h.text}`);
  console.error('\nRewrite these in plain, concrete language. A dash becomes a period, a colon or a comma pair.');
  process.exit(1);
}
console.log(`no-slop-check: clean (${files.length} files scanned).`);
