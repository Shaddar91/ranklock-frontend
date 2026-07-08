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
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

//301-redirects to https://api.deadlock-api.com/v1/assets/items (fetch follows it).
const SRC = 'https://assets.deadlock-api.com/v2/items';
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/items-catalog.json');
const OUT_DETAIL = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/items-detail.json');
const OUT_DESC = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/item-descriptions.json');

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

const res = await fetch(SRC, { headers: { 'User-Agent': 'ranklock-asset-mirror' } });
if (!res.ok) {
  console.error(`gen-item-catalog: fetch failed — HTTP ${res.status} ${res.statusText}`);
  process.exit(1);
}
const all = await res.json();
if (!Array.isArray(all)) {
  console.error('gen-item-catalog: unexpected response (not an array)');
  process.exit(1);
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
for (const e of all) {
  if (e.type !== 'upgrade' || e.id == null) continue;
  const icon = e.shop_image_webp || e.shop_image || e.image_webp || e.image || null;
  if (!icon || icon.includes('upgrades/mods_weapon') || !/\.(webp|png|jpg)$/i.test(icon)) {
    skipped += 1;
    continue;
  }
  withIcon += 1;
  catalog[e.id] = { name: e.name, icon };

  //Rich detail (build-only file). description is `{ desc: "<html>" }` or `{}`.
  const desc = plainText(e.description && e.description.desc);
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
}

const ids = Object.keys(catalog);
if (ids.length === 0) {
  console.error('gen-item-catalog: no upgrade items found — refusing to write an empty catalog');
  process.exit(1);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(catalog) + '\n');
writeFileSync(OUT_DETAIL, JSON.stringify(detail) + '\n');
writeFileSync(OUT_DESC, JSON.stringify(descriptions) + '\n');
console.log(`gen-item-catalog: wrote ${ids.length} items (${withIcon} with icon) -> ${OUT}`);
console.log(`gen-item-catalog: wrote ${ids.length} items (${withDesc} with description) -> ${OUT_DETAIL}`);
console.log(`gen-item-catalog: wrote ${withDesc} descriptions -> ${OUT_DESC}`);
console.log(`gen-item-catalog: skipped ${skipped} art-less/deprecated upgrade entries (no colored shop tile)`);
