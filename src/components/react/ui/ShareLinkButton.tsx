//Prominent shared share affordance — accent-bordered button with a share icon and a Copied flip; the OG card rides any copied link.
import { useState } from 'react';
import Icon from './Icon';

export default function ShareLinkButton({ url, label = 'Share' }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  function share() {
    try {
      void navigator.clipboard?.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      //clipboard unavailable (insecure context) — nothing to copy into.
    }
  }
  return (
    <button type="button" className={'share-btn' + (copied ? ' copied' : '')} onClick={share} aria-label={`Copy link: ${url}`}>
      <Icon name="share" size={15} />
      {copied ? 'Copied ✓' : label}
    </button>
  );
}
