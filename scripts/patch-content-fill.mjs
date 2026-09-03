#!/usr/bin/env node
//Fill the sentinels in the staged patch posts from a watcher record and the live
//ranklock API, in two waves. Writes only the files named in --posts plus a run
//record under the XDG state dir; never commits, pushes or deploys.
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fail, log, notReady } from './lib/patch-fill-log.mjs';
import { horizonValues, moversValues, resolvePatch, wave1Values } from './lib/patch-fill-api.mjs';
import {
  SENTINEL,
  WAVE1_TOKENS,
  fillTokens,
  getDescription,
  isHeld,
  joinFm,
  restoreWave2Block,
  sentinelsIn,
  setDescription,
  setFmField,
  splitFrontmatter,
  stripDescriptionSentinels,
  stripWave2Block,
  tokenName,
  uncommentWave2Block,
  uncommentWave2InPlace,
  wrapPatchPhrases,
} from './lib/patch-fill-text.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_POSTS = [
  'src/content/blog/patch-what-changed-for-builds.md',
  'src/content/blog/patch-two-weeks-later-builds-that-stuck.md',
];
const CONTAMINATION_LIMIT = 0.25;
const LATER_POST_DELAY_MS = 14 * 24 * 3600 * 1000;

function parseArgs(argv) {
  const args = { wave: null, record: null, posts: DEFAULT_POSTS, dryRun: false, forceT0: null };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--dry-run') args.dryRun = true;
    else if (flag === '--wave') { args.wave = value; i += 1; }
    else if (flag === '--record') { args.record = value; i += 1; }
    else if (flag === '--posts') { args.posts = value.split(',').map((p) => p.trim()).filter(Boolean); i += 1; }
    else if (flag === '--force-t0') { args.forceT0 = value; i += 1; }
    else fail(`unknown argument: ${flag}`, 2);
    if (flag !== '--dry-run' && value === undefined) fail(`${flag} needs a value`, 2);
  }
  if (args.wave !== '1' && args.wave !== '2') fail('--wave must be 1 or 2', 2);
  if (args.record === null) fail('--record is required (path, or - for stdin)', 2);
  if (args.posts.length === 0) fail('--posts named no files', 2);
  if (args.forceT0 !== null && Number.isNaN(Date.parse(args.forceT0))) fail(`--force-t0 is not a real date: "${args.forceT0}"`, 2);
  return args;
}

function readRecord(source) {
  const raw = source === '-' ? readFileSync(0, 'utf8') : readFileSync(resolve(source), 'utf8');
  let record;
  try {
    record = JSON.parse(raw);
  } catch {
    fail('record is not valid JSON', 2);
  }
  if (typeof record?.published_at !== 'string' || Number.isNaN(Date.parse(record.published_at))) {
    fail('record carries no parseable published_at', 2);
  }
  return record;
}

function resolvePosts(list) {
  const abs = list.map((p) => (isAbsolute(p) ? p : resolve(REPO_ROOT, p)));
  for (const post of abs) {
    if (!existsSync(post)) fail(`post not found: ${post}`);
  }
  return { abs, rel: abs.map((p) => relative(REPO_ROOT, p)) };
}

function stateDir() {
  const override = process.env.RANKLOCK_PATCH_CONTENT_STATE_DIR;
  if (override) return resolve(override);
  const base = process.env.XDG_STATE_HOME || join(homedir(), '.local', 'state');
  return join(base, 'ranklock-patch-content');
}

//R1 guard, same shape as build-snapshot.mjs: probe the nearest existing ancestor.
function assertOutsideGitWorkTree(dir) {
  let probe = dir;
  while (!existsSync(probe)) {
    const up = dirname(probe);
    if (up === probe) break;
    probe = up;
  }
  const git = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: probe, encoding: 'utf8' });
  if (git.status === 0) fail(`state path is inside a git work tree (R1): ${dir}`, 3);
}

//The generator may write only the files --posts named; anything else modified
//in the tree means a foreign change would ride along, so the run refuses.
function gitGuard(intendedRel) {
  const res = spawnSync('git', ['status', '--porcelain'], { cwd: REPO_ROOT, encoding: 'utf8' });
  if (res.status !== 0) fail(`git status failed: ${(res.stderr || '').trim()}`);
  const modified = res.stdout
    .split('\n')
    .filter((l) => l.trim() !== '' && !l.startsWith('??'))
    .map((l) => l.slice(3).split(' -> ').pop());
  const outside = modified.filter((p) => !intendedRel.includes(p));
  if (outside.length > 0) fail(`working tree holds changes outside --posts: ${outside.join(', ')}`);
  log({ event: 'git-guard', clean_outside_posts: true });
}

function writeRunRecord(patchId, wave, record) {
  const dir = join(stateDir(), 'runs');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
  const file = join(dir, `${patchId}-w${wave}.json`);
  writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
  log({ event: 'run-record', file });
}

