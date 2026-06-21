//Theme switcher island (mount with client:load).
//
//Sets `document.documentElement.dataset.theme` and persists to localStorage via
//lib/theme — instant, zero re-render of the rest of the app (CSS variables
//cascade; only this control re-renders to show the active state).
//
//Two presentations, one behavior (both call `choose()` → applyTheme + persist):
//  • compact (nav)      → a single native <select> over the two SHIPPED skins
//                         (foundry ⇄ arcane); space-saving, keyboard + focus +
//                         option-list accessible for free.
//  • full (styleguide)  → the promoted pair (foundry ⇄ arcane) plus the secondary
//                         skins, rendered as labelled swatch buttons (internal only).
//
//SSR note: the active selection is read from the DOM in an effect (after the
//flash-free bootstrap in BaseLayout has applied the stored/default skin), so the
//server render shows the default skin and the client reconciles on mount — no
//hydration mismatch.
import { useEffect, useState } from 'react';
import { applyTheme, getActiveTheme, DEFAULT_THEME, THEMES, type ThemeId } from '../../lib/theme';
import { cssVars } from '../../lib/cssVars';

const PROMOTED = THEMES.filter((t) => t.group === 'promoted');
const MORE = THEMES.filter((t) => t.group === 'more');

interface ThemeSwitcherProps {
  //compact → render the space-saving native-<select> dropdown (used in the nav);
  //otherwise render the full labelled-swatch button groups (used in the styleguide).
  compact?: boolean;
}

export default function ThemeSwitcher({ compact = false }: ThemeSwitcherProps) {
  const [active, setActive] = useState<ThemeId | null>(null);

  useEffect(() => {
    setActive(getActiveTheme());
  }, []);

  function choose(id: ThemeId) {
    applyTheme(id);
    setActive(id);
  }

  //compact: one native <select> over the two shipped skins (foundry ⇄ arcane),
  //styled to the gaslamp system in components.css (.themesw-select). Native
  //semantics give keyboard support, a focus ring, and the option list for free —
  //no dependency, no listbox a11y code. (The full registry is reachable only from
  //the internal /styleguide via the non-compact variant below.)
  if (compact) {
    const sel = active && PROMOTED.some((p) => p.id === active) ? active : DEFAULT_THEME;
    return (
      <div className="themesw themesw--compact">
        <select
          className="themesw-select"
          aria-label="Theme"
          value={sel}
          onChange={(e) => choose(e.target.value as ThemeId)}
        >
          {PROMOTED.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  function renderOpt(id: ThemeId, label: string, swatch: string, blurb: string) {
    const pressed = active === id;
    return (
      <button
        key={id}
        type="button"
        className="themesw-opt"
        aria-pressed={pressed}
        title={`${label} — ${blurb}`}
        onClick={() => choose(id)}
        style={cssVars({ '--bc': swatch })}
      >
        <span className="themesw-sw" style={cssVars({ '--bc': swatch })} aria-hidden="true" />
        {label}
      </button>
    );
  }

  return (
    <div className="themesw" role="group" aria-label="Theme">
      <span className="themesw-lbl" aria-hidden="true">
        Theme
      </span>
      <div className="themesw-group">{PROMOTED.map((t) => renderOpt(t.id, t.label, t.swatch, t.blurb))}</div>
      <div className="themesw-group">{MORE.map((t) => renderOpt(t.id, t.label, t.swatch, t.blurb))}</div>
    </div>
  );
}
