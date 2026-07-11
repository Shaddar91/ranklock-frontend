//Swappable asset base for the Deadlock game art (hero cards + backdrops, item /
//ability icons). Every art URL routes through resolveAsset() so the whole site
//can be cut over from the community deadlock-api CDN to our own copy on
//assets.ranklock.app (the Cloudflare R2 mirror) by flipping ONE env var.
//
//v1 DEFAULT = theirs. With PUBLIC_ASSETS_BASE unset the base IS the upstream
//host, so resolveAsset() is a byte-for-byte no-op and hotlinking the community
//CDN is unchanged. The cutover — once the R2 bucket + assets.ranklock.app are
//verified serving — is a single config flip, no code change:
//    PUBLIC_ASSETS_BASE=https://assets.ranklock.app
//Set it in CI (the GitHub Actions `PUBLIC_ASSETS_BASE` secret, wired into the
//build step) or a local .env, rebuild, done.
//
//Why a PREFIX rewrite, not just a host swap: the R2 mirror
//(design/assets/mirror_assets.py `rel_path`, which does url.split("/images/")[-1])
//keys objects WITHOUT the `assets-api-res/images/` path segment — e.g.
//  https://assets-bucket.deadlock-api.com/assets-api-res/images/heroes/backgrounds/haze_bg.png
//is mirrored to R2 key `heroes/backgrounds/haze_bg.png`, served at
//  https://assets.ranklock.app/heroes/backgrounds/haze_bg.png
//So resolveAsset() replaces the whole upstream image prefix with `<base>/`.
//
//Rank emblems (lib/ranks.ts `rankImg`) are app-owned assets already bundled
//under public/assets/ranks/ — they are NOT hotlinked and deliberately stay out
//of this indirection.

//The community image CDN we hotlink by default (the image BUCKET host — not the
//metadata API host assets.deadlock-api.com). Kept as the default base so v1 is
//identical until the flip.
export const DEADLOCK_ASSETS_HOST = 'https://assets-bucket.deadlock-api.com';

//Full upstream prefix for hotlinked images. Everything AFTER this maps 1:1 onto
//the R2 key space (see rel_path above).
const UPSTREAM_IMAGE_PREFIX = `${DEADLOCK_ASSETS_HOST}/assets-api-res/images/`;

//Pure prefix-rewrite core (env-independent so it is unit-testable without the
//build-time env). base falsy/empty OR still the upstream host => no-op. An
//upstream image URL gets its prefix swapped for `<base>/`; anything else
//(already-relative, foreign host, nullish) is returned untouched so the GameIcon
//monogram fallback still fires on a genuinely missing/foreign asset.
export function rewriteAssetUrl(url: string | null | undefined, base?: string): string | null | undefined {
  const b = (base || DEADLOCK_ASSETS_HOST).replace(/\/+$/, '');
  if (!url || b === DEADLOCK_ASSETS_HOST) return url;
  if (url.startsWith(UPSTREAM_IMAGE_PREFIX)) {
    return `${b}/${url.slice(UPSTREAM_IMAGE_PREFIX.length)}`;
  }
  return url;
}

//The active asset base, baked at build time from PUBLIC_ASSETS_BASE. Defaults to
//theirs so behaviour is identical until the flip; trailing slash trimmed.
export const ASSETS_BASE = (import.meta.env.PUBLIC_ASSETS_BASE || DEADLOCK_ASSETS_HOST).replace(/\/+$/, '');

//App-facing resolver: route an asset URL (or path) through the active base.
//Overloaded so a definite-string caller (heroBackdrop) gets `string` back while
//a nullable caller (an API icon_url) keeps its exact nullability.
export function resolveAsset(url: string): string;
export function resolveAsset(url: string | null): string | null;
export function resolveAsset(url: string | null | undefined): string | null | undefined;
export function resolveAsset(url: string | null | undefined): string | null | undefined {
  return rewriteAssetUrl(url, ASSETS_BASE);
}
