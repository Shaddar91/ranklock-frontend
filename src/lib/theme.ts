//============================================================================
//Theme registry + persistence (the JS source of truth for the 5 gaslamp skins).
//
//A skin is selected by writing `document.documentElement.dataset.theme = <id>`;
//the CSS in styles/themes.css does the rest (pure variable overrides, zero
//re-render, no layout shift). The choice persists to localStorage under
//STORAGE_KEY and is re-applied before first paint by the inline bootstrap in
//BaseLayout.astro (which hardcodes the same key + default — it is `is:inline` and
//cannot import this module).
//
//PROMOTED options (foundry + arcane) are surfaced prominently by ThemeSwitcher;
//the rest (aether/gaslamp/obsidian) sit in a secondary "more skins" group.
//============================================================================

export type ThemeId = 'foundry' | 'arcane' | 'aether' | 'gaslamp' | 'obsidian';

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  //swatch = the skin's dominant accent, shown as a dot in the switcher.
  swatch: string;
  blurb: string;
  group: 'promoted' | 'more';
}

//localStorage key — MUST match the inline bootstrap in BaseLayout.astro.
export const STORAGE_KEY = 'ranklock-theme';

//Default skin — also the `data-theme` baked onto <html> in BaseLayout.astro.
export const DEFAULT_THEME: ThemeId = 'foundry';

export const THEMES: readonly ThemeMeta[] = [
  { id: 'foundry', label: 'Foundry', swatch: '#fb923c', blurb: 'Molten amber / iron', group: 'promoted' },
  { id: 'arcane', label: 'Arcane', swatch: '#bb9bf7', blurb: 'Sapphire occult violet', group: 'promoted' },
  { id: 'aether', label: 'Aether', swatch: '#22d3ee', blurb: 'Electric cyan HUD', group: 'more' },
  { id: 'gaslamp', label: 'Gaslamp', swatch: '#e9c87c', blurb: 'Brass & leather', group: 'more' },
  { id: 'obsidian', label: 'Obsidian', swatch: '#38bdf8', blurb: 'Brushed steel', group: 'more' },
];

const VALID = new Set<string>(THEMES.map((t) => t.id));

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && VALID.has(value);
}

//Read the persisted choice (null if none / unavailable / invalid).
export function getStoredTheme(): ThemeId | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return isThemeId(v) ? v : null;
  } catch {
    return null; //private mode / disabled storage
  }
}

//The skin currently applied to <html> (falls back to the default).
export function getActiveTheme(): ThemeId {
  if (typeof document === 'undefined') return DEFAULT_THEME;
  const v = document.documentElement.dataset.theme;
  return isThemeId(v) ? v : DEFAULT_THEME;
}

//Apply a skin instantly (attribute write) and persist it.
export function applyTheme(id: ThemeId): void {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = id;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      //ignore persistence failures (private mode) — the live attribute still applied
    }
  }
}
