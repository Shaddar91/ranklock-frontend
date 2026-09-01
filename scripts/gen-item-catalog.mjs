#!/usr/bin/env node
//Generate two Deadlock item data files from the community assets service:
//
//  1. src/data/items-catalog.json — a compact { [item_id]: { name, icon } } map.
//     This is the CLIENT-bundled fallback: the stats endpoints /items/stats and
//     /heroes/:id/item-win-rates return item_name and icon_url as null (the backend
//     doesn't join item metadata there the way it does for /heroes and
//     /items/modifiers), so without it the items table renders "Item 7409189"
//     labels over blank monogram tiles. The frontend fills those nulls at the
//     apiClient layer (see src/lib/itemCatalog.ts). Kept name+icon-only so it stays
//     small in the client JS bundle.
//
//  2. src/data/items-detail.json — a richer { [item_id]: { name, cost, tier, slot,
//     desc } } map used ONLY by the SSG item-detail route (src/pages/items/[id].astro,
//     imported in build/server frontmatter so it never enters the client bundle).
//     Sources cost / item_tier / item_slot_type / description straight from the same
//     upstream so the detail page needs no backend endpoint.
//
//  3. src/data/item-descriptions.json — a lean { [item_id]: desc } map (only the items
//     that actually HAVE a description). This one IS client-bundled, but imported ONLY
//     by the items-table island (src/lib/itemDescriptions.ts) so the item hover tooltip
//     can show "what it does". It carries just the desc text — not the full
//     items-detail.json (cost/tier/slot) — and stays out of the everywhere-loaded
//     items-catalog.json, so hero pages never pay for it.
//
//Source: the community deadlock-api assets service — the SAME upstream the asset
//mirror uses (design/assets/mirror_assets.py). The image URLs it returns are public
//CDN links (assets-bucket.deadlock-api.com); we pin them straight into the catalog so
//GameIcon points at the CDN. Art is Valve IP extracted from the game files.
//
//Re-run when the item set changes (new patch / new items):
//    node scripts/gen-item-catalog.mjs
//
//CI drift gate (R19):
//    node scripts/gen-item-catalog.mjs --check
//Runs the SAME regen path (live fetch + full transform — the generator is inert
//unless items-detail.json is actually regenerated, so --check must exercise the
//real thing), but writes to a temp dir and diffs against the committed files
//instead of overwriting them. Exit 1 = drift (fix: run the plain regen above and
//commit). Upstream unreachable/malformed = exit 0 with a loud ::warning:: — a
//third-party CDN outage must not block a code deploy; only real drift may.
import { writeFileSync, mkdirSync, mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHECK = process.argv.includes('--check');

//301-redirects to https://api.deadlock-api.com/v1/assets/items (fetch follows it).
const SRC = 'https://assets.deadlock-api.com/v2/items';
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/items-catalog.json');
const OUT_DETAIL = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/items-detail.json');
const OUT_DESC = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/item-descriptions.json');
const OUT_UPGRADES = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/item-upgrades.json');

//The upstream `description.desc` carries light HTML (<span class="highlight">…</span>,
//<br>, entities). Flatten it to plain text for a clean, injection-safe detail page.
function plainText(html) {
  if (typeof html !== 'string' || !html) return null;
  const txt = html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return txt || null;
}

//Upstream failure: in write mode this is fatal (exit 1 — never overwrite good files
//with nothing). In --check mode it is a SKIP (exit 0 + loud warning): an unreachable
//or malformed upstream is not evidence of drift, and the deploy gate must not be
//hostage to the community CDN's uptime.
function upstreamFail(msg) {
  if (CHECK) {
    console.warn(`::warning::gen-item-catalog --check SKIPPED (cannot verify drift): ${msg}`);
    process.exit(0);
  }
  console.error(`gen-item-catalog: ${msg}`);
  process.exit(1);
}

const res = await fetch(SRC, { headers: { 'User-Agent': 'ranklock-asset-mirror' } }).catch((err) =>
  upstreamFail(`fetch failed — ${err?.cause?.code ?? err?.message ?? err}`),
);
if (!res.ok) {
  upstreamFail(`fetch failed — HTTP ${res.status} ${res.statusText}`);
}
const all = await res.json().catch(() => null);
if (!Array.isArray(all)) {
  upstreamFail('unexpected response (not an array)');
}

//Only type==="upgrade" entries are the buildable shop items /items/stats reports;
//abilities/weapons/misc are excluded. Prefer the dedicated SHOP art (shop_image_webp /
//shop_image) over plain image/image_webp: for items the latter is the mono UPGRADE glyph
//(e.g. Silencer -> upgrades/mods_weapon/emp_bullets.png) while the shop fields carry the
//colored shop tile (items/weapon/silencer.webp) — the SAME art the live /items API serves.
//
//Then SKIP any entry that STILL has no real colored shop art: a null icon, the monochrome
//weapon-mod glyph (upgrades/mods_weapon/*), or a malformed non-image URL (the feed emits
//`.../images/panorama:""` for a couple of stubs, e.g. Toughness / Endless Magazine). Those
//are deprecated / pre-release / internal upgrade definitions — the live /items shop API
//serves NONE of them and the CDN has no shop tile, so a detail page for them could only ever
//render the reported mono-glyph or blank monogram fallback. Dropping them keeps every
//generated item page on real shop art (detail == list). Verified 2026-07-08: this drops 22
//of 251 upgrade entries, none of which appear in the live /items feed, so no shop-served
//item loses its page.
const catalog = {};
const detail = {};
const descriptions = {};
let withIcon = 0;
let withDesc = 0;
let skipped = 0;
let codenameSkipped = 0;
//`component_items` refs are CLASS NAMES (e.g. upgrade_hollow_point_rounds), not ids —
//pre-index every upgrade entry by class_name so lineage resolves in one pass.
const idByClass = new Map();
for (const e of all) {
  if (e.type === 'upgrade' && e.id != null && typeof e.class_name === 'string') idByClass.set(e.class_name, e.id);
}
const pendingUpgrades = [];
for (const e of all) {
  if (e.type !== 'upgrade' || e.id == null) continue;

  //Skip raw-codename entries. The feed exposes NO human display name for these: BOTH `name`
  //and `class_name` are the internal `upgrade_*` codename (e.g. upgrade_cloaking_device), so a
  //generated detail page could only ever title itself "upgrade_cloaking_device". (Good items keep
  //a real display `name` like "Silencer" even though their `class_name` is also `upgrade_*`, so we
  //key on NAME, never class_name.) Verified 2026-07-09: every codename entry is disabled:true +
  //shopable:false + start_trained:true with no shop art — deprecated/internal upgrade defs the live
  ///items shop API never serves (i.e. absent from the live /items meta, so win-rate/matches are
  //always null too). This is the same "no real name AND not in live /items => exclude" rule that
  //already prunes art-less items below; it drops 39 of 251 upgrade entries, none shop-served.
  if (typeof e.name === 'string' && e.name.startsWith('upgrade_')) {
    codenameSkipped += 1;
    continue;
  }

  const icon = e.shop_image_webp || e.shop_image || e.image_webp || e.image || null;
  if (!icon || icon.includes('upgrades/mods_weapon') || !/\.(webp|png|jpg)$/i.test(icon)) {
    skipped += 1;
    continue;
  }
  withIcon += 1;
  catalog[e.id] = { name: e.name, icon };

  //Rich detail (build-only file). description is `{ desc: "<html>" }` or `{}`.
  //Fall back to .passive then .active for class-B items that omit .desc.
  const desc = plainText(
    e.description && (e.description.desc || e.description.passive || e.description.active),
  );
  if (desc) {
    withDesc += 1;
    //Lean client map for the hover tooltip — desc text only, and only when present.
    descriptions[e.id] = desc;
  }
  detail[e.id] = {
    name: e.name,
    icon,
    cost: e.cost ?? null,
    tier: e.item_tier ?? null,
    slot: e.item_slot_type ?? null,
    active: e.is_active_item ?? null,
    desc,
  };

  if (Array.isArray(e.component_items) && e.component_items.length > 0) {
    pendingUpgrades.push([e.id, e.component_items]);
  }
}

//4. src/data/item-upgrades.json — { [item_id]: [component_item_id, ...] }, the
//"upgrades from" lineage for the item hover overlay. Components resolve via the
//class index; only components that survived the catalog filters are kept, so
//every emitted id renders with a real name+icon through itemCatalog.itemMeta().
const upgradesMap = {};
for (const [id, comps] of pendingUpgrades) {
  const resolved = comps
    .map((c) => idByClass.get(c))
    .filter((cid) => cid != null && cid in catalog);
  if (resolved.length > 0) upgradesMap[id] = resolved;
}

const ids = Object.keys(catalog);
if (ids.length === 0) {
  //An all-filtered feed would mean wiping the catalog — never automatic, in either mode.
  upstreamFail('no upgrade items found — refusing an empty catalog');
}

const outputs = [
  [OUT, JSON.stringify(catalog) + '\n'],
  [OUT_DETAIL, JSON.stringify(detail) + '\n'],
  [OUT_DESC, JSON.stringify(descriptions) + '\n'],
  [OUT_UPGRADES, JSON.stringify(upgradesMap) + '\n'],
];

if (CHECK) {
  //Drift gate: regenerate into a temp dir, byte-diff against the committed files.
  const tmp = mkdtempSync(join(tmpdir(), 'gen-item-catalog-check-'));
  const drifted = [];
  for (const [committedPath, fresh] of outputs) {
    const name = basename(committedPath);
    writeFileSync(join(tmp, name), fresh);
    const committed = existsSync(committedPath) ? readFileSync(committedPath, 'utf8') : null;
    if (committed === fresh) continue;
    let summary = 'committed file missing';
    if (committed !== null) {
      try {
        const oldIds = new Set(Object.keys(JSON.parse(committed)));
        const freshObj = JSON.parse(fresh);
        const newIds = Object.keys(freshObj);
        const added = newIds.filter((id) => !oldIds.has(id)).length;
        const removed = [...oldIds].filter((id) => !(id in freshObj)).length;
        summary = `${oldIds.size} committed vs ${newIds.length} regenerated ids (+${added}/-${removed}, rest changed in place)`;
      } catch {
        summary = 'committed file is not valid JSON';
      }
    }
    drifted.push(`${name}: ${summary}`);
  }
  if (drifted.length > 0) {
    console.error(`gen-item-catalog --check: DRIFT — committed src/data files no longer match the upstream feed:`);
    for (const line of drifted) console.error(`  - ${line}`);
    console.error(`Fresh copies left in ${tmp} for inspection.`);
    console.error('Fix: run `node scripts/gen-item-catalog.mjs` and commit the regenerated files.');
    process.exit(1);
  }
  console.log(`gen-item-catalog --check: no drift (${ids.length} items match the committed files)`);
  process.exit(0);
}

mkdirSync(dirname(OUT), { recursive: true });
for (const [path, fresh] of outputs) writeFileSync(path, fresh);
console.log(`gen-item-catalog: wrote ${ids.length} items (${withIcon} with icon) -> ${OUT}`);
console.log(`gen-item-catalog: wrote ${ids.length} items (${withDesc} with description) -> ${OUT_DETAIL}`);
console.log(`gen-item-catalog: wrote ${withDesc} descriptions -> ${OUT_DESC}`);
console.log(`gen-item-catalog: wrote ${Object.keys(upgradesMap).length} upgrade lineages -> ${OUT_UPGRADES}`);
console.log(`gen-item-catalog: skipped ${skipped} art-less/deprecated upgrade entries (no colored shop tile)`);
console.log(`gen-item-catalog: skipped ${codenameSkipped} raw-codename upgrade entries (no display name, not in live /items)`);
