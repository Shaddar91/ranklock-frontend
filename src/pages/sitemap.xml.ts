import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { api } from '../lib/apiClient';
import { buildFetch } from '../lib/buildData';
import { SITE_ORIGIN } from '../lib/seo';
import { TRANSLATED_LOCALES, hreflangAlternates, pagePath } from '../lib/i18n';
import { releasedRoster } from '../lib/heroRoster';
import { slugRoster } from '../lib/heroSlugs';
import type { HeroSummary } from '../types/api';
import itemDetail from '../data/items-detail.json';

//Curated SEO sitemap (C7, requirements §7/§8.2). Lists ONLY the indexable English
//SEO surface + BOUNDED curated families of dynamic pages (the hero roster, the
//item catalog and the blog guides). It NEVER lists:
//  - the millions of /players/:id or 13.8M /matches/:id CSR shells (per-entity
//    data pages, noindex — listing them would be the explicit anti-goal);
//  - the noindex/canonical→en localized variants (/ru/…, /fr/… — only the en
//    canonical URLs belong in the sitemap until a locale is translated);
//  - the dev surfaces (/styleguide) or the cold-API hero placeholder.
//Generated at BUILD (prerender) and build-ahead: a cold stats API just yields the
//static routes (the heroes list comes back empty → no /heroes/:id entries), which
//is correct — the sitemap only advertises pages that actually have content.
export const prerender = true;

interface RouteEntry {
  //de-localized (English, no-prefix) path.
  path: string;
  changefreq?: string;
  priority?: string;
  lastmod?: string;
}

//The fixed English SEO surface. /matches is the indexable recent-matches INDEX
//(the per-match /matches/:id detail shells are excluded — they are noindex).
const STATIC_ROUTES: RouteEntry[] = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/heroes', changefreq: 'daily', priority: '0.9' },
  { path: '/items', changefreq: 'daily', priority: '0.8' },
  { path: '/leaderboard', changefreq: 'daily', priority: '0.8' },
  { path: '/matches', changefreq: 'hourly', priority: '0.7' },
  { path: '/patches', changefreq: 'daily', priority: '0.7' },
  { path: '/build-lab', changefreq: 'weekly', priority: '0.7' },
  { path: '/lane-lab', changefreq: 'weekly', priority: '0.7' },
  { path: '/blog', changefreq: 'weekly', priority: '0.7' },
  { path: '/faq', changefreq: 'monthly', priority: '0.4' },
  { path: '/methodology', changefreq: 'monthly', priority: '0.4' },
  { path: '/privacy', changefreq: 'monthly', priority: '0.3' },
  { path: '/about', changefreq: 'monthly', priority: '0.3' },
  { path: '/contact', changefreq: 'monthly', priority: '0.3' },
  { path: '/terms', changefreq: 'monthly', priority: '0.3' },
  { path: '/impressum', changefreq: 'monthly', priority: '0.3' },
];

//Advertise per-URL hreflang alternates only once ≥2 locales are actually
//translated (a self-only en cluster adds nothing). Flips on automatically when a
//locale's `translated` flag in lib/i18n.ts goes true.
const USE_ALTERNATES = TRANSLATED_LOCALES.length >= 2;

const escapeXml = (s: string): string =>
  s.replace(/[<>&'"]/g, (c) => `&${{ '<': 'lt', '>': 'gt', '&': 'amp', "'": 'apos', '"': 'quot' }[c]};`);

function urlBlock(entry: RouteEntry): string {
  const loc = escapeXml(`${SITE_ORIGIN}${pagePath(entry.path)}`);
  const lines = [`    <loc>${loc}</loc>`];
  if (entry.lastmod) lines.push(`    <lastmod>${entry.lastmod}</lastmod>`);
  if (entry.changefreq) lines.push(`    <changefreq>${entry.changefreq}</changefreq>`);
  if (entry.priority) lines.push(`    <priority>${entry.priority}</priority>`);
  if (USE_ALTERNATES) {
    for (const alt of hreflangAlternates(entry.path)) {
      const href = escapeXml(`${SITE_ORIGIN}${alt.path}`);
      lines.push(`    <xhtml:link rel="alternate" hreflang="${alt.hreflang}" href="${href}" />`);
    }
  }
  return `  <url>\n${lines.join('\n')}\n  </url>`;
}

export const GET: APIRoute = async () => {
  const routes: RouteEntry[] = [...STATIC_ROUTES];

  //Blog guides — bounded, real content; lastmod from front-matter dates.
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  for (const post of posts) {
    const last = (post.data.updatedDate ?? post.data.pubDate).toISOString().slice(0, 10);
    routes.push({ path: `/blog/${post.id}`, changefreq: 'monthly', priority: '0.6', lastmod: last });
  }

  //Hero roster — bounded curated subset (~22). Build-ahead: empty on a cold API,
  //so no hero pages are advertised until the stats API serves them.
  const heroes = releasedRoster(await buildFetch(api.getHeroes(), [] as HeroSummary[]), 'sitemap.xml');
  for (const h of slugRoster(heroes.filter((h) => h.hero_id != null), 'sitemap.xml')) {
    routes.push({ path: `/heroes/${h.slug}`, changefreq: 'weekly', priority: '0.7' });
  }

  //Item catalog — bounded family; same static source items/[id].astro builds its paths from.
  const itemIds = Object.keys(itemDetail as Record<string, unknown>)
    .map(Number)
    .filter((id) => Number.isFinite(id))
    .sort((a, b) => a - b);
  for (const id of itemIds) {
    routes.push({ path: `/items/${id}`, changefreq: 'weekly', priority: '0.6' });
  }

  const xmlnsAlt = USE_ALTERNATES ? ' xmlns:xhtml="http://www.w3.org/1999/xhtml"' : '';
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${xmlnsAlt}>\n` +
    routes.map(urlBlock).join('\n') +
    `\n</urlset>\n`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
