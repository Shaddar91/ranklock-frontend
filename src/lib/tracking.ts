//============================================================================
//Consent-gated Matomo wrapper. A TS port of cloud-lord's `src/lib/tracking.js`
//(`window._paq` command queue) plus the two things its original lacked: a
//consent-gated loader and SPA route-change pageviews (requirements §8.3).
//
//Config is read from PUBLIC_* build env — NEVER hardcoded (cloud-lord hardcoded
//its tracker URL + site id; requirements forbid that here). When either value is
//absent the tracker is an inert no-op, so a build without analytics env still
//works (the current .env has them blank until the operator wires Matomo).
//
//Commands pushed onto `_paq` before matomo.js loads are queued by Matomo and
//flushed the instant the tracker initializes — so the ordering here is safe.
//============================================================================

declare global {
  interface Window {
    //Matomo command queue (array of command arrays).
    _paq?: unknown[][];
  }
}

const MATOMO_URL = import.meta.env.PUBLIC_MATOMO_URL?.replace(/\/+$/, '') ?? '';
const SITE_ID = import.meta.env.PUBLIC_MATOMO_SITE_ID ?? '';

export function matomoConfigured(): boolean {
  return MATOMO_URL !== '' && SITE_ID !== '';
}

function paq(): unknown[][] {
  window._paq = window._paq || [];
  return window._paq;
}

export function push(cmd: unknown[]): void {
  if (typeof window === 'undefined') return;
  paq().push(cmd);
}

//Interaction / conversion events (mirrors cloud-lord's API; kept for callers).
export function track(category: string, action: string, name?: string, value?: number): void {
  push(['trackEvent', category, action, name, value].filter((x) => x !== undefined));
}
export function trackGoal(goalId: number, value?: number): void {
  push(['trackGoal', goalId, value].filter((x) => x !== undefined));
}

let initialized = false;
let scriptInjected = false;
let lastUrl = '';

//Initialize the tracker with consent REQUIRED, grant consent, fire the initial
//pageview, then inject matomo.js. Idempotent: safe to call on mount AND again
//when consent later flips to granted (config is pushed once; the pageview +
//rememberConsentGiven are cheap to repeat).
export function enableMatomo(): void {
  if (typeof window === 'undefined' || !matomoConfigured()) return;
  if (!initialized) {
    push(['requireConsent']);
    push(['setTrackerUrl', `${MATOMO_URL}/matomo.php`]);
    push(['setSiteId', SITE_ID]);
    push(['enableLinkTracking']);
    initialized = true;
  }
  push(['rememberConsentGiven']);
  const url = currentUrl();
  push(['setCustomUrl', url]);
  push(['trackPageView']);
  lastUrl = url;
  injectScript();
}

//Consent withdrawn — Matomo stops setting cookies / tracking immediately. The
//already-injected script stays (Matomo handles the live revocation in-page).
export function disableMatomo(): void {
  if (typeof window === 'undefined' || !initialized) return;
  push(['forgetConsentGiven']);
}

//Emit a pageview for a client-side route change (Astro view transitions, island
//History pushes). No-op until the tracker is initialized + consented. Sets the
//referrer to the previous URL so Matomo attributes the navigation correctly, and
//re-enables link tracking for the freshly-swapped DOM.
export function trackRouteChange(): void {
  if (typeof window === 'undefined' || !initialized) return;
  const url = currentUrl();
  if (url === lastUrl) return;
  push(['setReferrerUrl', lastUrl]);
  push(['setCustomUrl', url]);
  push(['setDocumentTitle', document.title]);
  push(['trackPageView']);
  push(['enableLinkTracking']);
  lastUrl = url;
}

function injectScript(): void {
  if (scriptInjected) return;
  const src = `${MATOMO_URL}/matomo.js`;
  if (document.querySelector(`script[src="${src}"]`)) {
    scriptInjected = true;
    return;
  }
  const s = document.createElement('script');
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
  scriptInjected = true;
}

function currentUrl(): string {
  return window.location.href;
}
