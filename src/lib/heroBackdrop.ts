//Roster + asset resolver for the rotating hero-art backdrop (the baked
//`data-atmos="hero"` art-direction parameter from the Claude design).
//
//Splash art is loaded from the deadlock-api asset CDN — the SAME source the Claude
//design used (ranklock-app/data.jsx `heroBg`). The square card portraits in
//public/assets/heroes are intentionally NOT used here: those are cards, not the
//full-bleed background plates this layer needs.

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

//Full-bleed hero background plate for a given hero id.
export function heroBackdropUrl(id: string): string {
  return `https://assets-bucket.deadlock-api.com/assets-api-res/images/heroes/backgrounds/${id}_bg.png`;
}
