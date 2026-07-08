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
//abilities/weapons/misc are excluded. Prefer the PNG (image) like the hero icons,
//fall back to WebP; a handful of items have no art at all (icon:null → GameIcon
//keeps its monogram fallback, which is correct — the CDN has nothing to show).
const catalog = {};
const detail = {};
let withIcon = 0;
let withDesc = 0;
for (const e of all) {
  if (e.type !== 'upgrade' || e.id == null) continue;
  const icon = e.image || e.image_webp || null;
  if (icon) withIcon += 1;
  catalog[e.id] = { name: e.name, icon };

  //Rich detail (build-only file). description is `{ desc: "<html>" }` or `{}`.
  const desc = plainText(e.description && e.description.desc);
  if (desc) withDesc += 1;
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
console.log(`gen-item-catalog: wrote ${ids.length} items (${withIcon} with icon) -> ${OUT}`);
console.log(`gen-item-catalog: wrote ${ids.length} items (${withDesc} with description) -> ${OUT_DETAIL}`);
