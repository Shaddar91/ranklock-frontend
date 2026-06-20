//Art-direction "Tweaks" panel island (mount with client:load).
//
//Ports the mockup's full art-direction panel (ranklock-app/app.jsx) into the Astro
//app and WIRES every control to lib/tweaks: each writes a `data-*` attribute on
//<html> + persists to localStorage. The CSS in components.css / tokens.css reacts
//(zero re-render); the BaseLayout inline bootstrap re-applies the same attributes
//pre-paint, so reloads don't flash. Theme reuses the compact ThemeSwitcher dropdown
//(C3). HUD accent overrides the --cyan-* family while Aether is active; a
//`data-theme` MutationObserver re-gates it live when the skin changes from either
//dropdown.
//
//Self-contained floating panel (trigger + dialog) — the mockup's editor-host
//postMessage protocol is intentionally NOT ported (it only exists for the prototype
//harness). Light: no extra deps, all styling is plain .twk-* classes.
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import ThemeSwitcher from './ThemeSwitcher';
import { cssVars } from '../../lib/cssVars';
import {
  ENUM_TWEAKS,
  TWEAKS,
  getEnumTweak,
  applyEnumTweak,
  ACCENTS,
  ACCENT_NAMES,
  DEFAULT_ACCENT,
  getAccent,
  setAccent,
  applyAccent,
  type EnumTweak,
} from '../../lib/tweaks';

//Title-case a kebab value for display ('emblem-only' → 'Emblem only').
const pretty = (v: string) => (v.charAt(0).toUpperCase() + v.slice(1)).replace(/-/g, ' ');

//Segmented control fits 2 options up to ~16 chars each, 3 up to ~10 (the 280px
//panel width budget — same heuristic as the mockup's TweakRadio); longer/over-3
//option sets fall back to a <select> rather than wrapping mid-word.
const SEG_MAX: Record<number, number> = { 2: 16, 3: 10 };
function fitsSegmented(options: readonly string[]): boolean {
  const max = options.reduce((m, o) => Math.max(m, pretty(o).length), 0);
  return max <= (SEG_MAX[options.length] ?? 0);
}

function SlidersIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2 4.5h6M11 4.5h3M2 11.5h3M8 11.5h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="9.5" cy="4.5" r="1.8" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="6.5" cy="11.5" r="1.8" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function Section({ label }: { label: string }) {
  return <div className="twk-sect">{label}</div>;
}

function ToggleRow({
  label,
  on,
  onChange,
  note,
}: {
  label: string;
  on: boolean;
  onChange: (next: boolean) => void;
  note?: string;
}) {
  return (
    <div className="twk-row twk-row-h">
      <span className="twk-lbl-txt">
        {label}
        {note && <span className="twk-note">{note}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        className="twk-switch"
        data-on={on ? '1' : '0'}
        onClick={() => onChange(!on)}
      >
        <i />
      </button>
    </div>
  );
}

function ChoiceRow({
  label,
  value,
  options,
  onChange,
  note,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (next: string) => void;
  note?: string;
}) {
  const labelNode = (
    <span className="twk-lbl-txt">
      {label}
      {note && <span className="twk-note">{note}</span>}
    </span>
  );

  //Long/many options → native <select> (keyboard + focus + option list for free).
  if (!fitsSegmented(options)) {
    return (
      <div className="twk-row">
        {labelNode}
        <select className="twk-select" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => (
            <option key={o} value={o}>
              {pretty(o)}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="twk-row">
      {labelNode}
      <div className="twk-seg" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={o === value}
            className="twk-seg-btn"
            data-on={o === value ? '1' : '0'}
            onClick={() => onChange(o)}
          >
            {pretty(o)}
          </button>
        ))}
      </div>
    </div>
  );
}

//All three curated accents are light, so a single dark check reads on every swatch.
function Check() {
  return (
    <svg viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M3 7.2 5.8 10 11 4.2"
        fill="none"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        stroke="rgba(10,14,23,0.88)"
      />
    </svg>
  );
}

