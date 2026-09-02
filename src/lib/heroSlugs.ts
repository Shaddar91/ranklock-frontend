//Hero URL identity: the slug rule applied to the API's hero_name, plus the pinned
//id->slug table the numeric-URL 301s are generated from. A pinned hero whose live
//slug drifts fails the build, because its 301 would then point at a 404.
import { DEFAULT_LOCALE, LOCALES } from './i18n';
import type { RosterRow } from './heroRoster';

export interface HeroIdentity {
  hero_id: number;
  hero_name: string;
  slug: string;
}

export const heroSlug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const heroPath = (name: string): string => `/heroes/${heroSlug(name)}/`;

//The released roster as served when hero URLs moved from /heroes/<id>/ to
///heroes/<slug>/. Rows are retained indefinitely: the 301s they generate are permanent.
const PINNED: readonly [number, string][] = [
  [1, 'Infernus'], [2, 'Seven'], [3, 'Vindicta'], [4, 'Lady Geist'], [6, 'Abrams'],
  [7, 'Wraith'], [8, 'McGinnis'], [10, 'Paradox'], [11, 'Dynamo'], [12, 'Kelvin'],
  [13, 'Haze'], [14, 'Holliday'], [15, 'Bebop'], [16, 'Calico'], [17, 'Grey Talon'],
  [18, 'Mo & Krill'], [19, 'Shiv'], [20, 'Ivy'], [25, 'Warden'], [27, 'Yamato'],
  [31, 'Lash'], [35, 'Viscous'], [50, 'Pocket'], [52, 'Mirage'], [58, 'Vyper'],
  [60, 'Sinclair'], [63, 'Mina'], [64, 'Drifter'], [65, 'Venator'], [66, 'Victor'],
  [67, 'Paige'], [69, 'The Doorman'], [72, 'Billy'], [76, 'Graves'], [77, 'Apollo'],
  [79, 'Rem'], [80, 'Silver'], [81, 'Celeste'],
];

export const HERO_IDENTITY: readonly HeroIdentity[] = PINNED.map(([hero_id, hero_name]) => ({
  hero_id,
  hero_name,
  slug: heroSlug(hero_name),
}));

const BY_ID = new Map(HERO_IDENTITY.map((h) => [h.hero_id, h]));
const BY_SLUG = new Map(HERO_IDENTITY.map((h) => [h.slug, h]));

export const slugOf = (hero_id: number): string | null => BY_ID.get(hero_id)?.slug ?? null;
export const idOf = (slug: string): number | null => BY_SLUG.get(slug)?.hero_id ?? null;

//`redirects` for astro.config.mjs: every pinned numeric hero URL 301s to its slug, at the apex
//and under each locale prefix, because Astro's i18n fallback served numeric URLs there too.
const URL_PREFIXES = ['', ...LOCALES.filter((l) => l.code !== DEFAULT_LOCALE).map((l) => `/${l.code}`)];

export const HERO_ID_REDIRECTS: Record<string, { status: 301; destination: string }> = Object.fromEntries(
  URL_PREFIXES.flatMap((prefix) =>
    HERO_IDENTITY.map((h) => [
      `${prefix}/heroes/${h.hero_id}`,
      { status: 301 as const, destination: `${prefix}/heroes/${h.slug}/` },
    ]),
  ),
);

//Attach a slug to every roster row; a build refuses an empty slug, a collision, or a
//pinned hero renamed out from under its 301. Dev warns and drops the offending rows.
export function slugRoster<T extends RosterRow>(
  heroes: T[],
  where: string,
  strict: boolean = import.meta.env.PROD,
): (T & { slug: string })[] {
  const rows = heroes.map((h) => ({ ...h, slug: heroSlug(h.hero_name) }));
  const problems: string[] = [];
  const firstBySlug = new Map<string, number>();
  const bad = new Set<number>();
  for (const r of rows) {
    if (r.slug === '') {
      problems.push(`${r.hero_id} "${r.hero_name}" slugs to the empty string`);
      bad.add(r.hero_id);
      continue;
    }
    const first = firstBySlug.get(r.slug);
    if (first != null) {
      problems.push(`slug "${r.slug}" collides between hero ${first} and hero ${r.hero_id}`);
      bad.add(r.hero_id);
    } else {
      firstBySlug.set(r.slug, r.hero_id);
    }
    const pinned = slugOf(r.hero_id);
    if (pinned !== null && pinned !== r.slug) {
      problems.push(
        `hero ${r.hero_id} is now "${r.hero_name}" (slug "${r.slug}") but /heroes/${r.hero_id}/ redirects to /heroes/${pinned}/`,
      );
      bad.add(r.hero_id);
    }
  }
  if (problems.length === 0) return rows;
  const detail = problems.join('; ');
  if (strict) throw new Error(`[hero-slug guard] ${where}: ${detail}. Update src/lib/heroSlugs.ts before shipping.`);
  console.warn(`[hero-slug guard] ${where}: ${detail}`);
  return rows.filter((r) => !bad.has(r.hero_id));
}
