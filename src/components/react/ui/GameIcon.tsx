//Hero / item icon. Image-driven (the API serves `icon_url`); falls back to a
//monogram tile when no src is given or the image fails to load, so a missing CDN
//asset never leaves a broken-image glyph.
import { useState } from 'react';
import { resolveAsset } from '../../../lib/assets';

interface GameIconProps {
  kind: 'hero' | 'item';
  name: string;
  src?: string | null;
  size?: number;
}

export default function GameIcon({ kind, name, src, size = 28 }: GameIconProps) {
  const [failed, setFailed] = useState(false);
  const cls = kind === 'hero' ? 'hav' : 'iicon';
  //Route every icon (this is the shared renderer for hero/item art, incl.
  //LiveStatChip) through the swappable asset base — default = theirs, one flip = ours.
  const url = resolveAsset(src);
  const showImg = !!url && !failed;
  const monoSize = Math.max(9, Math.round(size * 0.42));
  return (
    <span className={cls} style={{ width: size, height: size }} title={name}>
      {showImg ? (
        <img src={url as string} alt={name} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span className="icon-mono" style={{ fontSize: monoSize }} aria-hidden="true">
          {name.slice(0, 1)}
        </span>
      )}
    </span>
  );
}
