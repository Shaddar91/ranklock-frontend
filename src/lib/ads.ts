//Google AdSense loader + Consent Mode v2 baseline. The adsbygoogle.js script
//carries Google's certified CMP, which owns EEA/UK/CH ads consent gathering and
//writes the Consent Mode ad signals — this module never gates on the site banner.

declare global {
  interface Window {
    dataLayer?: unknown[];
    adsbygoogle?: unknown[];
  }
}

const ADSENSE_CLIENT = import.meta.env.PUBLIC_ADSENSE_CLIENT ?? '';

export function adsenseClient(): string {
  return ADSENSE_CLIENT;
}

export function adsenseConfigured(): boolean {
  return /^ca-pub-\d{10,}$/.test(ADSENSE_CLIENT);
}

//gtag consumes dataLayer entries by numeric index; a plain array carries the
//same positional shape as the canonical `arguments` push.
function gtagPush(args: unknown[]): void {
  if (typeof window === 'undefined') return;
  (window.dataLayer = window.dataLayer || []).push(args);
}

let defaultSet = false;
//Denied baseline declared before any Google tag can load; Google's CMP
//overwrites it with the visitor's choice. analytics_storage stays denied:
//RankLock analytics is first-party Matomo, so Google never gets that signal.
export function setAdConsentDefault(): void {
  if (typeof window === 'undefined' || defaultSet) return;
  gtagPush([
    'consent',
    'default',
    {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
      wait_for_update: 500,
    },
  ]);
  defaultSet = true;
}

let scriptLoaded = false;
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

export function enableAds(): boolean {
  return loadAdSense();
}

export function pushAd(): void {
  if (typeof window === 'undefined') return;
  try {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  } catch {
    //already filled or loader still in flight; a later mount retries.
  }
}
