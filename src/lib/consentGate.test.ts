import { afterEach, describe, expect, it, vi } from 'vitest';

//Consent-gate unit tests: Matomo loads ONLY after an analytics grant, a reject
//stays silent, and SPA navigations emit one pageview each. Runs in the node env
//(no jsdom) behind minimal window/document/localStorage fakes; the SUT modules
//are imported per test so their module-level env + tracker state start fresh.

interface Script {
  src: string;
  async: boolean;
}

function fakeDocument() {
  const scripts: Script[] = [];
  return {
    title: 'RankLock',
    scripts,
    head: {
      appendChild: (n: Script): Script => {
        scripts.push(n);
        return n;
      },
    },
    createElement: (_tag: string): Script => ({ src: '', async: false }),
    querySelector: (sel: string): Script | null => {
      const m = sel.match(/src="([^"]+)"/);
      if (!m) return null;
      return scripts.find((s) => s.src === m[1]) ?? null;
    },
  };
}

function fakeStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string): string | null => m.get(k) ?? null,
    setItem: (k: string, v: string): void => {
      m.set(k, String(v));
    },
    removeItem: (k: string): void => {
      m.delete(k);
    },
  };
}

function installDom(href = 'https://ranklock.app/heroes') {
  const win = Object.assign(new EventTarget(), { location: { href } });
  const doc = fakeDocument();
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', doc);
  vi.stubGlobal('localStorage', fakeStorage());
  return { win, doc };
}

function configure(url = 'https://m.example.test', siteId = '2'): void {
  vi.stubEnv('PUBLIC_MATOMO_URL', url);
  vi.stubEnv('PUBLIC_MATOMO_SITE_ID', siteId);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('consent store — the gate signal', () => {
  it('nothing stored → DENIED, so the banner re-asks and nothing tracks', async () => {
    installDom();
    const { getConsent, hasDecided } = await import('./consent');
    expect(getConsent()).toMatchObject({ decided: false, analytics: false });
    expect(hasDecided()).toBe(false);
  });

  it('rejectAll → the choice is recorded but analytics stays off', async () => {
    installDom();
    const { rejectAll, getConsent, hasDecided } = await import('./consent');
    rejectAll();
    expect(getConsent().analytics).toBe(false);
    expect(hasDecided()).toBe(true);
  });

  it('acceptAll → analytics on, with a decision timestamp', async () => {
    installDom();
    const { acceptAll, getConsent } = await import('./consent');
    const s = acceptAll();
    expect(s.analytics).toBe(true);
    expect(typeof s.ts).toBe('string');
    expect(getConsent().analytics).toBe(true);
  });

  it('a stored record from an unknown version → DENIED (stale schema never honored)', async () => {
    installDom();
    const { getConsent, STORAGE_KEY } = await import('./consent');
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 99, decided: true, analytics: true, ts: 'x' }));
    expect(getConsent()).toMatchObject({ decided: false, analytics: false });
  });

  it('onConsentChange broadcasts the new state to live listeners', async () => {
    installDom();
    const { onConsentChange, acceptAll } = await import('./consent');
    const seen: boolean[] = [];
    const off = onConsentChange((s) => seen.push(s.analytics));
    acceptAll();
    off();
    expect(seen).toEqual([true]);
  });
});

describe('matomo loader — matomo.js injected only on a grant', () => {
  it('env unset → matomoConfigured false and enableMatomo is inert', async () => {
    const { doc } = installDom();
    configure('', '');
    const { matomoConfigured, enableMatomo } = await import('./tracking');
    expect(matomoConfigured()).toBe(false);
    enableMatomo();
    expect(doc.scripts).toHaveLength(0);
    expect(window._paq ?? []).toHaveLength(0);
  });

  it('importing the loader without a grant injects nothing (reject stays silent)', async () => {
    const { doc } = installDom();
    configure();
    await import('./tracking');
    expect(doc.scripts).toHaveLength(0);
  });

  it('enableMatomo → matomo.js injected once, consent + pageview queued', async () => {
    const { doc } = installDom('https://ranklock.app/');
    configure('https://m.example.test', '2');
    const { enableMatomo } = await import('./tracking');
    enableMatomo();
    enableMatomo();
    expect(doc.scripts.map((s) => s.src)).toEqual(['https://m.example.test/matomo.js']);
    const cmds = (window._paq ?? []).map((c) => c[0]);
    expect(cmds).toContain('requireConsent');
    expect(cmds).toContain('rememberConsentGiven');
    expect(cmds).toContain('trackPageView');
    expect(window._paq ?? []).toContainEqual(['setSiteId', '2']);
    expect(window._paq ?? []).toContainEqual(['setTrackerUrl', 'https://m.example.test/matomo.php']);
  });

  it('a trailing slash on the base URL is normalized', async () => {
    const { doc } = installDom();
    configure('https://m.example.test///', '2');
    const { enableMatomo } = await import('./tracking');
    enableMatomo();
    expect(doc.scripts[0]?.src).toBe('https://m.example.test/matomo.js');
  });

  it('disableMatomo: no-op before init, withdraws consent after a grant', async () => {
    installDom();
    configure();
    const { enableMatomo, disableMatomo } = await import('./tracking');
    disableMatomo();
    expect(window._paq ?? []).toHaveLength(0);
    enableMatomo();
    disableMatomo();
    expect((window._paq ?? []).map((c) => c[0])).toContain('forgetConsentGiven');
  });

  it('trackRouteChange: silent before init, one pageview per new URL after a grant', async () => {
    const { win } = installDom('https://ranklock.app/a');
    configure();
    const t = await import('./tracking');
    t.trackRouteChange();
    expect(window._paq ?? []).toHaveLength(0);
    t.enableMatomo();
    const before = (window._paq ?? []).length;
    win.location.href = 'https://ranklock.app/b';
    t.trackRouteChange();
    const emitted = (window._paq ?? []).slice(before).map((c) => c[0]);
    expect(emitted).toContain('setReferrerUrl');
    expect(emitted).toContain('trackPageView');
    const afterFirst = (window._paq ?? []).length;
    t.trackRouteChange();
    expect((window._paq ?? []).length).toBe(afterFirst);
  });
});
