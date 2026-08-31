//Share + local drafts for the Build Creator. The share link is a URL fragment (no server round
//trip); drafts go through the buildShare localStorage API, never localStorage directly. Both
//read browser globals lazily so the island is safe to server-render.
import { useCallback, useEffect, useState } from 'react';
import { buildShareHash, deleteDraft, loadDrafts, saveDraft, type Draft } from '../../../lib/buildShare';
import type { BuildInput } from '../../../lib/computeStats';

interface BuildToolbarProps {
  build: BuildInput;
  canShare: boolean;
  onLoad: (build: BuildInput) => void;
}

//Shares land on the /build/ noindex shell, not the indexable /build-lab meta page. trailingSlash is
//'always' site-wide, so the path keeps its trailing slash (slash before the hash) — the fragment
//carries the build and dodges the redirect.
const SHARE_PATH = '/build/';

function shareUrl(build: BuildInput): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${origin}${SHARE_PATH}${buildShareHash(build)}`;
}

function newDraftId(): string {
  const c = typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : undefined;
  return c?.randomUUID ? c.randomUUID() : `d${Date.now().toString(36)}`;
}

export default function BuildToolbar({ build, canShare, onLoad }: BuildToolbarProps) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [link, setLink] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    setDrafts(loadDrafts());
  }, []);

  const onShare = useCallback(() => {
    const url = shareUrl(build);
    setLink(url);
    const clip = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
    if (!clip?.writeText) {
      setStatus('Copy the link below.');
      return;
    }
    clip.writeText(url).then(
      () => setStatus('Link copied.'),
      () => setStatus('Copy the link below.'),
    );
  }, [build]);

  const onSave = useCallback(() => {
    if (typeof window === 'undefined') return;
    const name = window.prompt('Name this draft', `Build ${drafts.length + 1}`);
    if (name == null || name.trim() === '') return;
    setDrafts(saveDraft({ id: newDraftId(), name: name.trim(), build }, Date.now()));
    setStatus('Draft saved.');
  }, [build, drafts.length]);

  const onDelete = useCallback((id: string) => {
    setDrafts(deleteDraft(id));
    setStatus('Draft deleted.');
  }, []);

  return (
    <div className="panel panel-pad">
      <div className="flex" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="btn btn-primary" disabled={!canShare} onClick={onShare}>
          Share build
        </button>
        <button type="button" className="btn" disabled={!canShare} onClick={onSave}>
          Save draft
        </button>
        <span className="faint" style={{ fontSize: 12 }} role="status" aria-live="polite">{status}</span>
      </div>

      {link !== '' && (
        <label className="flex" style={{ alignItems: 'center', gap: 8, marginTop: 10 }}>
          <span className="label-xs">Link</span>
          <input
            className="field mono"
            style={{ fontSize: 11.5 }}
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Shareable build link"
          />
        </label>
      )}

      <div style={{ marginTop: 14 }}>
        <span className="label-xs">Saved drafts</span>
        {drafts.length === 0 ? (
          <p className="faint" style={{ fontSize: 12, margin: '6px 0 0' }}>
            None yet — “Save draft” keeps a build in this browser.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0 }}>
            {drafts.map((d) => (
              <li key={d.id} className="statrow" style={{ padding: '7px 0' }}>
                <span className="display" style={{ fontSize: 13, color: 'var(--text)', minWidth: 0 }}>
                  {d.name}
                  <span className="faint tnum" style={{ fontSize: 11, marginLeft: 8 }}>
                    {d.build.items.length} items
                  </span>
                </span>
                <span className="flex" style={{ gap: 6, flex: 'none' }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: '3px 10px', fontSize: 12 }}
                    onClick={() => onLoad(d.build)}
                  >
                    Load
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: '3px 10px', fontSize: 12 }}
                    onClick={() => onDelete(d.id)}
                    aria-label={`Delete draft ${d.name}`}
                  >
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
