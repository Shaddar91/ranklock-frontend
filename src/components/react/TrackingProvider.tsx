//============================================================================
//Global, consent-gated analytics provider — mounted ONCE in BaseLayout via
//client:load. Renders nothing; it is behavior only (a TS/Astro re-host of
//cloud-lord's TrackingProvider, requirements §8.3):
//
//  • declares the Consent Mode v2 denied baseline up-front (for Google/AdSense);
//  • boots Matomo ONLY if analytics consent is already stored — so a first visit
//    sends nothing to the analytics server until the banner is accepted;
//  • reacts to live consent changes (lib/consent's CustomEvent) — enabling or
//    revoking Matomo and updating the ad consent signals with no reload;
//  • emits a Matomo pageview on client-side route changes (History API +
//    popstate + Astro view-transitions) — the SPA tracking cloud-lord lacked.
//============================================================================
import { useEffect } from 'react';
import { getConsent, onConsentChange } from '../../lib/consent';
import { enableMatomo, disableMatomo, trackRouteChange } from '../../lib/tracking';
import { setAdConsentDefault, updateAdConsent } from '../../lib/ads';

const LOCATION_EVENT = 'ranklock:locationchange';

export default function TrackingProvider() {
  useEffect(() => {
    //1. Consent Mode v2 baseline (denied) before any Google tag could load.
    setAdConsentDefault();

    //2. Honor a previously-stored choice on load (nothing fires when undecided).
    const initial = getConsent();
    if (initial.analytics) enableMatomo();
    updateAdConsent(initial.ads);

    //3. React to live consent changes from the banner / privacy toggles.
    const offConsent = onConsentChange((s) => {
      if (s.analytics) enableMatomo();
      else disableMatomo();
      updateAdConsent(s.ads);
    });

    //4. SPA route-change pageviews. A full MPA navigation re-mounts this provider
    //   and fires the initial pageview via enableMatomo(); these listeners cover
    //   client-side navigations (Astro view transitions, island History pushes).
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

//Monkeypatch pushState/replaceState to emit a synthetic location-change event
//(the History API fires nothing for programmatic navigation). Patched at most
//once per page even across re-mounts; returns a no-op cleanup since the patch is
//process-global (the per-mount listeners in the effect are what get removed).
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
