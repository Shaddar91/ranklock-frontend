//Build-time art-direction toggles (PUBLIC_*, injected at build and exposed to
//client islands — same pattern as config/donation.ts). These flip the two baked
//design parameters it's reasonable to vary per environment:
//  • the rotating hero-art backdrop  (data-atmos)
//  • the sponsor / ad slots          (data-promo)
//The rest of the art direction (brass / density / table / badge / radar) is fixed
//in the Claude design and intentionally NOT env-configurable.
//
//Both default to ON when the var is unset/blank; set the var to "off" to disable.
//BaseLayout writes the resolved values to data-* on <html> at build (SSR) and skips
//mounting the corresponding island when it's off.

//Only the literal "off" disables; anything else (incl. unset/blank/"on") is on.
const isOff = (raw: string | undefined): boolean => String(raw ?? '').trim().toLowerCase() === 'off';

//Rotating hero-art backdrop. data-atmos: 'hero' (shown) | 'off' (hidden).
export const ATMOS: 'hero' | 'off' = isOff(import.meta.env.PUBLIC_HERO_BACKDROP) ? 'off' : 'hero';

//Sponsor / ad slots. data-promo: 'on' (shown) | 'off' (hidden).
export const AD_SLOTS: 'on' | 'off' = isOff(import.meta.env.PUBLIC_AD_SLOTS) ? 'off' : 'on';
