//The published-guide surfaces shared by every page that links to /heroes/<slug>/guide/ — the
//same predicate the routes mint from, so a link never promises a page that does not exist.
import { getCollection } from 'astro:content';
import { compareGuideIds, guidePath, parseGuideId, type PublishedGuide } from './guideIds';

export { guidePath, parseGuideId };
export type { PublishedGuide };

//Canonical-only: a `--` archetype id never mints a chip for a hero whose canonical guide is missing.
export const publishedGuideSlugs = async (): Promise<Set<string>> =>
  new Set(
    (await getCollection('guides', ({ data }) => !data.draft))
      .filter((guide) => !guide.id.includes('--'))
      .map((guide) => guide.id),
  );

export const publishedGuides = async (): Promise<Map<string, PublishedGuide[]>> => {
  const guides = (await getCollection('guides', ({ data }) => !data.draft))
    .slice()
    .sort((a, b) => compareGuideIds(a.id, b.id));
  const byHero = new Map<string, PublishedGuide[]>();
  for (const guide of guides) {
    const { slug, token } = parseGuideId(guide.id);
    const list = byHero.get(slug) ?? [];
    list.push({ id: guide.id, token, path: guidePath(guide.id), title: guide.data.title });
    byHero.set(slug, list);
  }
  return byHero;
};
