//Accessible hover/focus tooltip (WAI-ARIA "tooltip" pattern). Dependency-free:
//the popover is PORTALED to <body> and fixed-positioned from the trigger's rect,
//so it escapes the items table's `.dt-wrap { overflow-x:auto }` clipping (which
//also clips vertically) without pulling in floating-ui. Shows on BOTH mouseenter
//AND keyboard focus; hides on mouseleave / blur / Escape — native `title=` only
//shows on mouse hover, which fails the keyboard-a11y requirement. `role="tooltip"`
//+ `aria-describedby` wire the focusable trigger to the popover for screen readers.
//
//By default the trigger is a focusable <span> wrapper. When the child is ALREADY
//interactive/focusable (e.g. an <a> link), pass `asChild`: the child element itself
//becomes the trigger (cloned to receive the ref, handlers and aria-describedby), so
//there is ONE tab stop and aria-describedby sits on the real focus target instead of
//an extra wrapper span. (Used by the Items table, where each item name is both a
//stats-tooltip trigger AND a link to the item-detail page.)
import { cloneElement, isValidElement, useCallback, useEffect, useId, useRef, useState } from 'react';
import type { DOMAttributes, FocusEvent, KeyboardEvent, MouseEvent, ReactElement, ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  //popover body (arbitrary content)
  content: ReactNode;
  //the visible trigger — keep its contents INLINE (spans); the wrapper is a <span>
  //unless `asChild` is set, in which case this must be a single focusable element.
  children: ReactNode;
  //extra class on the focusable anchor
  className?: string;
  //clone the single child element as the trigger instead of wrapping it (see header)
  asChild?: boolean;
}

//gap between trigger and popover, and the popover's max width (mirrors the CSS)
const GAP = 8;
const MAX_W = 260;

interface Coords {
  left: number;
  top: number;
  //placed above the trigger (true) or below it (false)
  above: boolean;
}

//Compose an existing child handler with the tooltip's own (both fire, child first).
function chain<E>(own: ((e: E) => void) | undefined, next: (e: E) => void): (e: E) => void {
  return (e: E) => {
    own?.(e);
    next(e);
  };
}

export default function Tooltip({ content, children, className, asChild }: TooltipProps) {
  const id = useId();
  //Broad element type so the same ref serves the <span> wrapper OR a cloned <a>.
  const anchorRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  //portal only after mount so SSR/hydration never touches document.body
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);

  useEffect(() => setMounted(true), []);

  //Read the trigger's viewport rect and pick an above/below placement with enough
  //room. `translateY(-100%)` (set in the style) lifts the box its own height for
  //the "above" case, so we never need to measure the popover first.
  const place = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const above = r.top > 180;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - MAX_W - 8));
    const top = above ? r.top - GAP : r.bottom + GAP;
    setCoords({ left, top, above });
  }, []);

  const show = useCallback(() => {
    place();
    setOpen(true);
  }, [place]);

  const hide = useCallback(() => setOpen(false), []);

  //While open, keep the fixed popover glued to the trigger through scroll/resize.
  useEffect(() => {
    if (!open) return;
    const onMove = () => place();
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open, place]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') hide();
  };

  //A callback ref sidesteps the ref-variance mismatch between HTMLElement and the
  //concrete child element type (span vs anchor); block body returns void so React 19
  //never mistakes the assignment for a cleanup function.
  const setAnchor = (el: HTMLElement | null) => {
    anchorRef.current = el;
  };

  let trigger: ReactNode;
  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<DOMAttributes<HTMLElement> & { className?: string }>;
    const p = child.props;
    trigger = cloneElement(child, {
      ref: setAnchor,
      className: [p.className, 'tt-anchor', className].filter(Boolean).join(' '),
      'aria-describedby': open ? id : (p as { 'aria-describedby'?: string })['aria-describedby'],
      onMouseEnter: chain<MouseEvent<HTMLElement>>(p.onMouseEnter, show),
      onMouseLeave: chain<MouseEvent<HTMLElement>>(p.onMouseLeave, hide),
      onFocus: chain<FocusEvent<HTMLElement>>(p.onFocus, show),
      onBlur: chain<FocusEvent<HTMLElement>>(p.onBlur, hide),
      onKeyDown: chain<KeyboardEvent<HTMLElement>>(p.onKeyDown, onKeyDown),
    } as Partial<DOMAttributes<HTMLElement>> & { ref: (el: HTMLElement | null) => void; className: string });
  } else {
    trigger = (
      <span
        ref={setAnchor}
        className={className ? `tt-anchor ${className}` : 'tt-anchor'}
        tabIndex={0}
        aria-describedby={open ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onKeyDown={onKeyDown}
      >
        {children}
      </span>
    );
  }

  return (
    <>
      {trigger}
      {mounted &&
        open &&
        coords &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            className="tt-pop"
            style={{ left: coords.left, top: coords.top, transform: coords.above ? 'translateY(-100%)' : 'none' }}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}
