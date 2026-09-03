//Prerendered page prose-overlap metric.
import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const HEROES = ['haze', 'billy', 'silver', 'pocket', 'sinclair'];
const ITEMS = ['1009965641', '7409189', '2163598980', '800008313', '951866250'];
const SHINGLE = 5;

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

function mainText(html) {
  const m = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  const body = m ? m[1] : html;
  return body
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<template[\s\S]*?<\/template>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const maskNumbers = (text) => text.replace(/\d[\d,.]*%?/g, '#');

function shingles(text, n) {
  const words = text.toLowerCase().match(/[a-z0-9'’.%#-]+/g) ?? [];
  const set = new Set();
  for (let i = 0; i + n <= words.length; i++) set.add(words.slice(i, i + n).join(' '));
  return { set, words: words.length };
}

function jaccard(a, b) {
  let inter = 0;
  for (const s of a) if (b.has(s)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function load(root, family, keys) {
  return keys.map((k) => loadPath(root, join(family, k, 'index.html'), k));
}

function loadPath(root, page, key = page.replace(/\/index\.html$/, '')) {
  const path = join(root, page);
  const text = mainText(readFileSync(path, 'utf8'));
  const { set, words } = shingles(text, SHINGLE);
  const masked = shingles(maskNumbers(text), SHINGLE);
  return { key, path, text, words, shingles: set.size, set, maskedSet: masked.set, maskedShingles: masked.set.size };
}

function selectedPages(root, spec) {
  const pages = [...new Set(spec.split(',').flatMap((pattern) => globSync(pattern.trim(), { cwd: root })))].sort();
  if (pages.length < 2) {
    console.error(`overlap.mjs: --pages matched ${pages.length} page(s); at least 2 are required`);
    process.exit(2);
  }
  return pages.map((page) => loadPath(root, page));
}

function matrix(rows, field = 'set') {
  const pairs = [];
  const grid = rows.map((a) =>
    rows.map((b) => {
      if (a === b) return 1;
      const j = jaccard(a[field], b[field]);
      if (rows.indexOf(a) < rows.indexOf(b)) pairs.push({ a: a.key, b: b.key, j });
      return j;
    }),
  );
  pairs.sort((x, y) => y.j - x.j);
  return { grid, pairs, max: pairs[0] ?? null, mean: pairs.reduce((s, p) => s + p.j, 0) / (pairs.length || 1) };
}

function render(name, rows, res, masked) {
  const w = 14;
  const head = ['', ...rows.map((r) => r.key)].map((s) => String(s).padEnd(w)).join('');
  const lines = [`## ${name}`, '', head];
  res.grid.forEach((row, i) => {
    lines.push([rows[i].key, ...row.map((v) => v.toFixed(4))].map((s) => String(s).padEnd(w)).join(''));
  });
  lines.push('');
  lines.push(`### ${name} — numbers masked`);
  lines.push('');
  lines.push(head);
  masked.grid.forEach((row, i) => {
    lines.push([rows[i].key, ...row.map((v) => v.toFixed(4))].map((s) => String(s).padEnd(w)).join(''));
  });
  lines.push('');
  lines.push('page          words  5-grams  masked');
  rows.forEach((r) => lines.push(`${r.key.padEnd(14)}${String(r.words).padEnd(7)}${String(r.shingles).padEnd(9)}${r.maskedShingles}`));
  lines.push('');
  lines.push(`raw    max pair: ${res.max.a} / ${res.max.b} = ${res.max.j.toFixed(4)}   mean of ${res.pairs.length} pairs: ${res.mean.toFixed(4)}`);
  lines.push(`masked max pair: ${masked.max.a} / ${masked.max.b} = ${masked.max.j.toFixed(4)}   mean of ${masked.pairs.length} pairs: ${masked.mean.toFixed(4)}`);
  lines.push('');
  return lines.join('\n');
}

function sweep(rows) {
  const out = [];
  for (const mask of [false, true]) {
    for (const n of [1, 3, 5, 8]) {
      const sets = rows.map((r) => shingles(mask ? maskNumbers(r.text) : r.text, n).set);
      const vals = [];
      for (let i = 0; i < sets.length; i++) for (let k = i + 1; k < sets.length; k++) vals.push(jaccard(sets[i], sets[k]));
      out.push({ mask, n, max: Math.max(...vals), mean: vals.reduce((a, b) => a + b, 0) / vals.length });
    }
  }
  return out;
}

function renderSweep(name, rows) {
  const lines = [`### ${name} — shingle-size sweep`, '', 'variant   n   max      mean'];
  for (const r of sweep(rows)) {
    lines.push(`${(r.mask ? 'masked' : 'raw').padEnd(10)}${String(r.n).padEnd(4)}${r.max.toFixed(4).padEnd(9)}${r.mean.toFixed(4)}`);
  }
  lines.push('');
  return lines.join('\n');
}

function result(rows) {
  const raw = matrix(rows);
  const masked = matrix(rows, 'maskedSet');
  return { rows, raw, masked };
}

function serializable({ rows, raw, masked }) {
  const strip = (row) => ({
    key: row.key,
    path: row.path,
    words: row.words,
    shingles: row.shingles,
    maskedShingles: row.maskedShingles,
  });
  return {
    pages: rows.map(strip),
    raw: { grid: raw.grid, pairs: raw.pairs, max: raw.max, mean: raw.mean },
    masked: { grid: masked.grid, pairs: masked.pairs, max: masked.max, mean: masked.mean },
    sweep: sweep(rows),
  };
}

const root = arg('root');
if (!root) {
  console.error('overlap.mjs: --root <path-to-dist/client> is required');
  process.exit(2);
}

const pageSpec = arg('pages');
const groups = pageSpec
  ? [{ key: 'pages', name: 'Selected pages', ...result(selectedPages(root, pageSpec)) }]
  : [
      { key: 'heroes', name: 'Hero pages', ...result(load(root, 'heroes', HEROES)) },
      { key: 'items', name: 'Item pages', ...result(load(root, 'items', ITEMS)) },
    ];

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ shingle: SHINGLE, ...Object.fromEntries(groups.map((group) => [group.key, serializable(group)])) }, null, 2));
} else {
  console.log(`# word ${SHINGLE}-gram Jaccard overlap, main-content text\n`);
  for (const group of groups) {
    console.log(render(group.name, group.rows, group.raw, group.masked));
    console.log(renderSweep(group.name, group.rows));
  }
}
