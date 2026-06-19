//Demo fixtures for the /styleguide gallery ONLY (a trimmed port of the prototype
//data.jsx). NOT used by production pages — those fetch the live API. Hero/item
//art is served from the bundled public/assets/ sample set.

export const heroImg = (id: string) => `/assets/heroes/${id}_card.png`;
export const itemImg = (id: string) => `/assets/items/${id}.png`;

export interface SampleHero {
  id: string;
  name: string;
  wr: number;
  pick: number;
  kda: number;
  trend: number;
  tier: string;
}

export const HEROES: SampleHero[] = [
  { id: 'haze', name: 'Haze', wr: 53.8, pick: 18.2, kda: 2.94, trend: 1.8, tier: 'S' },
  { id: 'lash', name: 'Lash', wr: 52.1, pick: 14.6, kda: 2.71, trend: 0.9, tier: 'S' },
  { id: 'wraith', name: 'Wraith', wr: 51.4, pick: 11.3, kda: 3.02, trend: -0.4, tier: 'A' },
  { id: 'yamato', name: 'Yamato', wr: 50.9, pick: 9.8, kda: 2.55, trend: 0.6, tier: 'A' },
  { id: 'mirage', name: 'Mirage', wr: 50.2, pick: 8.1, kda: 2.48, trend: 2.4, tier: 'A' },
  { id: 'warden', name: 'Warden', wr: 49.6, pick: 12.7, kda: 2.33, trend: -1.1, tier: 'B' },
  { id: 'kelvin', name: 'Kelvin', wr: 48.7, pick: 6.4, kda: 2.18, trend: 0.3, tier: 'B' },
  { id: 'bebop', name: 'Bebop', wr: 47.2, pick: 10.9, kda: 2.05, trend: -2.2, tier: 'C' },
];

export interface SampleItem {
  id: string;
  name: string;
  cat: string;
  wr: number;
  use: number;
}

export const ITEMS: SampleItem[] = [
  { id: 'tech-arcane_medallion', name: 'Arcane Medallion', cat: 'Spirit', wr: 54.1, use: 22.3 },
  { id: 'weapon-advanced_weaponry', name: 'Advanced Weaponry', cat: 'Weapon', wr: 52.8, use: 41.0 },
  { id: 'armor-advanced_armor', name: 'Improved Armor', cat: 'Vitality', wr: 51.9, use: 38.5 },
  { id: 'tech-acolytes_glove', name: "Acolyte's Glove", cat: 'Spirit', wr: 51.2, use: 14.7 },
  { id: 'utility-advanced_recharge', name: 'Advanced Recharge', cat: 'Utility', wr: 50.4, use: 19.8 },
  { id: 'weapon-adrenaline_rush', name: 'Adrenaline Rush', cat: 'Weapon', wr: 49.7, use: 27.1 },
];

export interface SampleLeader {
  rank: number;
  name: string;
  tier: number;
  sub: number;
  pp: number;
  wr: number;
  games: number;
  region: string;
  main: string;
}

export const LEADERS: SampleLeader[] = [
  { rank: 1, name: 'Vex Sterling', tier: 11, sub: 6, pp: 11500, wr: 64.0, games: 1840, region: 'EU', main: 'haze' },
  { rank: 2, name: 'Sable Vantablack', tier: 11, sub: 5, pp: 11387, wr: 63.5, games: 1817, region: 'NA', main: 'lash' },
  { rank: 3, name: 'Orrin Brass', tier: 11, sub: 4, pp: 11200, wr: 62.1, games: 1794, region: 'SEA', main: 'wraith' },
  { rank: 4, name: 'Mara Quickhand', tier: 10, sub: 1, pp: 11061, wr: 61.4, games: 1771, region: 'SA', main: 'yamato' },
  { rank: 5, name: 'Kade Ember', tier: 10, sub: 2, pp: 10920, wr: 60.9, games: 1748, region: 'EU', main: 'mirage' },
  { rank: 6, name: 'Lyle Voss', tier: 10, sub: 3, pp: 10800, wr: 59.7, games: 1725, region: 'NA', main: 'warden' },
  { rank: 7, name: 'Nyx Mire', tier: 9, sub: 4, pp: 10661, wr: 58.6, games: 1702, region: 'SEA', main: 'kelvin' },
  { rank: 8, name: 'Bram Calder', tier: 9, sub: 5, pp: 10520, wr: 57.4, games: 1679, region: 'SA', main: 'bebop' },
];

export const RADAR = [
  { axis: 'Damage', you: 0.82, cohort: 0.78 },
  { axis: 'Farming', you: 0.58, cohort: 0.71 },
  { axis: 'Tank', you: 0.41, cohort: 0.46 },
  { axis: 'Support', you: 0.3, cohort: 0.38 },
  { axis: 'Early Impact', you: 0.74, cohort: 0.69 },
  { axis: 'Pusher', you: 0.55, cohort: 0.63 },
];

export const ECON_CURVE = [
  { min: 0, you: 0, cohort: 0 },
  { min: 4, you: 1840, cohort: 2010 },
  { min: 8, you: 4400, cohort: 4760 },
  { min: 12, you: 7180, cohort: 7879 },
  { min: 16, you: 10240, cohort: 11180 },
  { min: 20, you: 13980, cohort: 15140 },
  { min: 24, you: 18900, cohort: 20300 },
];

export const SOURCES = [
  { source: 'Lane creeps', you: 2980, cohort: 3120 },
  { source: 'Neutrals', you: 1420, cohort: 2010 },
  { source: 'Hero kills', you: 1860, cohort: 1740 },
  { source: 'Objectives', you: 520, cohort: 610 },
  { source: 'Denied', you: 400, cohort: 399 },
];

export const MATCH_ECON = [0, 0.4, -0.2, 0.8, 1.6, 1.2, 2.4, 3.1, 2.8, 4.0, 5.2, 6.1, 7.4, 8.9, 11.2, 12.8].map(
  (lead, t) => ({ t, lead }),
);

export const SAMPLE_FORM: boolean[] = [true, true, false, true, true, false, false, true, true, false];
