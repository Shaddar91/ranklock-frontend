#!/usr/bin/env node
//Snapshot the community build list from the deadlock-api as DATA ONLY (ids, version, timestamps,
//favourite counts, ordered item ids) so a pre-patch and a post-patch run can be diffed. Upstream
//prose is dropped at parse; snapshots are written outside every repo as gzip-9 JSONL.
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';

const ENDPOINT = 'https://api.deadlock-api.com/v1/builds';
const USER_AGENT = 'ranklock-build-snapshot/1 (+https://ranklock.app)';
const PAGE_LIMIT = 1000;
//Documented ceiling is 100 req/s per IP; one page at a time, never concurrent.
const PAGE_DELAY_MS = 250;
const MAX_PAGES = 60;
const DEFAULT_WINDOW_DAYS = 8;

function fail(message, code = 1) {
  console.error(`build-snapshot: ${message}`);
  process.exit(code);
}

function log(event) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...event }));
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function parseArgs(argv) {
  const args = { since: null, label: 'pre', outDir: null, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--dry-run') args.dryRun = true;
    else if (flag === '--since') { args.since = value; i += 1; }
    else if (flag === '--label') { args.label = value; i += 1; }
    else if (flag === '--out-dir') { args.outDir = value; i += 1; }
    else fail(`unknown argument: ${flag}`, 2);
    if (flag !== '--dry-run' && value === undefined) fail(`${flag} needs a value`, 2);
  }
  return args;
}

function windowStart(since) {
  if (since === null) {
    return Math.floor(Date.now() / 1000) - DEFAULT_WINDOW_DAYS * 86400;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) fail(`--since must be YYYY-MM-DD, got "${since}"`, 2);
  const ms = Date.parse(`${since}T00:00:00Z`);
  if (Number.isNaN(ms)) fail(`--since is not a real date: "${since}"`, 2);
  return Math.floor(ms / 1000);
}

//R1: probe the nearest EXISTING ancestor, so a path not yet created is still refused.
function assertOutsideGitWorkTree(dir) {
  let probe = dir;
  while (!existsSync(probe)) {
    const up = dirname(probe);
    if (up === probe) break;
    probe = up;
  }
  const git = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: probe, encoding: 'utf8' });
  if (git.status === 0) {
    fail(`snapshot path is inside a git work tree (R1): ${dir} is under ${git.stdout.trim()}`, 3);
  }
}

//Whitelist only, so a new upstream prose field can never reach the store.
function slim(record) {
  const build = record?.hero_build ?? {};
  const items = [];
  for (const category of build.details?.mod_categories ?? []) {
    for (const mod of category?.mods ?? []) {
      if (Number.isInteger(mod?.ability_id)) items.push(mod.ability_id);
    }
  }
  return {
    h: build.hero_id ?? null,
    b: build.hero_build_id ?? null,
    a: build.author_account_id ?? null,
    v: build.version ?? null,
    p: build.publish_timestamp ?? null,
    u: build.last_updated_timestamp ?? null,
    f: record?.num_favorites ?? null,
    w: record?.num_weekly_favorites ?? null,
    i: items,
  };
}

//publish_timestamp is null on live rows; a null must never read as "older" and end paging early.
const edgeTs = (row) => row.p ?? row.u ?? null;

async function fetchPage(sinceTs, start) {
  const url = new URL(ENDPOINT);
  url.searchParams.set('only_latest', 'true');
  url.searchParams.set('sort_by', 'published_at');
  url.searchParams.set('sort_direction', 'desc');
  url.searchParams.set('min_published_unix_timestamp', String(sinceTs));
  url.searchParams.set('limit', String(PAGE_LIMIT));
  url.searchParams.set('start', String(start));
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } }).catch((err) =>
    fail(`fetch failed — ${err?.cause?.code ?? err?.message ?? err}`, 4),
  );
  if (!res.ok) fail(`upstream HTTP ${res.status} ${res.statusText}`, 4);
  const body = await res.text();
  let rows;
  try {
    rows = JSON.parse(body);
  } catch {
    fail('unexpected response (not JSON)', 4);
  }
  if (!Array.isArray(rows)) fail('unexpected response (not an array)', 4);
  return { rows, bytes: Buffer.byteLength(body) };
}

