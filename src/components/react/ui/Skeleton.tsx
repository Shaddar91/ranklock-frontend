//Loading placeholder. A shimmering block (or a stack of `lines` blocks) that
//holds layout while data loads. Honors prefers-reduced-motion via the .skel CSS.
import type { CSSProperties } from 'react';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  lines?: number;
  style?: CSSProperties;
}

export default function Skeleton({ width = '100%', height = 14, radius, lines = 1, style }: SkeletonProps) {
  if (lines > 1) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, ...style }} aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <span
            key={i}
            className="skel"
            style={{ width: i === lines - 1 ? '70%' : width, height, borderRadius: radius }}
          />
        ))}
      </div>
    );
  }
  return <span className="skel" style={{ width, height, borderRadius: radius, ...style }} aria-hidden="true" />;
}
