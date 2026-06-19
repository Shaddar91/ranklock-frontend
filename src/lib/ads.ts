//============================================================================
//Google AdSense + Consent Mode v2 plumbing (requirements §8.3, action item 3).
//
//The ad fill loads ONLY after the visitor grants the "ads/marketing" consent
//category (lib/consent). A denied / undecided visitor never triggers an AdSense
//network call — AdSlot shows the gaslamp placeholder instead. This is the
//strict reading of the success criterion "rejecting suppresses both" (Matomo AND
//AdSense): no non-personalized fallback fill on denial, because that would still
//be an AdSense request after a reject.
//
//Consent Mode v2 is the correctness layer on top: a denied baseline is declared
//up-front (by TrackingProvider) and updated to granted here, so Google's tag
//operates under an explicit, auditable consent signal once it does load.
//
//The publisher id (ca-pub-…) is PUBLIC, injected from build env — never hardcoded
//or committed.
//============================================================================

declare global {
  interface Window {
    //Google Consent Mode / gtag data layer.
    dataLayer?: unknown[];
    //AdSense fill queue.
    adsbygoogle?: unknown[];
  }
}

const ADSENSE_CLIENT = import.meta.env.PUBLIC_ADSENSE_CLIENT ?? '';

export function adsenseClient(): string {
  return ADSENSE_CLIENT;
}

//Only treat AdSense as available when a well-formed publisher id is configured.
export function adsenseConfigured(): boolean {
  return /^ca-pub-\d{10,}$/.test(ADSENSE_CLIENT);
}

//gtag.js consumes dataLayer entries by numeric index; a plain array carries the
//same positional shape as the canonical `arguments` push, so this is equivalent
//for Consent Mode commands and keeps the code free of `arguments`.
function gtagPush(args: unknown[]): void {
  if (typeof window === 'undefined') return;
  (window.dataLayer = window.dataLayer || []).push(args);
}

let defaultSet = false;
//Declare a denied baseline for every Google consent signal, as early as possible
//(before any Google tag can load). Idempotent.
export function setAdConsentDefault(): void {
  if (typeof window === 'undefined' || defaultSet) return;
  gtagPush([
    'consent',
    'default',
    {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      //analytics_storage stays denied: RankLock's analytics is first-party
      //Matomo, not a Google product, so Google never gets an analytics signal.
      analytics_storage: 'denied',
      wait_for_update: 500,
    },
  ]);
  defaultSet = true;
}

//Flip the ad-related Google consent signals to match the user's ads choice.
export function updateAdConsent(granted: boolean): void {
  const v = granted ? 'granted' : 'denied';
  gtagPush([
    'consent',
    'update',
    { ad_storage: v, ad_user_data: v, ad_personalization: v },
  ]);
}

let scriptLoaded = false;
//Inject the AdSense loader exactly once. Caller MUST have verified ads consent.
//Returns false (no-op) when AdSense isn't configured.
export function loadAdSense(): boolean {
  if (typeof window === 'undefined' || !adsenseConfigured()) return false;
  if (scriptLoaded) return true;
  const base = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
  if (document.querySelector(`script[src^="${base}"]`)) {
    scriptLoaded = true;
    return true;
  }
  const s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `${base}?client=${ADSENSE_CLIENT}`;
  document.head.appendChild(s);
  scriptLoaded = true;
  return true;
}

//Convenience for AdSlot: grant the ad consent signal then load the script.
export function enableAds(): boolean {
  if (!adsenseConfigured()) return false;
  updateAdConsent(true);
  return loadAdSense();
}

//Request a fill for a mounted <ins class="adsbygoogle">.
export function pushAd(): void {
  if (typeof window === 'undefined') return;
  try {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  } catch {
    //adsbygoogle throws if the slot is already filled or the loader is still
    //in flight; a later mount / consent-change retries.
  }
}
