//Consent-gated ad / sponsor slot. Until the visitor grants the "ads/marketing"
//consent category (lib/consent) this renders the on-brand gaslamp placeholder +
//"go ad-free" supporter hook — never an empty/janky gap, and crucially NO
//AdSense network call. Once ads-consent is granted AND a publisher id + ad-unit
//slot id are configured, it loads the AdSense fill instead. Consent Mode v2
//posture is owned by TrackingProvider; this island grants the ad signal and
//loads the fill only when consent allows (lib/ads).
import { useEffect, useState } from 'react';
import Icon from './Icon';
import { getConsent, onConsentChange } from '../../../lib/consent';
import { adsenseClient, adsenseConfigured, enableAds, pushAd } from '../../../lib/ads';

type AdKind = 'banner' | 'rect' | 'leaderboard' | 'skyscraper';

const AD_SIZE: Record<AdKind, string> = {
  banner: '970 × 90',
  rect: '300 × 250',
  leaderboard: '728 × 90',
  skyscraper: '160 × 600',
};

//Our semantic slot kind → an AdSense responsive format.
const AD_FORMAT: Record<AdKind, string> = {
  banner: 'horizontal',
  rect: 'rectangle',
  leaderboard: 'horizontal',
  skyscraper: 'vertical',
};

interface AdSlotProps {
  kind?: AdKind;
  supportHref?: string;
  //AdSense ad-unit slot id (data-ad-slot). Omit while ad units aren't minted yet
  //— the placeholder shows until consent AND a publisher id AND a slot id exist.
  adSlot?: string;
}

export default function AdSlot({ kind = 'banner', supportHref = '/support', adSlot }: AdSlotProps) {
  const [adsAllowed, setAdsAllowed] = useState(false);

  useEffect(() => {
    setAdsAllowed(getConsent().ads);
    return onConsentChange((s) => setAdsAllowed(s.ads));
  }, []);

  //Show a real ad only when consent is granted, a publisher id is configured, and
  //a concrete ad-unit slot id was supplied — otherwise the gaslamp placeholder.
  const showAd = adsAllowed && adsenseConfigured() && !!adSlot;

  useEffect(() => {
    if (!showAd) return;
    if (!enableAds()) return;
    pushAd();
  }, [showAd]);

  if (showAd) {
    return (
      <ins
        className="adsbygoogle promo-ad"
        style={{ display: 'block' }}
        data-ad-client={adsenseClient()}
        data-ad-slot={adSlot}
        data-ad-format={AD_FORMAT[kind]}
        data-full-width-responsive="true"
        aria-label="Advertisement"
      />
    );
  }

  return (
    <div className={'promo ' + kind} role="complementary" aria-label="Sponsored">
      <span className="promo-tag">Sponsored</span>
      <div className="promo-body">
        <Icon name="bolt" size={kind === 'rect' ? 20 : 16} color="var(--faint)" />
        <span className="display" style={{ fontSize: kind === 'rect' ? 13 : 12 }}>
          Promo slot · {AD_SIZE[kind]}
        </span>
      </div>
      <a className="promo-support" href={supportHref}>
        <Icon name="flame" size={10} /> Go ad-free — support RankLock
      </a>
    </div>
  );
}
