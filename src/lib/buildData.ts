//============================================================================
//Build-time data helper (C4, build-ahead — requirements §8.1).
//
//SEO routes fetch their rows at BUILD time from PUBLIC_API_BASE_URL and bake
//them into static HTML. The backend/data pipeline is still coming online, so a
//build-time fetch may hang, 404, 501, or 5xx. `buildFetch` wraps any API
//promise with a timeout + a guaranteed fallback so a slow/absent origin NEVER
//hangs or fails the build — the page just prerenders its empty/"loading" state.
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
