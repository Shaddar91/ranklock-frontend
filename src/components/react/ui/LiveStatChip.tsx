//Live win-rate chip — a hero/item icon + name + win-rate + a pulsing "live" dot.
//The product differentiator: stats embedded inline in prose/guides that stay
//current. The dot animation respects prefers-reduced-motion (CSS).
import GameIcon from './GameIcon';

interface LiveStatChipProps {
  kind?: 'hero' | 'item';
  name: string;
  wr: number;
  iconUrl?: string | null;
  bracket?: string;
}

export default function LiveStatChip({ kind = 'hero', name, wr, iconUrl, bracket = 'Archon' }: LiveStatChipProps) {
  const good = wr >= 50;
  return (
    <span className="livechip" title={`Live win-rate · ${bracket} bracket`}>
      <GameIcon kind={kind} name={name} src={iconUrl} size={20} />
      <span className="display" style={{ fontSize: 12.5, color: 'var(--text)' }}>
        {name}
      </span>
      <span className="tnum" style={{ fontSize: 12.5, fontWeight: 600, color: good ? 'var(--win)' : 'var(--loss)' }}>
        {wr.toFixed(1)}%
      </span>
      <span className="livedot" aria-hidden="true" />
    </span>
  );
}
