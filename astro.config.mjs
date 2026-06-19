import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

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
//The @astrojs/cloudflare adapter IS installed (package.json, BOM §9) but is
//deliberately NOT wired here: it is only needed if/when the optional per-match
//OG-card route (`matches/:id`, prerender=false) is built — and that route is a
//SEPARATE pulsar plan (ranklock-og-card-*). This build stays 100% static. To
//enable that one route later, keep `output: 'static'` and add the adapter:
//   import cloudflare from '@astrojs/cloudflare';
//   adapter: cloudflare(),   // only the prerender=false route runs on a Worker
//
//PUBLIC_* env vars are exposed to client islands via Astro's default Vite
//envPrefix and are injected at BUILD time by CI (never a committed
//.env.production — requirements §A.2). See README "Environment variables".
export default defineConfig({
  site: 'https://ranklock.app',
  output: 'static',
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
