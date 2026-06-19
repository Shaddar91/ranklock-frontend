//Momentum / delta chip — signed change with an up/down glyph. `better` flips
//which direction is "good" (e.g. for a metric where lower is better). Color +
//glyph + sign all carry the meaning (never color alone — a11y).
import Icon from './Icon';

interface DeltaProps {
  value: number;
  better?: boolean;
  suffix?: string;
}

export default function Delta({ value, better = true, suffix = '%' }: DeltaProps) {
  if (value === 0) {
    return (
      <span className="delta" style={{ color: 'var(--faint)' }}>
        ±0{suffix}
      </span>
    );
  }
  const positive = value > 0;
  const good = positive === better;
  return (
    <span className={'delta ' + (good ? 'up' : 'down')}>
      <Icon name={positive ? 'up' : 'down'} size={11} style={{ verticalAlign: '-1px' }} />
      {Math.abs(value).toFixed(1)}
      {suffix}
    </span>
  );
}
