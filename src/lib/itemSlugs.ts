//Item URL identity: the slug rule applied to the catalog's item name, the id->slug map every
//item link and numeric-URL 301 is generated from, and the pinned table that splits shared names.
import { DEFAULT_LOCALE, LOCALES } from './i18n.ts';
import catalog from '../data/items-detail.json' with { type: 'json' };

export const itemSlug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

//Pinned slug per item id, the one place a name collision is resolved; 3133167885 is the instant-cast Silencer.
export const ITEM_SLUG_OVERRIDES: Readonly<Record<number, string>> = {
  3133167885: 'silencer-active',
};

//Assign a slug to every catalog id. A build refuses an empty slug, a collision no override resolves,
//or an override that is not in slug form; dev warns and drops the offending ids instead.
export function slugCatalog(
  rows: Readonly<Record<string, { name: string }>>,
  overrides: Readonly<Record<number, string>>,
  where: string,
  strict: boolean = import.meta.env?.PROD === true,
): Record<number, string> {
  const slugs: Record<number, string> = {};
  const problems: string[] = [];
  const firstBySlug = new Map<string, number>();
  for (const [key, row] of Object.entries(rows)) {
    const id = Number(key);
    const pinned = overrides[id];
    const slug = pinned ?? itemSlug(row.name);
    if (pinned !== undefined && itemSlug(pinned) !== pinned) {
      problems.push(`override "${pinned}" for item ${id} is not in slug form (itemSlug gives "${itemSlug(pinned)}")`);
      continue;
    }
    if (slug === '') {
      problems.push(`${id} "${row.name}" slugs to the empty string`);
      continue;
    }
    const first = firstBySlug.get(slug);
    if (first != null) {
      problems.push(`slug "${slug}" collides between item ${first} and item ${id}; pin one in ITEM_SLUG_OVERRIDES`);
      continue;
    }
    firstBySlug.set(slug, id);
    slugs[id] = slug;
  }
  if (problems.length === 0) return slugs;
  const detail = problems.join('; ');
  if (strict) throw new Error(`[item-slug guard] ${where}: ${detail}. Update src/lib/itemSlugs.ts before shipping.`);
  console.warn(`[item-slug guard] ${where}: ${detail}`);
  return slugs;
}

export const ITEM_SLUGS: Record<number, string> = slugCatalog(catalog, ITEM_SLUG_OVERRIDES, 'src/data/items-detail.json');

const ID_BY_SLUG = new Map(Object.entries(ITEM_SLUGS).map(([id, slug]) => [slug, Number(id)]));

export const slugToItemId = (slug: string): number | null => ID_BY_SLUG.get(slug) ?? null;

export const itemPath = (id: number): string => `/items/${ITEM_SLUGS[id] ?? id}/`;

//`redirects` for astro.config.mjs: every numeric item URL 301s to its slug, at the apex and under each locale prefix.
const URL_PREFIXES = ['', ...LOCALES.filter((l) => l.code !== DEFAULT_LOCALE).map((l) => `/${l.code}`)];

export const ITEM_ID_REDIRECTS: Record<string, { status: 301; destination: string }> = Object.fromEntries(
  URL_PREFIXES.flatMap((prefix) =>
    Object.entries(ITEM_SLUGS).map(([id, slug]) => [
      `${prefix}/items/${id}`,
      { status: 301 as const, destination: `${prefix}/items/${slug}/` },
    ]),
  ),
);
