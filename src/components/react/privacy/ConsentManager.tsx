//Privacy-page analytics-consent control (mounted client:load on /privacy).
//Toggling persists via lib/consent and broadcasts to TrackingProvider live — no
//reload. Ads consent is managed by Google's own consent message, not shown here.
import { useEffect, useState } from 'react';
import { getConsent, setConsent } from '../../../lib/consent';

export default function ConsentManager() {
  const [analytics, setAnalytics] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    setAnalytics(getConsent().analytics);
  }, []);

  const apply = (v: boolean) => {
    setAnalytics(v);
    setConsent({ analytics: v });
    setFlash(true);
    window.setTimeout(() => setFlash(false), 1300);
  };

  return (
    <div className="consent-mgr panel panel-pad">
      <div className="between" style={{ marginBottom: 12 }}>
        <span className="label-xs">Consent controls</span>
        <span className={'consent-saved' + (flash ? ' show' : '')}>Saved ✓</span>
      </div>

      <Row
        title="Analytics"
        on={analytics}
        onLabel="Matomo analytics on — first-party cookies are set on this browser."
        offLabel="Analytics off — no cookies are set, nothing is tracked."
        onChange={apply}
      />

      <p className="faint" style={{ fontSize: 11.5, marginTop: 14, lineHeight: 1.5, marginBottom: 0 }}>
        Your choice is recorded with a timestamp and can be changed or withdrawn here at any
        time. Withdrawing is as easy as giving consent. Ads personalization is managed in
        Google's own consent message, not here.
      </p>
    </div>
  );
}

interface RowProps {
  title: string;
  on: boolean;
  onLabel: string;
  offLabel: string;
  onChange: (v: boolean) => void;
}

function Row({ title, on, onLabel, offLabel, onChange }: RowProps) {
  return (
    <div className="consent-row">
      <span className="consent-row-text">
        <span className="consent-row-title">{title}</span>
        <span className="consent-row-desc">{on ? onLabel : offLabel}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={`${title} consent`}
        className={'consent-switch' + (on ? ' on' : '')}
        onClick={() => onChange(!on)}
      >
        <span className="consent-knob" />
      </button>
    </div>
  );
}
