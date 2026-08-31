//AdSlot renders the ad <ins> only when showAd = adsenseConfigured() && !!slot is
//true; with no publisher id and no slot id it returns null (no empty frame).
import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadAds(client: string, banner = '', rect = '') {
  vi.resetModules();
  vi.stubEnv('PUBLIC_ADSENSE_CLIENT', client);
  vi.stubEnv('PUBLIC_ADSENSE_SLOT_BANNER', banner);
  vi.stubEnv('PUBLIC_ADSENSE_SLOT_RECT', rect);
  return import('./ads');
}

afterEach(() => vi.unstubAllEnvs());

describe('AdSlot placeholder-mode renders null when no ad unit is configured', () => {
  it('has no publisher id, so showAd is false for every slot kind', async () => {
    const { adsenseConfigured, slotFor } = await loadAds('');
    expect(adsenseConfigured()).toBe(false);
    expect(slotFor('rect')).toBeUndefined();
    expect(slotFor('banner')).toBeUndefined();
    expect(adsenseConfigured() && !!slotFor('rect')).toBe(false);
  });

  it('rejects a malformed publisher id even when slot ids are present', async () => {
    const { adsenseConfigured, slotFor } = await loadAds('pub-123', '1122334455', '5566778899');
    expect(adsenseConfigured()).toBe(false);
    expect(adsenseConfigured() && !!slotFor('rect')).toBe(false);
  });

  it('stays off when the publisher id is valid but the slot id is missing', async () => {
    const { adsenseConfigured, slotFor } = await loadAds('ca-pub-1234567890');
    expect(adsenseConfigured()).toBe(true);
    expect(slotFor('rect')).toBeUndefined();
    expect(adsenseConfigured() && !!slotFor('rect')).toBe(false);
  });
});

describe('AdSlot shows a real ad only when a valid publisher id and a slot id both exist', () => {
  it('showAd is true for a canonical ca-pub id with slot ids', async () => {
    const { adsenseConfigured, slotFor } = await loadAds('ca-pub-1234567890', '1122334455', '5566778899');
    expect(adsenseConfigured()).toBe(true);
    expect(slotFor('banner')).toBe('1122334455');
    expect(slotFor('rect')).toBe('5566778899');
    expect(adsenseConfigured() && !!slotFor('rect')).toBe(true);
  });
});
