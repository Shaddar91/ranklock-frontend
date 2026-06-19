//============================================================================
//Privacy-page "forget me" control (client:load on /privacy). Gaslamp re-skin of
//cloud-lord's MUI dialog version (requirements §8.3) with an inline confirm step
//(no MUI Dialog). Client-side detach the visitor controls directly: reset the
//stored consent choice, tell Matomo to forget consent, and delete the Matomo
//first-party cookies on this browser. Server-side erasure (Matomo
//deleteDataSubjects) is an operator/back-end task referenced in the policy text.
//============================================================================
import { useState } from 'react';
import Icon from '../ui/Icon';
import { clearConsent } from '../../../lib/consent';
import { disableMatomo } from '../../../lib/tracking';

//Expire every first-party Matomo cookie (_pk_*) across the plausible domain
//scopes, so clearing works whether the cookie was set on the host or a parent.
function deleteMatomoCookies(): void {
  if (typeof document === 'undefined') return;
  const host = window.location.hostname;
  const past = 'expires=Thu, 01 Jan 1970 00:00:00 GMT';
  for (const entry of document.cookie.split(';')) {
    const name = (entry.split('=')[0] ?? '').trim();
    if (!/^_pk_/.test(name)) continue;
    for (const domain of ['', host, `.${host}`]) {
      const d = domain ? `; domain=${domain}` : '';
      document.cookie = `${name}=; ${past}; path=/${d}`;
    }
  }
}

export default function ForgetMeButton() {
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

  const forget = () => {
    disableMatomo();
    deleteMatomoCookies();
    clearConsent();
    setConfirming(false);
    setDone(true);
  };

  return (
    <div className="consent-mgr panel panel-pad" style={{ marginTop: 16 }}>
      <div className="label-xs" style={{ marginBottom: 12 }}>
        Erase my data
      </div>
      <p className="muted" style={{ fontSize: 14, margin: '0 0 14px', maxWidth: '64ch' }}>
        Detach this browser: delete the Matomo cookies stored here and reset your consent
        choice. This is immediate. To also erase any server-side records, email the address
        in section 6 with your <code className="mono">_pk_id</code> cookie value.
      </p>
      {done ? (
        <span className="chip win">
          <Icon name="shield" size={13} /> Cookies cleared on this browser
        </span>
      ) : confirming ? (
        <div className="flex" style={{ gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-ghost consent-btn"
            onClick={() => setConfirming(false)}
          >
            Cancel
          </button>
          <button type="button" className="btn consent-btn consent-danger" onClick={forget}>
            Yes, forget me
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-ghost consent-btn consent-danger-ghost"
          onClick={() => setConfirming(true)}
        >
          Forget me on this site
        </button>
      )}
    </div>
  );
}
