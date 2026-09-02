//Backdrop plate resolver + rotation roster for the full-bleed hero art layer.
//Plates are the deadlock-api CDN background art, not the square card portraits.

import { ASSETS_BASE, DEADLOCK_ASSETS_HOST, rewriteAssetUrl } from './assets';

export const ROTATE_SECS = 18;

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

//Paired with the .atmos-bg media query in base.css — change both together.
export const BACKDROP_SMALL_MQ = '(max-width: 828px)';

export interface HeroBackdropArt {
  url: string;
  smallUrl?: string;
}

//Upstream keys 18 plates by display stem, not card class (`seven_bg` for `gigawatt`).
export const BACKDROP_STEM: Record<string, string> = {
  archer: 'grey_talon',
  bookworm: 'patience',
  bull: 'abrams',
  chrono: 'paradox',
  digger: 'krill',
  engineer: 'mcginnis',
  frank: 'victor',
  gigawatt: 'seven',
  hornet: 'vindicta',
  inferno: 'infernus',
  kali: 'vyper',
  nano: 'calico',
  punkgoat: 'billy',
  spectre: 'geist',
  sumo: 'dynamo',
  synth: 'pocket',
  tengu: 'ivy',
  vampirebat: 'mina',
};

export const backdropStem = (cls: string): string => `${BACKDROP_STEM[cls] ?? cls}_bg`;

export function heroBackdropArt(cls: string, base?: string): HeroBackdropArt {
  const b = (base || ASSETS_BASE).replace(/\/+$/, '');
  const plates = `${DEADLOCK_ASSETS_HOST}/assets-api-res/images/heroes/backgrounds`;
  const stem = backdropStem(cls);
  //the opt/ pair is mirror-only; the upstream base carries just the <stem>.webp twin
  if (b === DEADLOCK_ASSETS_HOST) {
    return { url: rewriteAssetUrl(`${plates}/${stem}.webp`, b) };
  }
  return {
    url: rewriteAssetUrl(`${plates}/opt/${stem}_1920.webp`, b),
    smallUrl: rewriteAssetUrl(`${plates}/opt/${stem}_828.webp`, b),
  };
}
