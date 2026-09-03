//Staged blog-post publication gate.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BLOG_DIR = join(REPO_ROOT, 'src/content/blog');
const SENTINEL = /{{[A-Z_]{3,}}}/;
const PATCH_PHRASE = /since the patch|after the update|after the patch|this patch/i;
const ALLOWLIST = new Set([
  'patch-tracker-meta-shifts.md:18',
  'patch-tracker-meta-shifts.md:22',
  'welcome-to-the-ranklock-blog.md:22',
]);
const OVERLAP_LIMIT = 0.45;

function fail(check, details) {
  console.error(`check ${check}: FAIL`);
  for (const detail of details) console.error(`  ${detail}`);
  process.exit(1);
}

function markdownFiles() {
  return readdirSync(BLOG_DIR)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => ({ name, path: join(BLOG_DIR, name) }));
}

function frontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  return match?.[1] ?? '';
}

function checkSentinels(files) {
  const hits = [];
  for (const file of files) {
    const text = readFileSync(file.path, 'utf8');
    const tokens = [...new Set(text.match(/{{[A-Z_]{3,}}}/g) ?? [])];
    const held = /^draft:\s*true\s*$/m.test(frontmatter(text));
    if (!held) for (const token of tokens) hits.push(`${file.name}: ${token}`);
  }
  if (hits.length > 0) fail(1, hits);
  console.log(`check 1: clean (${files.length} posts; published posts contain no sentinels).`);
}

function checkPatchPhrases(files) {
  const hits = [];
  for (const file of files) {
    const lines = readFileSync(file.path, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      if (!SENTINEL.test(line) && PATCH_PHRASE.test(line)) {
        const location = `${file.name}:${index + 1}`;
        if (!ALLOWLIST.has(location)) hits.push(`${location}: ${line.trim()}`);
      }
    });
  }
  if (hits.length > 0) fail(2, hits);
  console.log(`check 2: clean (patch-scoped phrasing enforced; ${ALLOWLIST.size} legacy lines allowlisted).`);
}

function checkSchema() {
  const result = spawnSync('npm', ['run', 'type-check'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });
  if (result.error) fail(3, [result.error.message]);
  if (result.status !== 0) fail(3, [`npm run type-check exited ${result.status}`]);
  console.log('check 3: clean (Astro content schema passed).');
}

function htmlFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files.push(...htmlFiles(path));
    else if (entry.endsWith('.html')) files.push(path);
  }
  return files;
}

function internalTargetExists(root, href) {
  const target = href.replace(/^\//, '').replace(/\/$/, '');
  const candidates = target === ''
    ? [join(root, 'index.html')]
    : [join(root, target, 'index.html'), join(root, target), join(root, `${target}.html`)];
  return candidates.some((candidate) => existsSync(candidate) && !statSync(candidate).isDirectory());
}

function checkLinks(builtRoot) {
  const blogRoot = join(builtRoot, 'blog');
  if (!existsSync(builtRoot)) {
    console.log(`check 4: skipped (${relative(REPO_ROOT, builtRoot)} does not exist).`);
    return false;
  }
  if (!existsSync(blogRoot)) fail(4, [`${relative(REPO_ROOT, blogRoot)} does not exist`]);
  const links = new Set();
  for (const file of htmlFiles(blogRoot)) {
    const html = readFileSync(file, 'utf8');
    for (const match of html.matchAll(/href="(\/[^"#?]*)"/g)) links.add(match[1]);
  }
  const dead = [...links].filter((href) => !internalTargetExists(builtRoot, href));
  if (dead.length > 0) fail(4, dead.map((href) => `DEAD: ${href}`));
  console.log(`check 4: clean (${links.size} internal blog links resolve in built output).`);
  return true;
}

function checkDistinctness(builtRoot) {
  const result = spawnSync(
    process.execPath,
    [join(REPO_ROOT, 'scripts/overlap.mjs'), '--root', builtRoot, '--pages', 'blog/*/index.html', '--json'],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  );
  if (result.error) fail(5, [result.error.message]);
  if (result.status !== 0) fail(5, [(result.stderr || result.stdout).trim()]);

  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch (error) {
    fail(5, [`overlap.mjs returned invalid JSON: ${error.message}`]);
  }
  const raw = report.pages.raw.max?.j ?? 0;
  const masked = report.pages.masked.max?.j ?? 0;
  const maximum = Math.max(raw, masked);
  if (maximum > OVERLAP_LIMIT) {
    fail(5, [`maximum overlap ${maximum.toFixed(4)} exceeds ${OVERLAP_LIMIT.toFixed(2)}`]);
  }
  console.log(`check 5: clean (maximum blog overlap ${maximum.toFixed(4)} <= ${OVERLAP_LIMIT.toFixed(2)}).`);
}

function builtRoot() {
  const index = process.argv.indexOf('--built');
  if (index === -1) return join(REPO_ROOT, 'dist/client');
  const value = process.argv[index + 1];
  if (!value) fail(4, ['--built needs a directory']);
  return resolve(REPO_ROOT, value);
}

const files = markdownFiles();
const built = builtRoot();
checkSentinels(files);
checkPatchPhrases(files);
checkSchema();
if (checkLinks(built)) checkDistinctness(built);
else console.log(`check 5: skipped (${relative(REPO_ROOT, built)} does not exist).`);
