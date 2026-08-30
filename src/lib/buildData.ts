//============================================================================
//Build-time data helper (C4, build-ahead — requirements §8.1).
//
//SEO routes fetch their rows at BUILD time from PUBLIC_API_BASE_URL and bake
//them into static HTML. The backend/data pipeline is still coming online, so a
//build-time fetch may hang, 404, 501, or 5xx. `buildFetch` wraps any API
//promise with a timeout + a guaranteed fallback so a slow/absent origin NEVER
//hangs or fails the build — the page just prerenders its empty/"loading" state.
//`buildFetchNonEmpty` is the guarded variant for stat bakes where an empty
//fallback must FAIL the build instead of silently shipping empty pages.
//
//Used only in `.astro` frontmatter + getStaticPaths (build context). Client
//islands use TanStack Query (which has its own retry/error handling) instead.
//============================================================================

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Resolve `promise`, but fall back to `fallback` if it rejects OR does not
 * settle within `ms`. Never rejects. The losing promise's rejection is swallowed
 * so it can't surface as an unhandled rejection during the build.
 */
export async function buildFetch<T>(
  promise: Promise<T>,
  fallback: T,
  ms: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const guard = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  try {
    return await Promise.race([promise.catch(() => fallback), guard]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * `buildFetch`, but the empty fallback FAILS the build (bake-empty guard).
 *
 * The plain buildFetch fallback is right for pages that degrade gracefully, but
 * for the SSG stat bakes it has a silent failure mode: a cold/unreachable origin
 * at build time bakes `[]` and ships hundreds of prerendered pages with every
 * stat empty-stated — indistinguishable from a healthy deploy until a human
 * looks. This wrapper turns that into a hard build error so CI aborts BEFORE
 * deploying/purging and the last-good deploy stays live.
 *
 * Escape hatch for an intentional empty-stats build (e.g. bootstrapping before
 * the backend exists): ALLOW_EMPTY_STATS_BUILD=1.
 */
export async function buildFetchNonEmpty<T>(
  promise: Promise<T[]>,
  label: string,
  ms: number = DEFAULT_TIMEOUT_MS,
): Promise<T[]> {
  const rows = await buildFetch(promise, [] as T[], ms);
  //`process.env` is unavailable in the Cloudflare Worker prerender sandbox; fall
  //back to `import.meta.env` (Vite's server-context env, populated from .env).
  const allowEmpty =
    process.env.ALLOW_EMPTY_STATS_BUILD === '1' ||
    import.meta.env?.ALLOW_EMPTY_STATS_BUILD === '1';
  if (rows.length === 0 && !allowEmpty) {
    throw new Error(
      `[bake-empty guard] ${label} baked 0 rows — the origin was cold, slow (>${ms}ms) or erroring at build time. ` +
        `Refusing to ship empty prerendered pages over the last-good deploy. ` +
        `Set ALLOW_EMPTY_STATS_BUILD=1 to build empty on purpose.`,
    );
  }
  return rows;
}
