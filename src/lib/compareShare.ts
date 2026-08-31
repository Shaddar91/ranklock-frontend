//Canonical /compare/{me}/{vs} share URL + the pair reader for the compare shell.
import { SITE_ORIGIN } from './seo';

export function compareSharePath(me: number, vs: number): string {
  return `/compare/${me}/${vs}/`;
}

export function compareShareUrl(me: number, vs: number): string {
  return `${SITE_ORIGIN}${compareSharePath(me, vs)}`;
}

//readNumericId's tolerance (locale prefix, trailing junk); both ids must be positive ints.
export function readComparePair(pathname: string): { a: number; b: number } | null {
  const m = pathname.match(/\/compare\/([^/?#]+)\/([^/?#]+)/);
  if (!m || m[1] == null || m[2] == null) return null;
  const a = Number(decodeURIComponent(m[1]));
  const b = Number(decodeURIComponent(m[2]));
  const ok = (n: number) => Number.isFinite(n) && Number.isInteger(n) && n > 0;
  return ok(a) && ok(b) ? { a, b } : null;
}
