//Recent-form strip — last-N win/loss squares + a W/L tally. Each dot has a title
//so the result is available to assistive tech, not conveyed by color alone.
interface FormDotsProps {
  //true = win, false = loss; ordered oldest→newest (or as supplied).
  form: boolean[];
}

export default function FormDots({ form }: FormDotsProps) {
  const wins = form.filter(Boolean).length;
  return (
    <div className="flex" style={{ alignItems: 'center', gap: 8 }}>
      <div className="flex" style={{ gap: 3 }} role="img" aria-label={`Recent form: ${wins} wins, ${form.length - wins} losses`}>
        {form.map((w, i) => (
          <span key={i} className="formdot" style={{ background: w ? 'var(--win)' : 'var(--loss)' }} title={w ? 'Win' : 'Loss'} />
        ))}
      </div>
      <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>
        {wins}W {form.length - wins}L
      </span>
    </div>
  );
}
