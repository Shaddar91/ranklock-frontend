//Hero Overview §8 — the patch list beside the data-derived "Reading the numbers" panel.
//The before/after win-rate column only exists once the patch-mover fold answers; until
//then the rows still render and the missing column says so rather than showing zeroes.
import SectionHeader from '../ui/SectionHeader';
import EmptyState from '../ui/EmptyState';

export interface PatchRow {
  patchId: string;
  date: string;
  note: string | null;
  notesUrl: string | null;
  isCurrent: boolean;
}

export interface PatchMove {
  patchId: string;
  before: number | null;
  after: number | null;
  delta: number | null;
}

export interface PatchHistoryProps {
  heroName: string;
  patches: PatchRow[];
  moves: PatchMove[] | null;
  paragraph: string[];
  guideHref: string | null;
}

export default function PatchHistory({ heroName, patches, moves, paragraph, guideHref }: PatchHistoryProps) {
  const moveOf = (id: string) => moves?.find((m) => m.patchId === id) ?? null;
  const currentId = patches.find((p) => p.isCurrent)?.patchId ?? patches[0]?.patchId ?? '';

  return (
    <section id="patches" className="patch-grid">
      <div>
        <SectionHeader kicker="What changed" title={`Patch history for ${heroName}`} />
        {patches.length === 0 ? (
          <EmptyState title="Computing" message="The patch registry is still folding. This block refreshes hourly." />
        ) : (
          <div className="panel patch-list">
            {patches.map((p) => {
              const m = moveOf(p.patchId);
              return (
                <div className="patch-row" key={p.patchId}>
                  <div>
                    <div className="mono patch-id">{p.patchId}</div>
                    <div className="patch-date">{p.date}</div>
                  </div>
                  <div className="patch-note">
                    {p.note}
                    {p.notesUrl && (
                      <>
                        {' '}
                        <a href={p.notesUrl} rel="nofollow noopener" target="_blank">
                          notes ↗
                        </a>
                      </>
                    )}
                  </div>
                  <div className="patch-move">
                    {m?.before != null && m.after != null ? (
                      <>
                        <div className="tnum">
                          {m.before.toFixed(1)}% → <b>{m.after.toFixed(1)}%</b>
                        </div>
                        {m.delta != null && (
                          <div className="tnum" style={{ color: m.delta >= 0 ? 'var(--win)' : 'var(--loss)' }}>
                            {m.delta >= 0 ? '▲' : '▼'} {Math.abs(m.delta).toFixed(1)} win rate
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {moves == null && patches.length > 0 && (
          <EmptyState
            title="Computing"
            message={`Patch movers for ${currentId} answered 202. The before/after column appears once the fold completes.`}
          />
        )}
      </div>

      <div>
        <SectionHeader kicker="What it means" title="Reading the numbers" />
        <div className="panel panel-pad brass-frame reading">
          <span className="corner tl" />
          <span className="corner br" />
          {paragraph.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>
              This paragraph is written from the tables above; it appears once they carry rows.
            </p>
          ) : (
            <p className="reading-body">{paragraph.join(' ')}</p>
          )}
          <div className="reading-foot">
            <span className="muted">Written from this page&apos;s own tables</span>
            {guideHref && <a href={guideHref}>How to play {heroName} →</a>}
          </div>
        </div>
      </div>
    </section>
  );
}
