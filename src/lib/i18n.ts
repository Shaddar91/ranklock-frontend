//============================================================================
//i18n single source of truth (C7).
//
//Locale set + path-prefix helpers for the cross-cutting SEO layer: <html lang>,
//hreflang alternates, the curated sitemap, and the untranslated-locale
//noindex/canonical policy. URL strategy (authoritative design:
//frontend-i18n-design.md, Decision 1): path-prefix locales with English at the
//ROOT (no prefix) — /heroes = en, /ru/heroes = Russian, /sr/leaderboard =
//Serbian. The locale CODES here MUST stay in sync with astro.config.mjs's
//`i18n.locales`; this module is the source of truth for everything downstream
//(Seo.astro, BaseLayout.astro, sitemap.xml.ts, robots.txt.ts).
//
//Interim translation state: only `en` is `translated`. The 6 launched non-en
//locales exist as routes (Astro generates them via `fallbackType: 'rewrite'` —
//they SERVE the English page, not a redirect) but are marked noindex +
//canonical→English so the duplicate English content never dilutes the en
//ranking (requirements §8.2). hreflang advertises ONLY translated locales —
//advertising a noindex alternate is an SEO error ("no return tags"). When a
//locale's real translations land, flip its `translated` flag to true: it then
//drops noindex, becomes self-canonical, joins the hreflang cluster, and enters
//the sitemap — all automatically, with no other edits.
//============================================================================

export interface LocaleDef {
  //URL/runtime code; also the `/<code>/…` path segment for non-default locales.
  code: string;
  //BCP-47 tag emitted in <html lang> and hreflang. Kept == code per the design
  //doc's contract; bump zh→'zh-Hans' / sr→'sr-Latn' here if finer search
  //targeting is ever wanted (the URL prefix stays the bare code).
  hreflang: string;
  //Native-name label for a future <LocaleSwitcher> (not built in C7).
  label: string;
  //True once real translations exist. Gates indexability, self-canonical,
  //hreflang-cluster membership, and sitemap inclusion for the locale.
  translated: boolean;
}

export const DEFAULT_LOCALE = 'en';

//The 7 launched locales (design doc: en + ru/fr/zh/sr/sv/no). Hindi (`hi`) is a
//documented future scaffold in the design doc — intentionally NOT launched here
//(kept out of validation + output until its translations exist).
export const LOCALES: readonly LocaleDef[] = [
  { code: 'en', hreflang: 'en', label: 'English', translated: true },
  { code: 'ru', hreflang: 'ru', label: 'Русский', translated: false },
  { code: 'fr', hreflang: 'fr', label: 'Français', translated: false },
  { code: 'zh', hreflang: 'zh', label: '中文', translated: false },
  { code: 'sr', hreflang: 'sr', label: 'Srpski', translated: false },
  { code: 'sv', hreflang: 'sv', label: 'Svenska', translated: false },
  { code: 'no', hreflang: 'no', label: 'Norsk', translated: false },
];

//Locales with real translations (currently just en). Drives hreflang + sitemap.
export const TRANSLATED_LOCALES: readonly LocaleDef[] = LOCALES.filter((l) => l.translated);

const BY_CODE = new Map(LOCALES.map((l) => [l.code, l]));
//Non-default prefix segments, used to detect + strip a leading locale prefix.
const PREFIX_CODES = LOCALES.filter((l) => l.code !== DEFAULT_LOCALE).map((l) => l.code);

/** Resolve a (possibly undefined) `Astro.currentLocale` to a LocaleDef, defaulting to en. */
export function resolveLocale(code: string | undefined): LocaleDef {
  return (code != null && BY_CODE.get(code)) || BY_CODE.get(DEFAULT_LOCALE)!;
}

/** True for the default (English, no-prefix) locale — including an undefined locale. */
export function isDefaultLocale(code: string | undefined): boolean {
  return (code ?? DEFAULT_LOCALE) === DEFAULT_LOCALE;
}

/**
 * Strip a leading `/<locale>/` prefix, returning the canonical English (no-prefix)
 * path. "/ru/heroes" → "/heroes", "/ru" or "/ru/" → "/", "/heroes" → "/heroes".
 * Always returns a leading-slash path. (Route first-segments — heroes, items,
 * blog, players, matches, leaderboard, privacy — never collide with locale codes.)
 */
export function stripLocalePrefix(pathname: string): string {
  const segs = pathname.split('/').filter(Boolean);
  const first = segs[0];
  if (first !== undefined && PREFIX_CODES.includes(first)) {
    const rest = segs.slice(1).join('/');
    return rest ? `/${rest}` : '/';
  }
  if (!pathname.startsWith('/')) return `/${pathname}`;
  return pathname || '/';
}

/**
 * Build the locale-prefixed path for a logical (de-localized) path. English (the
 * default) has no prefix. localePath('en', '/heroes') → '/heroes';
 * localePath('ru', '/heroes') → '/ru/heroes'; localePath('ru', '/') → '/ru/'.
 */
export function localePath(code: string, logicalPath: string): string {
  const clean = logicalPath.startsWith('/') ? logicalPath : `/${logicalPath}`;
  if (code === DEFAULT_LOCALE) return clean;
  return clean === '/' ? `/${code}/` : `/${code}${clean}`;
}

export interface Alternate {
  hreflang: string;
  //Locale-prefixed, site-relative path (e.g. '/heroes' or '/ru/heroes').
  path: string;
}

/**
 * hreflang alternates for a logical path: one per TRANSLATED locale plus an
 * `x-default` pointing at the English (no-prefix) URL. Untranslated locales are
 * deliberately omitted — they are noindex, and advertising a noindex alternate
 * is an SEO error. Currently yields [x-default→en, en→en]; each newly-translated
 * locale appears here automatically once its `translated` flag flips.
 */
export function hreflangAlternates(logicalPath: string): Alternate[] {
  const en = stripLocalePrefix(logicalPath);
  const alts: Alternate[] = [{ hreflang: 'x-default', path: localePath(DEFAULT_LOCALE, en) }];
  for (const l of TRANSLATED_LOCALES) {
    alts.push({ hreflang: l.hreflang, path: localePath(l.code, en) });
  }
  return alts;
}
