//The published-guide slug set, shared by every surface that links to /heroes/<slug>/guide/.
//Same predicate heroes/[slug]/guide.astro mints its paths from, so a link can never promise a
//guide page that does not exist ("omit, never promise").
import { getCollection } from 'astro:content';

export const publishedGuideSlugs = async (): Promise<Set<string>> =>
  new Set((await getCollection('guides', ({ data }) => !data.draft)).map((guide) => guide.id));
