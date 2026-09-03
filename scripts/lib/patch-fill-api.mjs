//Live-value sources for the patch-content fill generator: the ranklock API,
//the changelog mirror, and the renderers that turn them into our own prose.
import { fail, log, notReady } from './patch-fill-log.mjs';

const API_BASE = (process.env.RANKLOCK_API_BASE ?? 'https://api.ranklock.app').replace(/\/+$/, '');
const USER_AGENT = 'ranklock-patch-content-fill/1 (+https://ranklock.app)';
const NO_GAMES = 'not enough games yet at this rank';

async function get(url) {
  return fetch(url, { headers: { 'User-Agent': USER_AGENT } }).catch((err) =>
    fail(`fetch failed for ${url} — ${err?.cause?.code ?? err?.message ?? err}`),
  );
}

async function getJson(url) {
  const res = await get(url);
  if (res.status !== 200) fail(`HTTP ${res.status} from ${url}`);
  return res.json().catch(() => fail(`response from ${url} is not JSON`));
}

async function getText(url) {
  const res = await get(url);
  if (res.status !== 200) fail(`HTTP ${res.status} from ${url}`);
  return res.text();
}

//The registry can lag Valve, so the record's date is checked against /patches too.
export async function resolvePatch(recordDate) {
  const current = await getJson(`${API_BASE}/patches/current`);
  if (current.patch_id === recordDate) {
    log({ event: 'patch-resolved', patch_id: current.patch_id, via: 'current' });
    return current;
  }
  log({ event: 'patch-registry-mismatch', current: current.patch_id ?? null, record_date: recordDate });
  const list = await getJson(`${API_BASE}/patches`);
  const row = list.find((p) => p.patch_id === recordDate)
    ?? list.find((p) => (p.released_at ?? '').slice(0, 10) === recordDate);
  if (!row) fail(`no patch registry row matches the record date ${recordDate}`);
  log({ event: 'patch-resolved', patch_id: row.patch_id, via: 'list' });
  return row;
}

//Facts only: a line that does not parse into fields is dropped, never quoted.
const CHANGE_LINE = /^-\s+(?<entity>[^:]+?):\s+(?<field>.+?)\s+(?<direction>reduced|increased|decreased|rescaled|changed|raised|lowered|buffed|nerfed)\s+from\s+(?<before>.+?)\s+to\s+(?<after>.+?)\s*$/i;

export function parseChangelog(text) {
  const changes = [];
  let candidates = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!/^-\s+/.test(line)) continue;
    candidates += 1;
    const match = line.match(CHANGE_LINE);
    if (!match) continue;
    const { entity, field, direction, before, after } = match.groups;
    changes.push({
      entity: entity.trim(),
      field: field.trim(),
      direction: direction.toLowerCase(),
      before: before.trim(),
      after: after.trim(),
    });
  }
  log({ event: 'changelog-parsed', candidates, parsed: changes.length, dropped: candidates - changes.length });
  return changes;
}

//Lowercase a common-noun field ("Heal on cast"); keep title-case ability names.
function styleField(field) {
  return /^[A-Z][a-z]+\s+[a-z]/.test(field) ? field[0].toLowerCase() + field.slice(1) : field;
}

function renderChanges(changes) {
  return changes
    .map((c) => `- **${c.entity}** — ${styleField(c.field)} ${c.before} → ${c.after}`)
    .join('\n');
}

//The rolling window behind the grids is the modal dataset window of data-horizon.
export async function horizonValues() {
  const horizon = await getJson(`${API_BASE}/meta/data-horizon`);
  const maxStart = Date.parse(horizon.max_match_start_time ?? '');
  if (Number.isNaN(maxStart)) fail('data-horizon carries no max_match_start_time');
  const windows = new Map();
  for (const dataset of horizon.datasets ?? []) {
    if (!dataset.window_lo || !dataset.window_hi) continue;
    const key = `${dataset.window_lo}|${dataset.window_hi}`;
    windows.set(key, (windows.get(key) ?? 0) + 1);
  }
  if (windows.size === 0) fail('data-horizon carries no dataset windows');
  const [best] = [...windows.entries()].sort((a, b) => b[1] - a[1])[0];
  const [lo, hi] = best.split('|');
  const days = Math.round((Date.parse(hi) - Date.parse(lo)) / 86400000);
  const lagHours = Math.round((Date.now() - maxStart) / 3600000);
  log({ event: 'data-horizon', window_lo: lo, window_hi: hi, lag_hours: lagHours });
  return {
    DATA_WINDOW: `${days} days (${lo.slice(0, 10)} → ${hi.slice(0, 10)})`,
    DATA_LAG: `${lagHours} hours`,
  };
}

