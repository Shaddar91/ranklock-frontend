//Shared Recharts styling so all charts pick up the active gaslamp skin (the
//chart primitives read CSS custom properties, so they re-theme live with the
//rest of the app). Imported by every chart island.
import type { CSSProperties } from 'react';
import { useSyncExternalStore } from 'react';
import { DEFAULT_THEME, getActiveTheme, type ThemeId } from '../../../lib/theme';

//The value type Recharts hands a Tooltip `formatter` (it may be undefined or an
//array). Widen our formatters to this so they satisfy Recharts' Formatter type.
export type ChartFmtValue = number | string | ReadonlyArray<number | string> | undefined;

export const tooltipContentStyle: CSSProperties = {
  background: 'var(--raised)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text)',
  fontSize: 12,
  fontFamily: 'var(--mono)',
  boxShadow: '0 8px 24px -12px rgba(0,0,0,.7)',
};

export const tooltipLabelStyle: CSSProperties = {
  color: 'var(--muted)',
  fontFamily: 'var(--display)',
  marginBottom: 2,
};

export const tooltipItemStyle: CSSProperties = {
  color: 'var(--text-2)',
};

//Axis tick text styling (Recharts `tick` prop).
export const axisTick = { fill: 'var(--faint)', fontSize: 10, fontFamily: 'var(--mono)' } as const;

export const gridStroke = 'var(--border)';

//Series colors expressed as CSS vars (live theme-aware). These re-skin with the
//active theme — good for single-accent charts (radar, source bars) where the hue
//just needs to read as "the accent".
export const seriesColor = {
  you: 'var(--cyan-bright)',
  cohort: 'var(--muted)',
  amber: 'var(--amber-acc)',
  sapphire: 'var(--sapphire-acc)',
  loss: 'var(--loss)',
  win: 'var(--win)',
} as const;

//Economy-curve series palette — THEME-AWARE. tokens.css --econ-* holds the default
//palette (what the foundry + aether skins render); themes.css re-skins the vars per
//skin (arcane / gaslamp / obsidian do, each from its own accent family). The chart
//captions speak the hue literally ("the cyan area…"), so the WORDS follow the skin
//too, through the theme-keyed maps below — a caption must read useEconSeriesWords,
//never a hardcoded color word. Each key also owns a distinct line style in
//EconomyCurve so the series stay tellable apart by shape as well as hue.
export const econSeriesColor = {
  you: 'var(--econ-you)', //League A tier median — the skin's lead series accent
  cohort: 'var(--econ-cohort)', //League B / one tier up (chasing)
  player: 'var(--econ-player)', //the FIRST picked player / "You" (amber in every skin)
  player2: 'var(--econ-player2)', //the SECOND compared player (coral in every skin)
} as const;

//Signature player-curve palette — the /players/:id economy curve (SignatureCurve).
//DISTINCT from econSeriesColor above: here the mental model is "YOU vs a cohort you
//pick", so `you` is the PERSON's own fixed curve (reusing --econ-player, amber in
//every skin) and `comparison` is the selected league/hero cohort median (reusing
//--econ-you, the skin's lead accent). Warm person-hue vs cool cohort-hue stay
//tellable apart in every skin, and the caption color-words (useSigSeriesWords) read
//from the SAME pair the lines do, so "the amber line is you / the cyan line is
//<Tier> average" can never drift into a phantom color (the C3 no-phantom-cyan fix).
export const sigSeriesColor = {
  you: 'var(--econ-player)', //YOUR fixed per-minute curve (the person)
  comparison: 'var(--econ-you)', //the selected league (+hero) cohort median
} as const;

//---- theme-aware series color VOCABULARY ------------------------------------
//The literal color WORD for each economy series, PER SKIN. A skin that re-colors a
//series (its --econ-* override in themes.css) re-WORDS it here — the two edits are one
//change, or a caption starts naming a hue the line doesn't render. Skins without an
//override inherit the tokens.css default palette and therefore the default words.
export type EconSeriesWords = Record<keyof typeof econSeriesColor, string>;

const DEFAULT_ECON_WORDS: EconSeriesWords = {
  you: 'cyan',
  cohort: 'violet',
  player: 'amber',
  player2: 'coral',
};

const ECON_WORDS_BY_THEME: Record<ThemeId, EconSeriesWords> = {
  //foundry (the default skin) + aether keep the tokens.css palette: the default hues
  //ARE aether's native vocabulary, and re-skinning foundry to its own oranges would
  //collapse the league and player series into near-identical warm hues (the exact bug
  //that motivated distinct series hues in the first place).
  foundry: DEFAULT_ECON_WORDS,
  aether: DEFAULT_ECON_WORDS,
  //arcane: League A takes the skin's own lavender accent; League B moves to cyan so
  //the two league lines can't blur into one violet family.
  arcane: { ...DEFAULT_ECON_WORDS, you: 'lavender', cohort: 'cyan' },
  //gaslamp: League A takes the skin's oxidized-copper accent.
  gaslamp: { ...DEFAULT_ECON_WORDS, you: 'teal' },
  //obsidian: League A takes the skin's steel-blue accent.
  obsidian: { ...DEFAULT_ECON_WORDS, you: 'blue' },
};

//Live skin subscription. Switching skins is a bare `data-theme` attribute write with
//ZERO React re-render (lib/theme applyTheme) — the CSS-var line colors re-skin
//instantly, so any component SPEAKING a color word must re-render at that moment too,
//or its words keep describing the previous skin. useSyncExternalStore over a
//MutationObserver on the attribute is that bridge. The server snapshot is the default
//skin BaseLayout bakes onto <html>; hydration then corrects to any persisted skin.
function subscribeToTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

function useActiveThemeId(): ThemeId {
  return useSyncExternalStore(subscribeToTheme, getActiveTheme, () => DEFAULT_THEME);
}

//The economy-series color words for the ACTIVE skin — the single lookup every
//caption/tooltip that speaks a series color word must read from.
export function useEconSeriesWords(): EconSeriesWords {
  return ECON_WORDS_BY_THEME[useActiveThemeId()];
}

//Signature-curve words DERIVE from the econ words: sigSeriesColor borrows
//--econ-player for `you` and --econ-you for `comparison`, so each slot speaks the
//econ word of the token it borrows — one palette definition drives both vocabularies.
export function useSigSeriesWords(): { you: string; comparison: string } {
  const words = useEconSeriesWords();
  return { you: words.player, comparison: words.you };
}
