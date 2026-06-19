//============================================================================
//SEO constants + JSON-LD helpers for the prerendered surface (C4).
//
//C4 owns the PER-ROUTE meta layer (title/description/canonical/OpenGraph/
//Twitter/JSON-LD), rendered by components/Seo.astro via BaseLayout props. The
//cross-cutting SEO INFRA (sitemap, robots, hreflang, untranslated-locale
//noindex across the 7 locales) is C7 — this module deliberately stops at the
//per-route layer and leaves the locale/hreflang seam to C7.
//============================================================================

export const SITE_NAME = 'RankLock';
//Canonical production origin. `Astro.site` (astro.config.mjs) is the source of
//truth for absolute URLs; this mirrors it for use outside an Astro context.
export const SITE_ORIGIN = 'https://ranklock.app';
export const SITE_TAGLINE = 'Deadlock stats, guides & coaching';
export const DEFAULT_DESCRIPTION =
  'Deadlock hero & item win-rates by rank, player profiles, match deep-dives, and a per-player coaching layer that updates every patch.';

//Twitter/X handle for the `twitter:site` card attribution. Placeholder until a
//real handle exists — public, not a secret.
export const TWITTER_HANDLE = '@ranklock';

//Generic OpenGraph share image. PLACEHOLDER: the branded default OG asset and
//the per-match dynamic OG card are a SEPARATE pulsar plan (ranklock-og-card-*,
//requirements §9.1). Until that ships, share cards point here; swap the asset
//(or the per-match URL) when the OG service lands. Documented integration point.
export const DEFAULT_OG_IMAGE = '/og/ranklock-default.png';

//---- JSON-LD builders -------------------------------------------------------
//Typed loosely as Record<string, unknown> — JSON-LD is free-form schema.org.

type Json = Record<string, unknown>;

/** schema.org Organization for the publisher (used on the home page). */
export function orgJsonLd(origin: string): Json {
  return {
    '@type': 'Organization',
    name: SITE_NAME,
    url: origin,
    logo: `${origin}/favicon.svg`,
  };
}

/**
 * schema.org WebSite + the sitelinks SearchAction box. `searchTemplate` is the
 * URL pattern the player search resolves to (CSR — /players/{id}).
 */
export function websiteJsonLd(origin: string): Json {
  return {
    '@type': 'WebSite',
    name: SITE_NAME,
    url: origin,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${origin}/players/{search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/** A BreadcrumbList from [{name, path}] items; paths are made absolute. */
export function breadcrumbJsonLd(origin: string, crumbs: { name: string; path: string }[]): Json {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: new URL(c.path, origin).toString(),
    })),
  };
}

/** A simple ItemList (e.g. the heroes meta table) of named entities. */
export function itemListJsonLd(name: string, names: string[]): Json {
  return {
    '@type': 'ItemList',
    name,
    numberOfItems: names.length,
    itemListElement: names.map((n, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: n,
    })),
  };
}
