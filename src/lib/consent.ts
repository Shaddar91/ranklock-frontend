//============================================================================
//Consent state — the single source of truth for the two consent categories
//(analytics + ads/marketing) across the app. cloud-lord (the ported reference,
//requirements §8.3) stored ONE analytics flag as a plain string; RankLock needs
//a second "ads/marketing" category for AdSense, so the choice is a versioned
//JSON object under localStorage['ranklock-consent'].
//
//Every reactive consumer (TrackingProvider, AdSlot, the privacy ConsentManager)
//coordinates through the `ranklock:consent-change` CustomEvent rather than prop
//drilling across islands. Reopening the banner is a separate
//`ranklock:reopen-consent` event so a "Cookie settings" affordance anywhere can
//summon it. All reads/writes are SSR-safe and fail open (no throw on private
//mode / disabled storage — the choice just won't persist).
//============================================================================

export const STORAGE_KEY = 'ranklock-consent';
export const CONSENT_CHANGE_EVENT = 'ranklock:consent-change';
export const REOPEN_EVENT = 'ranklock:reopen-consent';

//Bump when the stored shape changes — an unknown version is treated as undecided
//so the banner re-asks rather than honoring a stale schema.
const VERSION = 1;

export interface ConsentState {
  v: number;
  //the visitor has made an explicit choice. While false the banner shows and
  //nothing tracks / no ad script loads.
  decided: boolean;
  analytics: boolean;
  ads: boolean;
  //ISO timestamp of the decision (the privacy policy promises a timestamped,
  //withdrawable record); null until decided.
  ts: string | null;
}

//The safe default: everything denied, undecided.
export const DENIED: ConsentState = Object.freeze({
  v: VERSION,
  decided: false,
  analytics: false,
  ads: false,
  ts: null,
});

function isState(x: unknown): x is ConsentState {
  if (typeof x !== 'object' || x === null) return false;
  const s = x as Record<string, unknown>;
  return (
    typeof s.analytics === 'boolean' &&
    typeof s.ads === 'boolean' &&
    typeof s.decided === 'boolean'
  );
}

//Read the persisted choice (DENIED if none / unavailable / invalid / old schema).
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

//Persist a granular choice, stamp it, and broadcast to live consumers.
export function setConsent(next: { analytics: boolean; ads: boolean }): ConsentState {
  const state: ConsentState = {
    v: VERSION,
    decided: true,
    analytics: next.analytics,
    ads: next.ads,
    ts: nowIso(),
  };
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      //private mode / disabled storage — the broadcast below still lets this
      //session honor the choice; it just won't survive a reload.
    }
  }
  broadcast(state);
  return state;
}

//Banner convenience for the two headline buttons.
export function acceptAll(): ConsentState {
  return setConsent({ analytics: true, ads: true });
}
export function rejectAll(): ConsentState {
  return setConsent({ analytics: false, ads: false });
}

//Wipe the stored choice (used by "forget me"); broadcasts the denied baseline so
//Matomo/AdSlot tear down immediately.
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

//Subscribe to consent changes; returns an unsubscribe fn.
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
