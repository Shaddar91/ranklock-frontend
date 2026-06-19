# ranklock-frontend

The RankLock web frontend — a **static-first Astro 6 app** (React 19 islands +
Recharts) for Deadlock stats, guides, and coaching. Deployed to **Cloudflare
static assets** with a **$0 baseline** (no Workers KV / R2 / D1 / Durable
Objects, no per-request edge SSR).

> Status: **scaffold** (branch `feat/astro-rebuild-v1`). The build is green and
> the rendering patterns + API client + type contract are in place; individual
> pages, the full design system, SEO infra, consent/ads, and donations are built
> in the follow-on components (C3–C10).

## Rendering model

| Surface | Routes | Strategy |
|---|---|---|
| SEO / reference | `/`, `heroes`, `items`, `leaderboard`, `blog` | **SSG** (prerendered), rebuilt ~each 6h batch |
| Per-user / per-match | `players/:id`, `matches/:id`, coaching, compare, improve | **CSR** React islands (`client:only`), served as static shells |
| Optional per-match OG | `matches/:id` head | **Not built here** — a separate plan; OG image served by `ranklock-dynamic`, $0 |

The frontend is a **pure HTTP/JSON client** to the Rust/Axum API — no DB, no BFF.
`output: 'static'` is a hard constraint (see `astro.config.mjs`).

## Stack

- **Astro 6** (`output: 'static'`) + **@astrojs/react** (React 19 islands)
- **Recharts** (radar / time-series / stacked-area), **@tanstack/react-query** in islands
- **qrcode.react** (crypto-donation QR, C8)
- **@astrojs/cloudflare** installed but NOT wired — reserved for the optional OG route only
- Vanilla CSS + CSS-variable theming (gaslamp / foundry / arcane), ported from the prototype in C3
- **Node ≥ 22.12.0** (Astro 6 requirement)

## Layout

```
src/
  pages/             file-based routes (SSG pages + CSR shells)
  layouts/           BaseLayout.astro (head/meta/theme bootstrap)
  components/react/  React islands (QueryProvider + feature islands)
  lib/apiClient.ts   typed fetch wrapper around the API (the single fetch surface)
  lib/queryClient.ts TanStack Query client (tuned to the 6h data cadence)
  types/api.ts       hand-written API types  (TODO: replace with ts-rs output)
  styles/global.css  base gaslamp tokens (full system ported in C3)
.github/workflows/deploy.yml   astro build -> wrangler deploy (+ data_version hook)
wrangler.toml        Cloudflare Workers Static Assets config (no KV/R2/D1/DO)
```

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Astro dev server |
| `npm run build` | `astro build` -> `./dist` |
| `npm run type-check` | `astro check` |
| `npm run lint` | ESLint (incl. the `client:*` island guard) |
| `npm run preview:cf` | `wrangler dev` — preview on Cloudflare's runtime |
| `npm run deploy` | `wrangler deploy` — upload `./dist` to Cloudflare static assets |

Requires Node ≥ 22.12.0 (`nvm use 22`).

## Environment variables

All are **PUBLIC** (no secrets) and injected at **build time** by CI — never
commit a `.env.production` (it bakes a fixed origin and breaks deploys). Astro
exposes any `PUBLIC_`-prefixed var to client islands.

| Var | Purpose | Required |
|---|---|---|
| `PUBLIC_API_BASE_URL` | API origin (defaults to the public prod API base) | recommended |
| `PUBLIC_MATOMO_URL` | Self-hosted Matomo base URL | when analytics ship (C6) |
| `PUBLIC_MATOMO_SITE_ID` | RankLock's Matomo site id | when analytics ship (C6) |
| `PUBLIC_ADSENSE_CLIENT` | AdSense publisher id (`ca-pub-…`) | when ads ship (C6) |

For local dev, copy the (gitignored) `.env.example` to `.env` and adjust.

## The `client:*` island guard

Astro's one silent-failure mode: a React component placed in a template **without
a `client:*` directive** renders inert (no hydration) with **no error**. The
ESLint config (`eslint.config.mjs`) ships a local rule
(`local/require-client-directive`) that flags any imported React island used in a
`.astro` file without a `client:*` directive — turning that silent failure into a
CI error (requirements §9). To see it fire: drop the `client:load` on
`src/pages/index.astro` and run `npm run lint`.

## CI/CD

`.github/workflows/deploy.yml` runs on the owner's **own** CI (Cloudflare's build
system is not used): `npm ci` -> lint -> type-check -> `astro build` -> upload
`dist/` via `wrangler`. A `repository_dispatch` of type `data_version` lets the
Kafka data pipeline POST a rebuild when fresh data lands (event-driven, ~$0). All
workflow inputs are variable-ized (`${{ secrets.* }}` / `${{ vars.* }}`).

## API types

`src/types/api.ts` is **hand-written** against the documented route list and the
backend response structs (the DTOs don't derive `ts_rs::TS` yet). When the Rust
side adds `#[derive(TS)]`, regenerate the file in CI and drop the hand-written
bodies (see the `ts-rs` step in the workflow).
