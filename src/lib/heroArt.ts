//Every hero art variant, derived from the one URL the API serves (`heroes/<class>_card.png`)
//and routed through the swappable asset base webp-first; null for anything that is not a
//hero card so the caller's monogram fallback still fires.
import { ASSETS_BASE, DEADLOCK_ASSETS_HOST, preferWebp, rewriteAssetUrl } from './assets';
import { backdropStem } from './heroBackdrop';

export interface HeroArt {
  cls: string;
  card: string;
  cardGloat: string;
  cardCritical: string;
  small: string;
  minimap: string;
  vertical: string;
  background: string;
  nameSvg: string;
}

const CARD_URL = /^(.*\/heroes\/)([a-z0-9_]+)_card\.(?:png|webp)$/;

//Name wordmarks are keyed upstream by display name, not class; only the differing ones are listed.
const NAME_SVG_SLUG: Record<string, string> = {
  archer: 'grey_talon',
  astro: 'holliday',
  bookworm: 'paige',
  bull: 'abrams',
  chrono: 'paradox',
  digger: 'mo_krill',
  engineer: 'mcginnis',
  frank: 'victor',
  gigawatt: 'seven',
  hornet: 'vindicta',
  inferno: 'infernus',
  kali: 'vyper',
  magician: 'sinclair',
  nano: 'calico',
  punkgoat: 'billy',
  spectre: 'lady_geist',
  sumo: 'dynamo',
  synth: 'pocket',
  tengu: 'ivy',
  vampirebat: 'mina',
};

export function heroClass(iconUrl: string | null | undefined): string | null {
  return iconUrl?.match(CARD_URL)?.[2] ?? null;
}

export function heroArt(iconUrl: string | null | undefined, base?: string): HeroArt | null {
  const m = iconUrl?.match(CARD_URL);
  const dir = m?.[1];
  const cls = m?.[2];
  if (dir === undefined || cls === undefined) return null;
  const b = (base || ASSETS_BASE).replace(/\/+$/, '');
  const art = (key: string): string => preferWebp(rewriteAssetUrl(`${dir}${key}.png`, b), b);
  return {
    cls,
    card: art(`${cls}_card`),
    cardGloat: art(`${cls}_card_gloat`),
    cardCritical: art(`${cls}_card_critical`),
    small: art(`${cls}_sm`),
    minimap: art(`${cls}_mm`),
    vertical: art(`${cls}_vertical`),
    background: art(`backgrounds/${backdropStem(cls)}`),
    //wordmarks live outside the mirrored /images/ key space, so they stay on the upstream host.
    nameSvg: `${DEADLOCK_ASSETS_HOST}/assets-api-res/icons/${NAME_SVG_SLUG[cls] ?? cls}.svg`,
  };
}
