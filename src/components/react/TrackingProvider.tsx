//Global, consent-gated analytics provider — mounted once in BaseLayout via
//client:load; renders nothing. Declares the Consent Mode v2 denied baseline
//before any Google tag, boots Matomo only on a stored/live analytics grant, and
//emits SPA route-change pageviews. Ad consent signals are written by Google's
//CMP, never from the site banner.
import { useEffect } from 'react';
import { getConsent, onConsentChange } from '../../lib/consent';
import { enableMatomo, disableMatomo, trackRouteChange } from '../../lib/tracking';
import { setAdConsentDefault } from '../../lib/ads';

const LOCATION_EVENT = 'ranklock:locationchange';

export default function TrackingProvider() {
  useEffect(() => {
    setAdConsentDefault();

    const initial = getConsent();
    if (initial.analytics) enableMatomo();

    const offConsent = onConsentChange((s) => {
      if (s.analytics) enableMatomo();
      else disableMatomo();
    });

    const onRoute = () => trackRouteChange();
    const unpatch = patchHistory();
    window.addEventListener(LOCATION_EVENT, onRoute);
    window.addEventListener('popstate', onRoute);
    document.addEventListener('astro:page-load', onRoute);
    document.addEventListener('astro:after-swap', onRoute);

    return () => {
      offConsent();
      unpatch();
      window.removeEventListener(LOCATION_EVENT, onRoute);
      window.removeEventListener('popstate', onRoute);
      document.removeEventListener('astro:page-load', onRoute);
      document.removeEventListener('astro:after-swap', onRoute);
    };
  }, []);

  return null;
}

//The History API fires nothing for programmatic navigation, so pushState and
//replaceState are monkeypatched once per page to emit a synthetic event.
function patchHistory(): () => void {
  if (typeof history === 'undefined') return () => {};
  const flag = '__ranklockHistoryPatched';
  const w = window as unknown as Record<string, boolean>;
  if (w[flag]) return () => {};
  w[flag] = true;
  const fire = () => window.dispatchEvent(new Event(LOCATION_EVENT));
  (['pushState', 'replaceState'] as const).forEach((name) => {
    const orig = history[name];
    history[name] = function (this: History, ...args: Parameters<typeof orig>) {
      const r = orig.apply(this, args);
      fire();
      return r;
    } as typeof orig;
  });
  return () => {};
}
