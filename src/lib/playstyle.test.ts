import { describe, it, expect } from 'vitest';
import { compareRadarVsPlayer, isAllHeroesCompare, selfShapeAxes } from './playstyle';
import type { CompareYou } from '../types/api';

//A full compare side. The all-heroes response (hero_id 0) carries the same fields —
//the sentinel changes the SQL scope server-side, never the served shape.
const side = (over: Partial<CompareYou> = {}): CompareYou => ({
  matches: 12,
  badge: 62,
  tier: 6,
  tier_name: 'Emissary',
  avg_net_worth: 32000,
  souls_per_min: 800,
  avg_last_hits: 100,
  last_hits_per_min: 3.4,
  avg_denies: 3.5,
  avg_kills: 6,
  avg_deaths: 4,
  avg_assists: 8,
  avg_damage: 36400,
  damage_per_min: 910,
  span_from: null,
  span_to: null,
  ...over,
});

//A 0-game side as the backend serves it under a window/hero scope (200): matches 0,
//every metric and the span null.
const zeroSide = (): CompareYou =>
  side({
    matches: 0,
    avg_net_worth: null,
    souls_per_min: null,
    avg_last_hits: null,
    last_hits_per_min: null,
    avg_denies: null,
    avg_kills: null,
    avg_deaths: null,
    avg_assists: null,
    avg_damage: null,
    damage_per_min: null,
  });

const AXIS_ORDER = ['Souls/min', 'Last-hits', 'Kills', 'Assists', 'Denies', 'KDA'];

describe('selfShapeAxes', () => {
  it('returns the six axes in the fixed order', () => {
    expect(selfShapeAxes(side()).map((a) => a.axis)).toEqual(AXIS_ORDER);
  });
  it('normalizes each metric against its display ceiling', () => {
    const axes = selfShapeAxes(side());
    expect(axes[0]?.you).toBeCloseTo(800 / 1600); //Souls/min
    expect(axes[1]?.you).toBeCloseTo(100 / 200); //Last-hits
    expect(axes[2]?.you).toBeCloseTo(6 / 12); //Kills
    expect(axes[3]?.you).toBeCloseTo(8 / 25); //Assists
    expect(axes[4]?.you).toBeCloseTo(3.5 / 7); //Denies
    expect(axes[5]?.you).toBeCloseTo(3.5 / 6); //KDA (6+8)/4
    expect(axes.every((a) => a.served)).toBe(true);
  });
  it('clamps an over-ceiling value to 1.0', () => {
    const axes = selfShapeAxes(side({ souls_per_min: 3200 }));
    expect(axes[0]?.you).toBe(1);
  });
  it('marks a null metric unserved with a zero value', () => {
    const axes = selfShapeAxes(side({ avg_denies: null }));
    expect(axes[4]).toEqual({ axis: 'Denies', you: 0, cohort: 0, served: false });
  });
  it('carries no cohort series — the panel draws one polygon', () => {
    expect(selfShapeAxes(side()).every((a) => a.cohort === 0)).toBe(true);
  });
});

describe('compareRadarVsPlayer', () => {
  it('maps both players onto the same per-axis scale', () => {
    const axes = compareRadarVsPlayer(side(), side({ souls_per_min: 1600, avg_kills: 12 }));
    expect(axes[0]?.you).toBeCloseTo(0.5);
    expect(axes[0]?.cohort).toBeCloseTo(1);
    expect(axes[2]?.you).toBeCloseTo(0.5);
    expect(axes[2]?.cohort).toBeCloseTo(1);
  });
  it('keeps the axis served on the viewer value even when theirs is null', () => {
    const axes = compareRadarVsPlayer(side(), side({ avg_assists: null }));
    expect(axes[3]?.served).toBe(true);
    expect(axes[3]?.cohort).toBe(0);
  });
  it('marks the axis unserved when the viewer value is null', () => {
    const axes = compareRadarVsPlayer(side({ avg_kills: null }), side());
    expect(axes[2]?.served).toBe(false);
    expect(axes[2]?.you).toBe(0);
    expect(axes[2]?.cohort).toBeCloseTo(0.5);
  });
  it('maps the all-heroes aggregate shape (hero_id 0 scope) like any other side', () => {
    const youAll = side({ matches: 61, souls_per_min: 640, avg_last_hits: 80 });
    const themAll = side({ matches: 74, souls_per_min: 960, avg_last_hits: 120 });
    const axes = compareRadarVsPlayer(youAll, themAll);
    expect(axes.every((a) => a.served)).toBe(true);
    expect(axes[0]?.you).toBeCloseTo(640 / 1600);
    expect(axes[0]?.cohort).toBeCloseTo(960 / 1600);
    expect(axes[1]?.you).toBeCloseTo(80 / 200);
    expect(axes[1]?.cohort).toBeCloseTo(120 / 200);
  });
});

describe('isAllHeroesCompare', () => {
  it('treats the hero_id 0 sentinel as all-heroes', () => {
    expect(isAllHeroesCompare({ hero_id: 0, shared_hero: false })).toBe(true);
  });
  it('treats shared_hero:false as all-heroes', () => {
    expect(isAllHeroesCompare({ hero_id: 35, shared_hero: false })).toBe(true);
  });
  it('treats a real shared hero as shared', () => {
    expect(isAllHeroesCompare({ hero_id: 35, shared_hero: true })).toBe(false);
  });
  it('reads a legacy response without the flag as shared', () => {
    expect(isAllHeroesCompare({ hero_id: 35 })).toBe(false);
  });
});

//C4 (ranklock-radar-window-scope-execution): the radar's "You" polygon must be
//identical solo and under a player overlay at the SAME scope, and a 0-game side
//maps to an all-zero polygon the chart hides (never a fabricated shape).
describe('radar You-polygon invariant + 0-game sides', () => {
  it('solo selfShapeAxes equals the overlay you series under the same scope', () => {
    const you = side();
    const solo = selfShapeAxes(you);
    const overlay = compareRadarVsPlayer(you, side({ souls_per_min: 960, avg_kills: 9 }));
    expect(overlay.map((a) => a.you)).toEqual(solo.map((a) => a.you));
    expect(overlay.map((a) => a.served)).toEqual(solo.map((a) => a.served));
  });
  it('holds for a windowed all-heroes fixture (hero_id 0 scope shape)', () => {
    const youAll = side({ matches: 10, souls_per_min: 1053.4, avg_last_hits: 152.6, avg_denies: 1.4 });
    const solo = selfShapeAxes(youAll);
    const overlay = compareRadarVsPlayer(youAll, side({ matches: 111 }));
    expect(overlay.map((a) => a.you)).toEqual(solo.map((a) => a.you));
  });
  it('maps a 0-game you side to all-zero unserved axes while their side still draws', () => {
    const axes = compareRadarVsPlayer(zeroSide(), side());
    expect(axes.every((a) => a.you === 0 && !a.served)).toBe(true);
    expect(axes.every((a) => a.cohort > 0)).toBe(true);
  });
  it('maps a 0-game them side to all-zero cohort values on served you axes', () => {
    const axes = compareRadarVsPlayer(side(), zeroSide());
    expect(axes.every((a) => a.cohort === 0)).toBe(true);
    expect(axes.every((a) => a.served)).toBe(true);
  });
  it('selfShapeAxes on a 0-game side yields nothing served (the panel keeps the empty-grid + caption state)', () => {
    const axes = selfShapeAxes(zeroSide());
    expect(axes.every((a) => a.you === 0 && a.cohort === 0 && !a.served)).toBe(true);
  });
});
