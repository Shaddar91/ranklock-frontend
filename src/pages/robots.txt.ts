import type { APIRoute } from 'astro';
import { SITE_ORIGIN } from '../lib/seo';

//robots.txt (C7). Crawlable by default and references the curated sitemap. The
//per-entity CSR shells (/players/:id, /matches/:id) and the noindex/canonical→en
//localized trees are kept out of the index via per-page <meta name="robots"> +
//<link rel="canonical"> (Seo.astro) — NOT via Disallow, because a Disallow would
//stop crawlers from ever seeing those directives. Only the dev/demo surface is
//disallowed outright. Generated at BUILD (prerender).
export const prerender = true;

export const GET: APIRoute = () => {
  const body = `User-agent: *
Allow: /

# Dev/demo surface — never indexed.
Disallow: /styleguide

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
