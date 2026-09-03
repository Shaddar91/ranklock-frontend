//Prominent shared share affordance — accent-bordered button with a share icon and a Copied flip; the OG card rides any copied link.
import { useState } from 'react';
import Icon from './Icon';

export default function ShareLinkButton({ url, cardUrl, label = 'Share' }: { url: string; cardUrl?: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  function share() {
    if (cardUrl) new Image().src = cardUrl; //warm the render before the paste lands (~900ms cold vs 6.7ms warm)
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