function readRunRecord(patchId, wave) {
  const file = join(stateDir(), 'runs', `${patchId}-w${wave}.json`);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function emitBodies(results) {
  for (const result of results) {
    console.log(`----- ${result.post} -----`);
    console.log(result.text);
  }
}

async function wave1(args, record, t0) {
  const patch = await resolvePatch(record.published_at.slice(0, 10));
  const { values, count } = await wave1Values(patch, t0);
  if (count === 0) fail('THIN PATCH: 0 changes — nothing patch-specific to say, refusing to publish');
  const thin = count <= 5;
  if (thin) console.log(`THIN PATCH: ${count} changes`);
  const posts = resolvePosts(args.posts);
  if (!args.dryRun) gitGuard(posts.rel);
  const results = [];
  for (const post of posts.abs) {
    const original = readFileSync(post, 'utf8');
    const dayOne = original.includes('{{CHANGED_ENTITIES}}');
    const filled = {};
    let text = original;
    for (const token of WAVE1_TOKENS) {
      if (text.includes(`{{${token}}}`)) {
        text = text.split(`{{${token}}}`).join(values[token]);
        filled[token] = values[token];
      }
    }
    const entry = {
      path: post,
      published: false,
      sentinels_filled: filled,
      description_original: null,
      wave2_block: null,
      wave2_anchor: null,
    };
    if (dayOne) {
      const stripped = stripWave2Block(text, post);
      if (stripped !== null) {
        entry.wave2_block = stripped.block;
        entry.wave2_anchor = stripped.anchor;
        text = stripped.text;
      }
      const { fm, rest } = splitFrontmatter(text, post);
      let fmOut = fm;
      const description = getDescription(fm);
      if (description !== null && SENTINEL.test(description)) {
        entry.description_original = description;
        fmOut = setDescription(fm, stripDescriptionSentinels(description));
      }
      fmOut = setFmField(fmOut, 'pubDate', new Date().toISOString().slice(0, 10));
      fmOut = setFmField(fmOut, 'draft', 'false');
      text = joinFm(fmOut, rest);
      const left = sentinelsIn(text);
      if (left.length > 0) fail(`refusing to publish ${post}: sentinels remain: ${left.map(tokenName).join(', ')}`);
      entry.published = true;
    }
    results.push({ post, text: wrapPatchPhrases(text), entry });
    log({ event: 'post-fill', wave: 1, file: post, published: entry.published, sentinels: Object.keys(filled) });
  }
  if (args.dryRun) {
    emitBodies(results);
    log({ event: 'dry-run', wave: 1, wrote: null });
    return;
  }
  for (const result of results) writeFileSync(result.post, result.text);
  writeRunRecord(patch.patch_id, 1, {
    patch_id: patch.patch_id,
    wave: 1,
    run_at: new Date().toISOString(),
    t0_real: t0,
    forced_t0: args.forceT0 !== null,
    contamination: null,
    changed_count: count,
    thin,
    files: results.map((r) => r.entry),
  });
}

//Restore path for the published day-one post: re-insert the wave-2 section the
//wave-1 run held back, filled, ahead of the anchor line it was stripped from.
function wave2Restore(post, original, w1entry, values2, results) {
  const inner = uncommentWave2Block(w1entry.wave2_block);
  const heading = inner.split('\n').find((l) => l.trim() !== '');
  if (original.includes(heading)) return 'already-restored';
  let text = restoreWave2Block(original, fillTokens(inner, values2), w1entry.wave2_anchor, post);
  const parts = splitFrontmatter(text, post);
  let fmOut = parts.fm;
  if (typeof w1entry.description_original === 'string') {
    fmOut = setDescription(
      fmOut,
      fillTokens(w1entry.description_original, { ...(w1entry.sentinels_filled ?? {}), ...values2 }),
    );
  }
  fmOut = setFmField(fmOut, 'updatedDate', new Date().toISOString().slice(0, 10));
  text = wrapPatchPhrases(joinFm(fmOut, parts.rest));
  const left = sentinelsIn(text);
  if (left.length > 0) fail(`refusing to publish ${post}: sentinels remain after restore: ${left.map(tokenName).join(', ')}`);
  results.push({ post, text, entry: { path: post, first_publish: false, sentinels_filled: values2 } });
  log({ event: 'post-fill', wave: 2, file: post, first_publish: false });
  return null;
}

//First-publish path for the held later post: one combined fill at T0 + 14 d,
//with the wave-1-filled data window re-measured if the horizon has moved.
async function wave2FirstPublish(post, original, w1entry, values2, values1, results) {
  let text = fillTokens(original, { ...(values1 ?? {}), ...values2 });
  const oldWindow = w1entry?.sentinels_filled?.DATA_WINDOW;
  if (typeof oldWindow === 'string') {
    const horizon = values1 ?? (await horizonValues());
    if (horizon.DATA_WINDOW !== oldWindow) {
      text = text.split(oldWindow).join(horizon.DATA_WINDOW);
      log({ event: 'data-window-refresh', file: post });
    }
  }
  text = wrapPatchPhrases(uncommentWave2InPlace(text));
  const parts = splitFrontmatter(text, post);
  let fmOut = setFmField(parts.fm, 'pubDate', new Date().toISOString().slice(0, 10));
  fmOut = setFmField(fmOut, 'draft', 'false');
  text = joinFm(fmOut, parts.rest);
  const left = sentinelsIn(text);
  if (left.length > 0) fail(`refusing to publish ${post}: sentinels remain: ${left.map(tokenName).join(', ')}`);
  results.push({
    post,
    text,
    entry: { path: post, first_publish: true, sentinels_filled: { ...(values1 ?? {}), ...values2 } },
  });
  log({ event: 'post-fill', wave: 2, file: post, first_publish: true });
}

async function wave2(args, record, t0) {
  const patch = await resolvePatch(record.published_at.slice(0, 10));
  const values2 = await moversValues(patch.patch_id);
  const released = Date.parse(patch.released_at ?? '');
  if (Number.isNaN(released)) fail(`patch ${patch.patch_id} carries no released_at`);
  const contamination = (Date.parse(t0) - released) / (Date.now() - released);
  log({ event: 'contamination', value: Number(contamination.toFixed(4)), limit: CONTAMINATION_LIMIT });
  if (contamination > CONTAMINATION_LIMIT) {
    notReady(`contamination ${(contamination * 100).toFixed(1)} % exceeds ${CONTAMINATION_LIMIT * 100} %`);
  }
  const w1 = readRunRecord(patch.patch_id, 1);
  const posts = resolvePosts(args.posts);
  if (!args.dryRun) gitGuard(posts.rel);
  let values1 = null;
  const results = [];
  const skips = [];
  for (const post of posts.abs) {
    const original = readFileSync(post, 'utf8');
    const held = isHeld(splitFrontmatter(original, post).fm);
    const w1entry = w1?.files?.find((f) => f.path === post) ?? null;
    if (!held) {
      if (sentinelsIn(original).length > 0) {
        fail(`published post ${post} still carries sentinels: ${sentinelsIn(original).map(tokenName).join(', ')}`);
      }
      if (w1entry?.wave2_block == null) {
        skips.push({ post, reason: 'nothing to restore', benign: true });
        continue;
      }
      const skipped = wave2Restore(post, original, w1entry, values2, results);
      if (skipped !== null) skips.push({ post, reason: skipped, benign: true });
      continue;
    }
    if (original.includes('{{CHANGED_ENTITIES}}')) {
      skips.push({ post, reason: 'day-one post still held — wave 1 has not completed for it', benign: false });
      continue;
    }
    const due = Date.parse(t0) + LATER_POST_DELAY_MS;
    if (Date.now() < due) {
      skips.push({ post, reason: `not due until ${new Date(due).toISOString().slice(0, 10)}`, benign: false });
      continue;
    }
    if (sentinelsIn(original).some((s) => WAVE1_TOKENS.includes(tokenName(s))) && values1 === null) {
      values1 = (await wave1Values(patch, t0)).values;
    }
    await wave2FirstPublish(post, original, w1entry, values2, values1, results);
  }
  const unresolved = skips.filter((s) => !s.benign);
  for (const skip of skips) log({ event: 'post-skip', file: skip.post, reason: skip.reason });
  if (results.length === 0) {
    if (unresolved.length > 0) {
      notReady(unresolved.map((s) => `${relative(REPO_ROOT, s.post)}: ${s.reason}`).join('; '));
    }
    log({ event: 'done', wave: 2, note: 'nothing left to fill' });
    return;
  }
  if (args.dryRun) {
    emitBodies(results);
    log({ event: 'dry-run', wave: 2, wrote: null });
    return;
  }
  for (const result of results) writeFileSync(result.post, result.text);
  if (unresolved.length === 0) {
    writeRunRecord(patch.patch_id, 2, {
      patch_id: patch.patch_id,
      wave: 2,
      run_at: new Date().toISOString(),
      t0_real: t0,
      forced_t0: args.forceT0 !== null,
      contamination: Number(contamination.toFixed(4)),
      sample_n: values2.SAMPLE_N,
      thin: null,
      files: results.map((r) => r.entry),
    });
  } else {
    log({ event: 'run-record-deferred', waiting_on: unresolved.map((s) => relative(REPO_ROOT, s.post)) });
  }
}

const args = parseArgs(process.argv.slice(2));
const record = readRecord(args.record);
if (record.kind !== 'patch_released') process.exit(0);
const t0 = args.forceT0 ?? record.published_at;
if (args.forceT0 !== null) {
  log({ event: 'force-t0', t0 });
  console.error(`patch-content-fill: FORCE-T0 test seam active: ${t0}`);
}
assertOutsideGitWorkTree(stateDir());
if (args.wave === '1') await wave1(args, record, t0);
else await wave2(args, record, t0);