const args = parseArgs(process.argv.slice(2));
if (!/^[a-z0-9][a-z0-9-]*$/.test(args.label ?? '')) {
  fail(`--label must match [a-z0-9-], got "${args.label}"`, 2);
}
const sinceTs = windowStart(args.since);
const stateHome = process.env.XDG_STATE_HOME || join(homedir(), '.local', 'state');
const outDir = args.outDir
  ? resolve(args.outDir)
  : join(stateHome, 'ranklock-patch-content', 'snapshots');
assertOutsideGitWorkTree(outDir);

log({ event: 'start', since: sinceTs, sinceIso: new Date(sinceTs * 1000).toISOString(), label: args.label, dryRun: args.dryRun });

const records = [];
const seen = new Set();
let upstreamBytes = 0;
let pages = 0;
let start = 0;
let oldestSeen = null;
let covered = false;
while (pages < MAX_PAGES) {
  if (pages > 0) await sleep(PAGE_DELAY_MS);
  const { rows, bytes } = await fetchPage(sinceTs, start);
  pages += 1;
  upstreamBytes += bytes;
  let pageOldest = null;
  for (const raw of rows) {
    const row = slim(raw);
    if (row.b !== null && seen.has(row.b)) continue;
    if (row.b !== null) seen.add(row.b);
    records.push(row);
    const ts = edgeTs(row);
    if (ts !== null && (pageOldest === null || ts < pageOldest)) pageOldest = ts;
  }
  if (pageOldest !== null && (oldestSeen === null || pageOldest < oldestSeen)) oldestSeen = pageOldest;
  log({ event: 'page', page: pages, start, rows: rows.length, kept: records.length, oldest: pageOldest, bytes });
  if (args.dryRun) { covered = true; break; }
  //The server filters by min_published_unix_timestamp, so a short page means the window is served;
  //stopping while pages are still full means MAX_PAGES truncated it.
  if (rows.length < PAGE_LIMIT) { covered = true; break; }
  if (pageOldest !== null && pageOldest <= sinceTs) { covered = true; break; }
  start += PAGE_LIMIT;
}
if (!covered) {
  fail(`window not covered: oldest=${oldestSeen} target=${sinceTs}`, 5);
}
if (records.length === 0) fail('no builds returned for the window — refusing an empty snapshot', 6);

const jsonl = records.map((row) => JSON.stringify(row)).join('\n') + '\n';
const gzipped = gzipSync(Buffer.from(jsonl), { level: 9 });
const stamps = records.map(edgeTs).filter((ts) => ts !== null);
const heroes = new Set(records.map((row) => row.h).filter((h) => h !== null)).size;
const summary = {
  builds: records.length,
  heroes,
  oldest: stamps.length ? Math.min(...stamps) : null,
  newest: stamps.length ? Math.max(...stamps) : null,
  pages,
  upstreamBytes,
  rawBytes: Buffer.byteLength(jsonl),
  gzipBytes: gzipped.length,
};

if (args.dryRun) {
  log({ event: 'dry-run', wrote: null, ...summary });
  console.log(
    `build-snapshot: dry run — ${summary.builds} builds, ${summary.heroes} heroes, ` +
      `${summary.upstreamBytes} upstream bytes, ${summary.rawBytes} raw bytes, ${summary.gzipBytes} gzipped, nothing written`,
  );
  process.exit(0);
}

mkdirSync(outDir, { recursive: true, mode: 0o700 });
chmodSync(outDir, 0o700);
const outFile = join(outDir, `${new Date().toISOString().slice(0, 10)}-${args.label}.json.gz`);
writeFileSync(outFile, gzipped, { mode: 0o600 });
chmodSync(outFile, 0o600);

log({ event: 'wrote', file: outFile, ...summary });
console.log(
  `build-snapshot: ${summary.builds} builds, ${summary.heroes} heroes, ` +
    `oldest ${summary.oldest} newest ${summary.newest}, ` +
    `${summary.rawBytes} raw bytes, ${summary.gzipBytes} gzipped -> ${outFile}`,
);
