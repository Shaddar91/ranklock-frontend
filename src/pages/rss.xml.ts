import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SITE_NAME } from '../lib/seo';

//RSS 2.0 feed for the blog/guides collection (C4 SEO surface). The static
//autodiscovery feed linked from every page's <head> (Seo.astro). Mirrors the
///blog index: non-draft posts, newest first, English (the canonical locale).
//Generated at BUILD (prerender) → dist/rss.xml, like the sibling sitemap.xml.ts
//and robots.txt.ts endpoints. `context.site` is the configured Astro.site
//(astro.config.mjs = https://ranklock.app), so the relative /blog/<slug> item
//links resolve to absolute canonical URLs in the feed.
export const prerender = true;

export const GET: APIRoute = async (context) => {
  const posts = (await getCollection('blog', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime(),
  );

  return rss({
    title: `${SITE_NAME} — Guides`,
    description:
      'Deadlock hero guides, item builds and fundamentals from RankLock, with each post\'s key win-rates pulled live from the current patch.',
    //Absolute-URL base for the item links; set in astro.config.mjs.
    site: context.site ?? 'https://ranklock.app',
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      //relative → resolved to https://ranklock.app/blog/<slug> against `site`.
      link: `/blog/${post.id}/`,
      author: post.data.author,
      categories: post.data.tags,
    })),
    customData: '<language>en-us</language>',
  });
};
