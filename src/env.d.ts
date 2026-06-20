/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

//Build/runtime env contract. PUBLIC_* vars are injected by CI at BUILD time
//(never a committed .env.production — requirements §A.2). Astro exposes any
//PUBLIC_-prefixed var to client islands via import.meta.env. All values here are
//PUBLIC (API base, Matomo site id, AdSense publisher id) — never secrets.
interface ImportMetaEnv {
  //Base URL of the Rust/Axum JSON API (e.g. https://api.ranklock.app).
  readonly PUBLIC_API_BASE_URL?: string;
  //Base URL of the standalone Lane Lab service (ranklock-lane-lab; :8100 local). Lane Lab is its
  //OWN service, separate from the main API. Unset => falls back to PUBLIC_API_BASE_URL.
  readonly PUBLIC_LANE_LAB_BASE_URL?: string;
  //Self-hosted Matomo base URL.
  readonly PUBLIC_MATOMO_URL?: string;
  //RankLock's Matomo site id.
  readonly PUBLIC_MATOMO_SITE_ID?: string;
  //Google AdSense publisher id (ca-pub-…).
  readonly PUBLIC_ADSENSE_CLIENT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
