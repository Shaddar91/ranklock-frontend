//Guide id helpers: an id is `<slug>` (the canonical hero guide) or `<slug>--<token>` (an
//archetype sibling). Pure, no imports — vitest's node env cannot load the astro:content IO half.
export const BUILD_TOKENS = ['weapon', 'spirit', 'support', 'tank', 'hybrid'] as const;

export type BuildToken = (typeof BUILD_TOKENS)[number];

export const BUILD_DISPLAY: Record<BuildToken, string> = {
  weapon: 'Weapon',
  spirit: 'Spirit',
  support: 'Support',
  tank: 'Tank',
  hybrid: 'Hybrid',
};

export interface GuideIdParts {
  slug: string;
  token: string | null;
}

export interface PublishedGuide {
  id: string;
  token: string | null;
  path: string;
  title: string;
}

export function parseGuideId(id: string): GuideIdParts {
  const cut = id.indexOf('--');
  if (cut === -1) return { slug: id, token: null };
  return { slug: id.slice(0, cut), token: id.slice(cut + 2) };
}

//The ONE guide URL string: every route, the sitemap and the hub mint paths through here.
export function guidePath(id: string): string {
  const { slug, token } = parseGuideId(id);
  return token === null ? `/heroes/${slug}/guide/` : `/heroes/${slug}/guide/${token}/`;
}

//Canonical first, then archetype tokens in enum order (the stable vocabulary order, not alphabetical).
export function compareGuideIds(a: string, b: string): number {
  const ta = parseGuideId(a).token;
  const tb = parseGuideId(b).token;
  if (ta === null) return tb === null ? 0 : -1;
  if (tb === null) return 1;
  return BUILD_TOKENS.indexOf(ta as BuildToken) - BUILD_TOKENS.indexOf(tb as BuildToken);
}
