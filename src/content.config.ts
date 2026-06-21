//Astro Content Layer config (C4) — the blog/guides collection that powers the
//icy-veins-style SEO surface (/blog + /blog/:slug). Markdown lives under
//src/content/blog/; the glob loader keys each entry by its filename slug.
//
//NOTE: the canonical repo .gitignore ignores all *.md — the per-repo section
//negates src/content/blog/** so these guides DO commit (they are user-facing
//site content, not operator analysis).
import { defineCollection } from 'astro:content';
import { z } from 'astro:schema';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.string().default('RankLock'),
    //optional hero this guide centers on (links back to /heroes/:slug context).
    heroSlug: z.string().optional(),
    //optional hero/social image (path under /public or absolute URL) for OG cards.
    heroImage: z.string().optional(),
    tags: z.array(z.string()).default([]),
    //hero/item names whose LIVE win-rates the guide embeds (GuideLiveStats).
    liveHeroes: z.array(z.string()).default([]),
    liveItems: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