function AccentRow({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  return (
    <div className="twk-row">
      <span className="twk-lbl-txt">
        HUD accent
        <span className="twk-note">Recolors the Aether skin&apos;s HUD accent.</span>
      </span>
      <div className="twk-chips" role="radiogroup" aria-label="HUD accent">
        {Object.entries(ACCENTS).map(([hex, steps]) => {
          const on = hex === value;
          return (
            <button
              key={hex}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={ACCENT_NAMES[hex] ?? hex}
              title={ACCENT_NAMES[hex] ?? hex}
              className="twk-chip"
              data-on={on ? '1' : '0'}
              style={cssVars({ '--sw': steps[0] })}
              onClick={() => onChange(hex)}
            >
              {on && <Check />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function TweaksPanel() {
  const [open, setOpen] = useState(false);
  //SSR-safe defaults; reconciled from storage on mount (the bootstrap has already
  //applied the live attributes, so this only syncs the panel's own UI state).
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(ENUM_TWEAKS.map((t) => [t.id, t.default])),
  );
  const [accent, setAccentState] = useState<string>(DEFAULT_ACCENT);

  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    setVals(Object.fromEntries(ENUM_TWEAKS.map((t) => [t.id, getEnumTweak(t)])));
    setAccentState(getAccent());
  }, []);

  //Re-gate the accent whenever the skin changes (from this panel's theme dropdown
  //OR the header one): accent only applies on Aether.
  useEffect(() => {
    const obs = new MutationObserver(() => applyAccent());
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  //Escape to close + click-outside to dismiss; focus moves into the panel on open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    const id = window.setTimeout(() => panelRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      window.clearTimeout(id);
    };
  }, [open, close]);

  //current value of an enum tweak (stored state, default until the mount effect runs).
  const cur = (t: EnumTweak) => vals[t.id] ?? t.default;

  const onEnum = (t: EnumTweak, value: string) => {
    applyEnumTweak(t, value);
    setVals((p) => ({ ...p, [t.id]: value }));
  };

  const onAccent = (hex: string) => {
    setAccent(hex);
    setAccentState(hex);
  };

  return (
    <div className="twk">
      <button
        ref={triggerRef}
        type="button"
        className="twk-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <SlidersIcon />
        <span>Tweaks</span>
      </button>

      {open && (
        <div ref={panelRef} id={panelId} className="twk-panel" role="dialog" aria-label="Art-direction tweaks" tabIndex={-1}>
          <div className="twk-hd">
            <b>Tweaks</b>
            <button type="button" className="twk-x" aria-label="Close tweaks" onClick={close}>
              ✕
            </button>
          </div>
          <div className="twk-body">
            <Section label="Art direction" />
            <div className="twk-row">
              <span className="twk-lbl-txt">Theme</span>
              <ThemeSwitcher compact />
            </div>
            <ToggleRow
              label="Backdrop"
              on={cur(TWEAKS.atmos) !== 'off'}
              onChange={(b) => onEnum(TWEAKS.atmos, b ? 'hero' : 'off')}
            />

            <Section label="Monetization" />
            <ToggleRow
              label="Show ad slots"
              on={cur(TWEAKS.promo) !== 'off'}
              onChange={(b) => onEnum(TWEAKS.promo, b ? 'on' : 'off')}
            />

            <Section label="Identity" />
            <ChoiceRow
              label="Brass intensity"
              value={cur(TWEAKS.brass)}
              options={TWEAKS.brass.values}
              onChange={(v) => onEnum(TWEAKS.brass, v)}
            />
            <AccentRow value={accent} onChange={onAccent} />

            <Section label="Data tables" />
            <ChoiceRow
              label="Density"
              value={cur(TWEAKS.density)}
              options={TWEAKS.density.values}
              onChange={(v) => onEnum(TWEAKS.density, v)}
            />
            <ChoiceRow
              label="Row style"
              value={cur(TWEAKS.table)}
              options={TWEAKS.table.values}
              onChange={(v) => onEnum(TWEAKS.table, v)}
            />

            <Section label="Rank &amp; coaching" />
            <ChoiceRow
              label="Bracket badges"
              value={cur(TWEAKS.badge)}
              options={TWEAKS.badge.values}
              onChange={(v) => onEnum(TWEAKS.badge, v)}
            />
            <ChoiceRow
              label="Playstyle radar"
              value={cur(TWEAKS.radar)}
              options={TWEAKS.radar.values}
              onChange={(v) => onEnum(TWEAKS.radar, v)}
              note={TWEAKS.radar.note}
            />
          </div>
        </div>
      )}
    </div>
  );
}
