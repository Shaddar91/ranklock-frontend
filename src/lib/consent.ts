//Analytics-consent state — the single source of truth for the site's one
//consent category, persisted as versioned JSON under localStorage and broadcast
//via `ranklock:consent-change`. Ads consent belongs to Google's certified CMP,
//not this store; stored v1 records that still carry an `ads` field parse fine
//(the field is ignored, the visitor's analytics choice stands). All reads and
//writes are SSR-safe and fail open (private mode just won't persist).

export const STORAGE_KEY = 'ranklock-consent';
export const CONSENT_CHANGE_EVENT = 'ranklock:consent-change';
export const REOPEN_EVENT = 'ranklock:reopen-consent';

//Bump only on an INCOMPATIBLE shape change — an unknown version is treated as
//undecided so the banner re-asks rather than honoring a stale schema.
const VERSION = 1;

export interface ConsentState {
  v: number;
  //the visitor has made an explicit choice. While false the banner shows and
  //nothing tracks.
  decided: boolean;
  analytics: boolean;
  //ISO timestamp of the decision (the privacy policy promises a timestamped,
  //withdrawable record); null until decided.
  ts: string | null;
}

export const DENIED: ConsentState = Object.freeze({
  v: VERSION,
  decided: false,
  analytics: false,
  ts: null,
});

function isState(x: unknown): x is ConsentState {
  if (typeof x !== 'object' || x === null) return false;
  const s = x as Record<string, unknown>;
  return typeof s.analytics === 'boolean' && typeof s.decided === 'boolean';
}

export function getConsent(): ConsentState {
  if (typeof localStorage === 'undefined') return DENIED;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DENIED;
    const parsed: unknown = JSON.parse(raw);
    if (!isState(parsed) || parsed.v !== VERSION) return DENIED;
    return parsed;
  } catch {
    return DENIED;
  }
}

export function hasDecided(): boolean {
  return getConsent().decided;
}

export function setConsent(next: { analytics: boolean }): ConsentState {
  const state: ConsentState = {
    v: VERSION,
    decided: true,
    analytics: next.analytics,
    ts: nowIso(),
  };
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      //private mode — the broadcast still honors the choice for this session.
    }
  }
  broadcast(state);
  return state;
}

export function acceptAll(): ConsentState {
  return setConsent({ analytics: true });
}
export function rejectAll(): ConsentState {
  return setConsent({ analytics: false });
}

//"Forget me": wipes the stored choice; the broadcast tears Matomo down live.
export function clearConsent(): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      //ignore — see setConsent
    }
  }
  broadcast(DENIED);
}

export function reopenBanner(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(REOPEN_EVENT));
  }
}

export function onConsentChange(handler: (s: ConsentState) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const fn = (e: Event) => handler((e as CustomEvent<ConsentState>).detail ?? getConsent());
  window.addEventListener(CONSENT_CHANGE_EVENT, fn);
  return () => window.removeEventListener(CONSENT_CHANGE_EVENT, fn);
}

function broadcast(state: ConsentState): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<ConsentState>(CONSENT_CHANGE_EVENT, { detail: state }));
  }
}

function nowIso(): string {
  try {
    return new Date().toISOString();
  } catch {
    return '';
  }
}
