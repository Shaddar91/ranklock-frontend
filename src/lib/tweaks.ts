//============================================================================
//Art-direction "Tweaks" registry + persistence — the JS source of truth for the
//mockup's data-* contract (ported from ranklock-app/app.jsx). Sibling to
//lib/theme.ts: theme owns `data-theme`; this module owns the rest of the
//art-direction attributes.
//
//Each enum tweak maps 1:1 to a `data-*` attribute on <html> and a localStorage
//key; the CSS in styles/components.css + tokens.css reacts to the attribute (pure
//variable / selector overrides, zero re-render, no layout shift), exactly like the
//theme system. The choices are re-applied before first paint by the inline
//bootstrap in BaseLayout.astro, which hardcodes the SAME keys/attrs/defaults (it is
//`is:inline` and cannot import this module — keep the two in sync).
//
//HUD accent is special: it overrides the --cyan-* accent family via inline custom
//properties, and ONLY while the Aether skin is active — every other skin owns its
//own --cyan-* palette in themes.css, so applying a global accent would clobber the
//skin's identity (this mirrors the mockup, which gates the accent to Aether too).
//============================================================================

import { getActiveTheme } from './theme';

export interface EnumTweak {
  //stable id (used as the React control key + lookup).
  id: string;
  //localStorage key (also hardcoded in the BaseLayout bootstrap).
  key: string;
  //the `data-*` attribute written on <html>.
  attr: string;
  label: string;
  //the full set of valid values; values[index 0..] — first entry is NOT special.
  values: readonly string[];
  default: string;
  //a control whose visual target surface isn't fully built in the app yet still
  //persists + applies its attribute; `note` documents the partial coverage in the
  //panel so it reads as intentional rather than a dead button.
  note?: string;
}

//The enum half of the mockup's contract, keyed by id for typed direct access
//(theme → lib/theme; accent → below). `as const satisfies` keeps each `values`
//tuple literal (so callers get exact unions) while validating the shape.
export const TWEAKS = {
  atmos: { id: 'atmos', key: 'ranklock-atmos', attr: 'data-atmos', label: 'Backdrop', values: ['hero', 'off'], default: 'hero' },
  promo: { id: 'promo', key: 'ranklock-promo', attr: 'data-promo', label: 'Show ad slots', values: ['on', 'off'], default: 'on' },
  brass: { id: 'brass', key: 'ranklock-brass', attr: 'data-brass', label: 'Brass intensity', values: ['bold', 'minimal'], default: 'bold' },
  density: { id: 'density', key: 'ranklock-density', attr: 'data-density', label: 'Density', values: ['compact', 'regular', 'comfy'], default: 'regular' },
  table: { id: 'table', key: 'ranklock-table', attr: 'data-table', label: 'Row style', values: ['zebra', 'plain', 'lined'], default: 'zebra' },
  badge: { id: 'badge', key: 'ranklock-badge', attr: 'data-badge', label: 'Bracket badges', values: ['full', 'emblem-only', 'label-only'], default: 'full' },
  radar: {
    id: 'radar',
    key: 'ranklock-radar',
    attr: 'data-radar',
    label: 'Playstyle radar',
    values: ['filled', 'line'],
    default: 'filled',
    note: 'Applies on player-profile radars.',
  },
} as const satisfies Record<string, EnumTweak>;

//Iterable view (for the panel's bulk read + the bootstrap-mirror docs).
export const ENUM_TWEAKS: readonly EnumTweak[] = Object.values(TWEAKS);

//Fired on every tweak write so any island (e.g. the radar) can react live without
//prop-drilling across the static page. detail = { key, value }.
export const TWEAK_EVENT = 'ranklock:tweakchange';

function readKey(key: string): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null; //private mode / disabled storage
  }
}

function writeKey(key: string, value: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch {
    //ignore persistence failures (private mode) — the live attribute still applied
  }
}

function emit(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TWEAK_EVENT, { detail: { key, value } }));
}

//Resolve the stored (or default) value for an enum tweak, validated.
export function getEnumTweak(t: EnumTweak): string {
  const v = readKey(t.key);
  return v != null && t.values.includes(v) ? v : t.default;
}

//Apply one enum tweak: write the <html> attribute + persist + notify. Invalid
//values fall back to the tweak's default (never write garbage to the DOM/storage).
export function applyEnumTweak(t: EnumTweak, value: string): void {
  const v = t.values.includes(value) ? value : t.default;
  if (typeof document !== 'undefined') document.documentElement.setAttribute(t.attr, v);
  writeKey(t.key, v);
  emit(t.key, v);
}

// ── HUD accent ───────────────────────────────────────────────────────────────

export const ACCENT_KEY = 'ranklock-accent';
export const DEFAULT_ACCENT = '#22d3ee';

//Curated accents → the four --cyan-* steps (bright, base, deep, deeper). Keys are
//lowercase hex so they compare cleanly against native <input type=color> output.
export const ACCENTS: Record<string, readonly [string, string, string, string]> = {
  '#22d3ee': ['#22d3ee', '#06b6d4', '#0891b2', '#0e7490'], //cyan (default)
  '#a78bfa': ['#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9'], //arcane violet
  '#fbbf24': ['#fbbf24', '#f59e0b', '#d97706', '#b45309'], //brass gold
};

//Human-readable names for the swatches (aria-label / title — never color-only).
export const ACCENT_NAMES: Record<string, string> = {
  '#22d3ee': 'Cyan',
  '#a78bfa': 'Arcane violet',
  '#fbbf24': 'Brass gold',
};

const ACCENT_VARS = ['--cyan-bright', '--cyan', '--cyan-deep', '--cyan-deeper'] as const;
const ACCENT_FALLBACK = ['#22d3ee', '#06b6d4', '#0891b2', '#0e7490'] as const;

export function getAccent(): string {
  const v = readKey(ACCENT_KEY);
  return v != null && v.toLowerCase() in ACCENTS ? v.toLowerCase() : DEFAULT_ACCENT;
}

//Apply the stored (or given) accent to <html> as inline --cyan-* overrides — but
//ONLY while Aether is active; on every other skin we clear the overrides so the
//skin's own --cyan-* palette shows. Call this whenever `data-theme` changes.
export function applyAccent(value?: string): void {
  if (typeof document === 'undefined') return;
  const hex = (value ?? getAccent()).toLowerCase();
  const el = document.documentElement;
  if (getActiveTheme() === 'aether') {
    const s = ACCENTS[hex] ?? ACCENT_FALLBACK;
    el.style.setProperty('--cyan-bright', s[0]);
    el.style.setProperty('--cyan', s[1]);
    el.style.setProperty('--cyan-deep', s[2]);
    el.style.setProperty('--cyan-deeper', s[3]);
  } else {
    ACCENT_VARS.forEach((v) => el.style.removeProperty(v));
  }
}

//Persist + apply an accent choice.
export function setAccent(value: string): void {
  const hex = value.toLowerCase() in ACCENTS ? value.toLowerCase() : DEFAULT_ACCENT;
  writeKey(ACCENT_KEY, hex);
  applyAccent(hex);
  emit(ACCENT_KEY, hex);
}
