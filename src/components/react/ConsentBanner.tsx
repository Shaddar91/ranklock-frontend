//Global cookie-consent banner — mounted once in BaseLayout (client:load). Owns
//the site's single consent category: analytics (self-hosted Matomo — nothing
//tracks until the visitor chooses). Ads consent belongs to Google's certified
//CMP and is never asked here.
import { useEffect, useState } from 'react';
import Icon from './ui/Icon';
import { acceptAll, rejectAll, setConsent, getConsent, hasDecided, REOPEN_EVENT } from '../../lib/consent';

export default function ConsentBanner() {
  const [open, setOpen] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [analytics, setAnalytics] = useState(true);

  useEffect(() => {
    //First visit (no decision) → reveal after a beat so it doesn't fight LCP.
    let t: number | undefined;
    if (!hasDecided()) t = window.setTimeout(() => setOpen(true), 600);

    const reopen = () => {
      const c = getConsent();
      setAnalytics(c.analytics || !c.decided);
      setCustomizing(false);
      setOpen(true);
    };
    window.addEventListener(REOPEN_EVENT, reopen);
    return () => {
      if (t) window.clearTimeout(t);
      window.removeEventListener(REOPEN_EVENT, reopen);
    };
  }, []);

  if (!open) return null;

  const close = () => setOpen(false);
  const onAcceptAll = () => {
    acceptAll();
    close();
  };
  const onRejectAll = () => {
    rejectAll();
    close();
  };
  const onSave = () => {
    setConsent({ analytics });
    close();
  };

  return (
    <div className="consent-wrap" role="dialog" aria-label="Cookie consent">
      <div className="consent-card brass-frame">
        <span className="corner tl" />
        <span className="corner tr" />
        <span className="corner bl" />
        <span className="corner br" />

        <div className="consent-head">
          <Icon name="shield" size={15} color="var(--brass-edge)" />
          <span className="label-xs">Privacy choice</span>
        </div>

        <p className="consent-body">
          RankLock uses first-party analytics (self-hosted Matomo) to see how the site is
          used. Nothing tracks until you choose.{' '}
          <a className="consent-link" href="/privacy/">
            Privacy &amp; cookies →
          </a>
        </p>

        {customizing && (
          <div className="consent-cats">
            <ConsentRow
              title="Analytics"
              desc="Self-hosted Matomo. Pageviews & referrers, first-party only — never shared or sold."
              checked={analytics}
              onChange={setAnalytics}
            />
          </div>
        )}

        <div className="consent-actions">
          <button type="button" className="btn btn-ghost consent-btn" onClick={onRejectAll}>
            Reject all
          </button>
          {customizing ? (
            <button type="button" className="btn btn-ghost consent-btn" onClick={onSave}>
              Save choices
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-ghost consent-btn"
              onClick={() => setCustomizing(true)}
            >
              Customize
            </button>
          )}
          <button type="button" className="btn btn-primary consent-btn" onClick={onAcceptAll}>
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}

interface RowProps {
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function ConsentRow({ title, desc, checked, onChange }: RowProps) {
  return (
    <div className="consent-row">
      <span className="consent-row-text">
        <span className="consent-row-title">{title}</span>
        <span className="consent-row-desc">{desc}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`${title} consent`}
        className={'consent-switch' + (checked ? ' on' : '')}
        onClick={() => onChange(!checked)}
      >
        <span className="consent-knob" />
      </button>
    </div>
  );
}
