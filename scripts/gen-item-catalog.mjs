#!/usr/bin/env node
//Generate src/data/items-catalog.json — a compact { [item_id]: { name, icon } }
//map for Deadlock upgrade (shop) items.
//
//Why this exists: the stats endpoints /items/stats and /heroes/:id/item-win-rates
//return item_name and icon_url as null (the backend doesn't join item metadata
//there the way it does for /heroes and /items/modifiers). Without this catalog the
//items table renders "Item 7409189" labels over blank monogram tiles. The catalog
//lets the frontend fill those nulls at the apiClient layer (see src/lib/itemCatalog.ts).
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
let withIcon = 0;
for (const e of all) {
  if (e.type !== 'upgrade' || e.id == null) continue;
  const icon = e.image || e.image_webp || null;
  if (icon) withIcon += 1;
  catalog[e.id] = { name: e.name, icon };
}

const ids = Object.keys(catalog);
if (ids.length === 0) {
  console.error('gen-item-catalog: no upgrade items found — refusing to write an empty catalog');
  process.exit(1);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(catalog) + '\n');
console.log(`gen-item-catalog: wrote ${ids.length} items (${withIcon} with icon) -> ${OUT}`);
