import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';

//RankLock frontend — static-first Astro build deployed to Cloudflare static
//assets ($0 baseline). See the architecture doc (frontend-architecture-and-
//rendering-plan.md) and requirements §A.1.
//
//`output: 'static'` is a HARD constraint: the SEO surface (home, heroes, items,
//leaderboard, blog) is prerendered (SSG); the per-user / per-match pages
//(players/:id, matches/:id, coaching, compare, improve) are CSR React islands
//(`client:only="react"`) served as static shells. There is NO Workers KV / R2 /
//D1 / Durable Objects, and NO per-request edge SSR over the Hetzner origin —
//those are the metered bill-spike surfaces the whole design avoids.
//
//The @astrojs/cloudflare adapter IS installed (package.json, BOM §9) and is now
//wired (adapter: cloudflare() below). `output: 'static'` is KEPT: the whole SEO
//surface still prerenders to static assets; ONLY the on-demand dynamic shells
//(`players/:id`, `matches/:id`, marked `export const prerender = false`) run on a
//Cloudflare Worker so an ARBITRARY id is served off the single shell without
//SSG-emitting a page per id (the millions of URLs are never prebuilt). This is
//the documented hybrid: keep output:'static' and add the adapter; only the
//prerender=false routes execute server-side.
//
//PUBLIC_* env vars are exposed to client islands via Astro's default Vite
//envPrefix and are injected at BUILD time by CI (never a committed
//.env.production — requirements §A.2). See README "Environment variables".
export default defineConfig({
  site: 'https://ranklock.app',
  output: 'static',
  //Static-first hybrid: output stays 'static' (the SSG SEO surface is untouched);
  //the adapter is here solely so the `prerender = false` dynamic shells
  //(players/:id, matches/:id) can run on a Cloudflare Worker. No KV/R2/D1 — just
  //the two on-demand routes.
  //
  //ZERO METERED BINDINGS (requirements §A.1, no-bill-spike rule). Left at its
  //defaults, @astrojs/cloudflare auto-emits an `images` (Cloudflare Images)
  //binding into dist/server/wrangler.json — a metered surface. `imageService:
  //'compile'` switches image handling to build-time optimization (Sharp over the
  //prerendered SEO surface) with a passthrough runtime, so the adapter emits NO
  //Images binding (adapter index.js: runtimeService 'passthrough' ⇒
  //needsImagesBinding=false). Verify post-build: dist/server/wrangler.json has no
  //`images` key.
  adapter: cloudflare({ imageService: 'compile' }),
  //ZERO METERED BINDINGS (cont.) — Astro sessions. When `session` has no `driver`
  //the adapter force-defaults it to the Cloudflare KV session driver and emits a
  //`SESSION` kv_namespaces binding (another metered surface). This frontend never
  //uses Astro's server-side session API — it is a static SPA shell + CSR React
  //islands that call the API directly — so we pin the in-memory unstorage driver.
  //A non-KV driver makes the adapter's usesCloudflareKVSessionDriver() return
  //false ⇒ NO kv_namespaces binding emitted. The ephemeral per-isolate memory is
  //irrelevant because no session is ever read or written at runtime.
  session: {
    driver: 'memory',
  },
  //i18n routing (C7) — path-prefix locales, English at the ROOT (no prefix), per
  //the authoritative i18n design (frontend-i18n-design.md): /heroes = en,
  ///ru/heroes = Russian, etc. The 7 launched locales mirror lib/i18n.ts (the
  //single source of truth for the SEO layer); keep the two lists in sync.
  //
  //`fallbackType: 'rewrite'` is the whole interim-locale mechanism: no /ru, /fr…
  //page files exist yet, so every non-default locale route is generated at build
  //by RE-RENDERING the English page at the localized URL (it SERVES English, not
  //a redirect — requirements §8.2). Those pages are then marked noindex +
  //canonical→English in BaseLayout/Seo until real translations land, so the
  //duplicate English content never dilutes the en ranking. This needs ZERO page
  //duplication — when a locale is translated, drop /<locale>/*.astro overrides
  //and flip its `translated` flag in lib/i18n.ts. `redirectToDefaultLocale:false`
  //keeps the root path canonical English (never a /en/ redirect).
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ru', 'fr', 'zh', 'sr', 'sv', 'no'],
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false,
      fallbackType: 'rewrite',
    },
    fallback: { ru: 'en', fr: 'en', zh: 'en', sr: 'en', sv: 'en', no: 'en' },
  },
  integrations: [react()],
  vite: {
    build: {
      //Recharts is heavy; let the per-island chunk carry it so SSG pages that
      //render no charts stay light.
      chunkSizeWarningLimit: 1200,
    },
  },
});
