//Win-rate readout: tabular % + an inline bar scaled across the meaningful 30–70%
//band (so a 52% vs 48% difference is visible). Green at/above 50, red below.
interface WinBarProps {
  wr: number;
  width?: number;
}

export default function WinBar({ wr, width = 64 }: WinBarProps) {
  const good = wr >= 50;
  const fill = Math.max(0, Math.min(100, ((wr - 30) / 40) * 100));
  return (
    <div className="flex" style={{ alignItems: 'center', gap: 9, justifyContent: 'flex-end' }}>
      <span
        className="tnum"
        style={{ color: good ? 'var(--win)' : 'var(--loss)', fontWeight: 600, minWidth: 46, textAlign: 'right' }}
      >
        {wr.toFixed(1)}%
      </span>
      <div className="wbar" style={{ width }}>
        <i
          style={{
            width: fill + '%',
            background: good
              ? 'linear-gradient(90deg,#1f8a5b,var(--win))'
              : 'linear-gradient(90deg,#b13a3a,var(--loss))',
          }}
        />
      </div>
    </div>
  );
}
