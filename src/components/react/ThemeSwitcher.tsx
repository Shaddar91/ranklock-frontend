//Theme switcher island (mount with client:load).
//
//Sets `document.documentElement.dataset.theme` and persists to localStorage via
//lib/theme — instant, zero re-render of the rest of the app (CSS variables
//cascade; only this control re-renders to show the active state). The promoted
//pair (foundry ⇄ arcane) is offered prominently; the other three skins sit in a
//secondary group.
//
//SSR note: the active selection is read from the DOM in an effect (after the
//flash-free bootstrap in BaseLayout has applied the stored/default skin), so the
//server render shows no pressed button and the client reconciles on mount — no
//hydration mismatch.
import { useEffect, useState } from 'react';
import { applyTheme, getActiveTheme, THEMES, type ThemeId } from '../../lib/theme';
import { cssVars } from '../../lib/cssVars';

const PROMOTED = THEMES.filter((t) => t.group === 'promoted');
const MORE = THEMES.filter((t) => t.group === 'more');

interface ThemeSwitcherProps {
  //hide the secondary "more skins" group, leaving just foundry ⇄ arcane
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
      {!compact && <div className="themesw-group">{MORE.map((t) => renderOpt(t.id, t.label, t.swatch, t.blurb))}</div>}
    </div>
  );
}
