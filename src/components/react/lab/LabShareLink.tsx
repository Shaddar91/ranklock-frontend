//The design's page-head Share link: copies the current board as a `#b1:` fragment link. Disabled
//until a board exists, so the button never hands out a link to nothing.
import { useCallback, useState } from 'react';
import { buildShareHash } from '../../../lib/buildShare';
import type { BuildInput } from '../../../lib/computeStats';

//Shares land on the /build/ noindex shell, not the indexable /build-lab meta page.
const SHARE_PATH = '/build/';

export default function LabShareLink({ build }: { build: BuildInput | null }) {
  const [status, setStatus] = useState('');

  const onShare = useCallback(() => {
    if (!build || build.items.length === 0) return;
    const url = `${window.location.origin}${SHARE_PATH}${buildShareHash(build)}`;
    const clip = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
    if (!clip?.writeText) {
      setStatus('Copy from the address bar.');
      window.location.hash = buildShareHash(build).slice(1);
      return;
    }
    clip.writeText(url).then(
      () => setStatus('Link copied.'),
      () => setStatus('Copy failed. Try again.'),
    );
  }, [build]);

  return (
    <span className="flex" style={{ alignItems: 'center', gap: 10 }}>
      {status && <span className="faint" style={{ fontSize: 11.5 }} role="status">{status}</span>}
      <button
        type="button"
        className="btn btn-brass btn-caps"
        style={{ borderRadius: 4 }}
        disabled={!build || build.items.length === 0}
        onClick={onShare}
      >
        Share link
      </button>
    </span>
  );
}
