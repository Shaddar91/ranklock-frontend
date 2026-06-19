//Brand mark + wordmark. The mark is a deco brass shield with a keyhole + rank
//chevron (inline SVG, theme-aware via currentColor/CSS vars). Renders as a link
//to `href` (default home).

interface MarkProps {
  size?: number;
}

export function Mark({ size = 34 }: MarkProps) {
  return (
    <svg className="wm-mark" width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="brassM" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e8c987" />
          <stop offset=".5" stopColor="#c79a4e" />
          <stop offset="1" stopColor="#6b4a21" />
        </linearGradient>
      </defs>
      <path
        d="M20 2 35 7v12c0 9-7 15-15 19C12 34 5 28 5 19V7L20 2Z"
        fill="#10151e"
        stroke="url(#brassM)"
        strokeWidth="2"
      />
      <path d="M20 7l9 3v8.5c0 6-4.5 10.5-9 13" stroke="var(--cyan-bright)" strokeWidth="1.2" opacity=".55" fill="none" />
      <circle cx="20" cy="17" r="4" fill="none" stroke="url(#brassM)" strokeWidth="2.2" />
      <path d="M20 20.5 18.5 28h3L20 20.5Z" fill="url(#brassM)" />
      <path d="M14 13.5 20 11l6 2.5" stroke="var(--cyan-bright)" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

interface WordmarkProps {
  href?: string;
}

export default function Wordmark({ href = '/' }: WordmarkProps) {
  return (
    <a className="wordmark" href={href} aria-label="RankLock home">
      <Mark />
      <span className="wm-text">
        Rank<b>Lock</b>
      </span>
    </a>
  );
}
