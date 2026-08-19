//Ad / sponsor slot. With a publisher id + ad-unit slot id configured it loads
//the AdSense fill — ads consent is gathered by Google's certified CMP inside
//adsbygoogle.js, not by the site banner. Without a slot id it renders the placeholder.
import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import Icon from './Icon';
import { adsenseClient, adsenseConfigured, enableAds, pushAd, slotFor } from '../../../lib/ads';
import type { AdKind } from '../../../lib/ads';

const AD_SIZE: Record<AdKind, string> = {
  banner: '970 × 90',
  rect: '300 × 250',
  leaderboard: '728 × 90',
  skyscraper: '160 × 600',
};

const AD_FORMAT: Record<AdKind, string> = {
  banner: 'horizontal',
  rect: 'rectangle',
  leaderboard: 'horizontal',
  skyscraper: 'vertical',
};

//width:100% keeps the ins from collapsing to 0 inside flex-centered wrappers.
const AD_STYLE: Record<AdKind, CSSProperties> = {
  banner: { display: 'block', width: '100%' },
  leaderboard: { display: 'block', width: '100%' },
  rect: { display: 'block', width: '100%', maxWidth: 336 },
  skyscraper: { display: 'block', width: '100%', maxWidth: 200 },
};

interface AdSlotProps {
  kind?: AdKind;
  adSlot?: string;
}

export default function AdSlot({ kind = 'banner', adSlot }: AdSlotProps) {
  const slot = adSlot ?? slotFor(kind);
  const showAd = adsenseConfigured() && !!slot;

  useEffect(() => {
    if (!showAd) return;
    if (!enableAds()) return;
    pushAd();
  }, [showAd]);

  if (showAd) {
    return (
      <ins
        className="adsbygoogle promo-ad"
        style={AD_STYLE[kind]}
        data-ad-client={adsenseClient()}
        data-ad-slot={slot}
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
    </div>
  );
}
