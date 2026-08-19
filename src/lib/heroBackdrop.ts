//Roster + asset resolver for the rotating hero-art backdrop (the baked
//`data-atmos="hero"` art-direction parameter from the Claude design).
//
//Splash art is loaded from the deadlock-api asset CDN — the SAME source the Claude
//design used (ranklock-app/data.jsx `heroBg`). The square card portraits in
//public/assets/heroes are intentionally NOT used here: those are cards, not the
//full-bleed background plates this layer needs.

import { ASSETS_BASE, DEADLOCK_ASSETS_HOST, rewriteAssetUrl } from './assets';

//Rotation cadence in seconds. The Claude-design slider sat around 16–18s; 18s per
//the latest direction. Single knob — retune here.
export const ROTATE_SECS = 18;

//The backdrop roster (Deadlock hero ids), in the design's order. Used purely for
//decoration; cycling wraps modulo length.
export const BACKDROP_HEROES = [
  'haze',
  'lash',
  'wraith',
  'yamato',
  'mirage',
  'warden',
  'kelvin',
  'bebop',
] as const;

//Width cutoff at which the small optimized plate takes over on our base;
//base.css carries the matching media query on .atmos-bg.
export const BACKDROP_SMALL_MQ = '(max-width: 828px)';

//The plates the layer picks from. `url` always resolves to a working plate under
//either base; `smallUrl` exists only on our base (the R2-only opt/ variants).
export interface HeroBackdropArt {
  url: string;
  smallUrl?: string;
}

//Full-bleed hero background plate for a given hero id. Upstream base => the
//verified `<id>_bg.webp` twin; our base => the optimized opt/ pair (828 + 1920).
//Routed through rewriteAssetUrl so it follows the swappable asset base.
export function heroBackdropArt(id: string, base?: string): HeroBackdropArt {
  const b = (base || ASSETS_BASE).replace(/\/+$/, '');
  const plates = `${DEADLOCK_ASSETS_HOST}/assets-api-res/images/heroes/backgrounds`;
  if (b === DEADLOCK_ASSETS_HOST) {
    return { url: rewriteAssetUrl(`${plates}/${id}_bg.webp`, b) };
  }
  return {
    url: rewriteAssetUrl(`${plates}/opt/${id}_bg_1920.webp`, b),
    smallUrl: rewriteAssetUrl(`${plates}/opt/${id}_bg_828.webp`, b),
  };
}
