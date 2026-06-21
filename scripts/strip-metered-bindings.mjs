//ranklock-frontend — post-build metered-binding guard + stripper.
//
//WHY: @astrojs/cloudflare emits dist/server/wrangler.json for the two dynamic
//Worker routes (players/:id, matches/:id). wrangler's config serializer writes
//EVERY binding array as an empty `[]` even when unset, so `kv_namespaces: []`
//survives in the output even though astro.config pins a non-KV session driver and
//imageService:'compile' (which already removes the `images` object). The
//no-metered-bindings rule (requirements §A.1) and the C5 success criterion need
//these keys ABSENT, not merely empty.
//
//WHAT: for each design-forbidden metered binding, delete its key when it is
//empty, and HARD-FAIL the build if any is non-empty — a real metered binding
//leaking into the deploy config must break CI, never ship silently. Runs as the
//second stage of `npm run build`, so the success-criterion command
//(`npm run build && python3 …`) and the CI deploy both see a clean config.

import { readFile, writeFile } from 'node:fs/promises';

const CONFIG_PATH = new URL('../dist/server/wrangler.json', import.meta.url);

//The metered surfaces the static-first design forbids (wrangler.toml header +
//task C5). Each reader returns the binding list for that surface so the same
//empty/non-empty check covers both array- and object-shaped bindings.
const METERED = {
  kv_namespaces: (w) => w.kv_namespaces, //array of {binding}
  r2_buckets: (w) => w.r2_buckets, //array of {binding,bucket_name}
  d1_databases: (w) => w.d1_databases, //array of {binding,database_id}
  durable_objects: (w) => w.durable_objects?.bindings, //{bindings:[…]}
  images: (w) => (w.images?.binding ? [w.images] : []), //{binding} object
};

const isEmpty = (list) => !Array.isArray(list) || list.length === 0;

const cfg = JSON.parse(await readFile(CONFIG_PATH, 'utf8'));

const leaked = [];
for (const [key, read] of Object.entries(METERED)) {
  if (isEmpty(read(cfg))) {
    //Strip the empty key so the emitted config carries NO metered binding key.
    delete cfg[key];
  } else {
    leaked.push(`${key} (${read(cfg).length})`);
  }
}

//The adapter mirrors session/image bindings under `previews`; scrub the same
//metered keys there and drop the object entirely once it is empty.
if (cfg.previews && typeof cfg.previews === 'object') {
  for (const key of ['kv_namespaces', 'images']) delete cfg.previews[key];
  if (Object.keys(cfg.previews).length === 0) delete cfg.previews;
}

if (leaked.length > 0) {
  console.error(
    `[strip-metered-bindings] FORBIDDEN metered binding(s) present in dist/server/wrangler.json: ${leaked.join(', ')}`,
  );
  process.exit(1);
}

await writeFile(CONFIG_PATH, `${JSON.stringify(cfg, null, 2)}\n`);
console.log(
  '[strip-metered-bindings] zero metered bindings — kv_namespaces/r2_buckets/d1_databases/durable_objects/images stripped from dist/server/wrangler.json',
);