export async function wave1Values(patch, t0) {
  const changes = parseChangelog(await getText(patch.notes_url));
  const horizon = await horizonValues();
  const values = {
    PATCH_LABEL: patch.version_label,
    PATCH_DATE: `${t0.slice(0, 10)} ${t0.slice(11, 16)} UTC`,
    CHANGED_ENTITIES: renderChanges(changes),
    CHANGED_COUNT: String(changes.length),
    ...horizon,
  };
  return { values, count: changes.length };
}

const pct = (v) => `${(v * 100).toFixed(1)} %`;
const pts = (v) => {
  const rendered = (v * 100).toFixed(1);
  const normalized = rendered === '-0.0' ? '0.0' : rendered;
  return normalized.startsWith('-') ? `${normalized} pts` : `+${normalized} pts`;
};

function median(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

//R1: a null rate prints the sentence, never a zero and never a dash.
function renderMovers(rows) {
  const lines = [
    '| Hero | Win rate | Win-rate move | Pick-rate move | Matches |',
    '|---|---|---|---|---|',
  ];
  for (const row of rows) {
    lines.push(`| ${row.hero_name} | ${row.win_rate == null ? NO_GAMES : pct(row.win_rate)} | ${row.delta_win_rate == null ? NO_GAMES : pts(row.delta_win_rate)} | ${row.delta_pick_rate == null ? NO_GAMES : pts(row.delta_pick_rate)} | ${typeof row.matches === 'number' ? row.matches.toLocaleString('en-US') : NO_GAMES} |`);
  }
  return lines.join('\n');
}

//SAMPLE_N is the pick-rate denominator the movers rows themselves carry.
export async function moversValues(patchId) {
  const res = await get(`${API_BASE}/patches/${patchId}/movers?limit=10`);
  if (res.status === 202) notReady('movers 202');
  if (res.status === 500) notReady('movers 500 — section omitted');
  if (res.status !== 200) fail(`movers returned HTTP ${res.status}`);
  const data = await res.json().catch(() => fail('movers response is not JSON'));
  const rows = [...(data.gainers ?? []), ...(data.losers ?? [])];
  if (rows.length === 0) fail('movers returned no rows');
  const ratios = rows
    .filter((r) => typeof r.matches === 'number' && typeof r.pick_rate === 'number' && r.pick_rate > 0)
    .map((r) => r.matches / r.pick_rate);
  if (ratios.length === 0) fail('movers rows carry no usable sample fields');
  const spread = Math.max(...ratios) / Math.min(...ratios);
  if (spread > 1.02) fail(`movers sample denominator inconsistent (spread ${spread.toFixed(3)})`);
  const sample = Math.round(median(ratios));
  log({ event: 'movers', status: 200, rows: rows.length, sample_n: sample });
  return {
    values: { MOVERS_TABLE: renderMovers(rows), SAMPLE_N: sample.toLocaleString('en-US') },
    topGainerId: data.gainers?.[0]?.hero_id ?? null,
  };
}

//R4 item-set guard, flag-gated off until the duplicate-item defect is diagnosed.
export const ITEM_SETS_ENABLED = process.env.RANKLOCK_PATCH_ITEM_SETS === '1';

export async function itemSetValues(heroId, releasedAt) {
  const res = await get(`${API_BASE}/heroes/${heroId}/build-stats`);
  if (res.status !== 200) fail(`build-stats returned HTTP ${res.status}`);
  const windowTo = res.headers.get('x-data-window-to');
  if (windowTo === null || Date.parse(windowTo) < Date.parse(releasedAt)) {
    log({ event: 'item-sets-refused', hero_id: heroId, window_to: windowTo, reason: 'window older than the patch' });
    return null;
  }
  const data = await res.json().catch(() => fail('build-stats response is not JSON'));
  const sets = [];
  for (const set of data.item_sets ?? []) {
    const seen = new Set();
    const items = (set.items ?? []).filter((item) => {
      if (item?.item_id == null || seen.has(item.item_id)) return false;
      seen.add(item.item_id);
      return true;
    });
    if (items.length < 4) continue;
    sets.push({ ...set, items });
  }
  if (sets.length === 0) {
    log({ event: 'item-sets-refused', hero_id: heroId, reason: 'no set clears the distinct-item floor' });
    return null;
  }
  const lines = ['| Set | Win rate | Games |', '|---|---|---|'];
  for (const set of sets.slice(0, 5)) {
    const names = set.items.map((item) => item.item_name).join(', ');
    const rate = set.win_rate == null ? NO_GAMES : pct(set.win_rate);
    const games = typeof set.games === 'number' ? set.games.toLocaleString('en-US') : NO_GAMES;
    lines.push(`| ${names} | ${rate} | ${games} |`);
  }
  return { ITEM_SETS: lines.join('\n') };
}
