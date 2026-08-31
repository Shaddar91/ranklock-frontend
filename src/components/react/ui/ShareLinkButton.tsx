//Copies a canonical URL to the clipboard with a Copied flip — the OG card rides any shared link.
import { useState } from 'react';

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
    <button type="button" className="minitog" onClick={share} aria-label={`Copy link: ${url}`}>
      {copied ? 'Copied' : label}
    </button>
  );
}
