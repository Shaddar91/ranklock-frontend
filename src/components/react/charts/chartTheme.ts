//Shared Recharts styling so all charts pick up the active gaslamp skin (the
//chart primitives read CSS custom properties, so they re-theme live with the
//rest of the app). Imported by every chart island.
import type { CSSProperties } from 'react';

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

//Economy-curve series palette — deliberately theme-STABLE (see tokens.css --econ-*).
//The economy chart names its colors literally in the legend + caption ("the cyan
//area…", "the violet dashed line…"), so its series MUST NOT re-skin, or those words
//go false in warm skins. Each key also owns a distinct line style in EconomyCurve so
//the three series stay tellable apart by shape as well as hue.
export const econSeriesColor = {
  you: 'var(--econ-you)', //cyan — your-rank tier median
  cohort: 'var(--econ-cohort)', //violet — one tier up (chasing)
  player: 'var(--econ-player)', //amber — the picked player / "You"
  player2: 'var(--econ-player2)', //coral — the SECOND compared player
} as const;

//The literal color WORD for each economy series, so the caption text ("the <cyan>
//area…") stays in lockstep with econSeriesColor — change a hue here and its word
//changes with it. Keep these two objects aligned.
export const econSeriesWord = {
  you: 'cyan',
  cohort: 'violet',
  player: 'amber',
  player2: 'coral',
} as const;

//Signature player-curve palette — the /players/:id economy curve (SignatureCurve).
//DISTINCT from econSeriesColor above: here the mental model is "YOU vs a cohort you
//pick", so `you` is the PERSON's own fixed curve (amber — the established person-hue,
//reusing --econ-player) and `comparison` is the selected league/hero cohort median
//(cyan — --econ-you). Both are theme-STABLE tokens. Amber (warm) vs cyan (cool) stay
//tellable apart in every skin, and the caption color-words below read from the SAME
//pair the lines do, so "the amber line is you / the cyan line is <Tier> average" can
//never drift into a phantom color (the C3 no-phantom-cyan fix).
export const sigSeriesColor = {
  you: 'var(--econ-player)', //amber — YOUR fixed per-minute curve (the person)
  comparison: 'var(--econ-you)', //cyan — the selected league (+hero) cohort median
} as const;

export const sigSeriesWord = {
  you: 'amber',
  comparison: 'cyan',
} as const;
