import type { CSSProperties } from 'react';

//Tiny single-stroke icon set (Lucide-ish), ported from the prototype. Inline SVG
//so icons inherit `currentColor` and need no runtime/icon-font dependency.
const IPATHS = {
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.3-4.3',
  trophy: 'M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4ZM5 4H3v2a3 3 0 0 0 3 3M19 4h2v2a3 3 0 0 1-3 3',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  swords: 'M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M5 14l-3 3 3 3 3-3M3 19l2 2',
  flame: 'M12 22a7 7 0 0 0 7-7c0-3-2-5-3-7-1.5-3-2.5-4.5-4-6 0 3-1 5-3 7s-4 3.5-4 6a7 7 0 0 0 7 7Z',
  up: 'M12 19V5M5 12l7-7 7 7',
  down: 'M12 5v14M5 12l7 7 7-7',
  lock: 'M5 11h14v10H5V11ZM8 11V7a4 4 0 0 1 8 0v4',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z',
  coins: 'M8 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM16 22a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM8 8h.01M16 16h.01',
  target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-4a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm0-4a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  bolt: 'M13 2 3 14h7l-1 8 10-12h-7l1-8Z',
  users:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z',
  arrowR: 'M5 12h14M13 6l6 6-6 6',
  filter: 'M22 3H2l8 9.46V19l4 2v-8.54L22 3Z',
  spark: 'M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1M7.7 16.3l-2.1 2.1',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5 5h14l3 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6l3-7Z',
} as const;

export type IconName = keyof typeof IPATHS;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: CSSProperties;
  className?: string;
  title?: string;
}

export default function Icon({
  name,
  size = 16,
  color = 'currentColor',
  strokeWidth = 2,
  style,
  className,
  title,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <path d={IPATHS[name]} />
    </svg>
  );
}
