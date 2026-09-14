//The art inside a kit-key chip: the upstream ability glyph, or the key number when the hero
//serves no icon for it or the image fails to load.
import { useState } from 'react';
import { resolveAsset } from '../../../lib/assets';

interface AbilityGlyphProps {
  slot: number;
  icon?: string | null;
}

export default function AbilityGlyph({ slot, icon }: AbilityGlyphProps) {
  const [failed, setFailed] = useState(false);
  const url = resolveAsset(icon);
  if (!url || failed) return <>{slot || '?'}</>;
  return <img className="kit-art" src={url} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}
