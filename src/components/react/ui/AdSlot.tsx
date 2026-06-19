//On-brand sponsor placeholder + "go ad-free" supporter hook. This is the styled
//SLOT only — the consent-gated AdSense fill is wired separately (consent layer).
//Until then it renders this gaslamp placeholder, never an empty/janky gap.
import Icon from './Icon';

type AdKind = 'banner' | 'rect' | 'leaderboard';

const AD_SIZE: Record<AdKind, string> = {
  banner: '970 × 90',
  rect: '300 × 250',
  leaderboard: '728 × 90',
};

interface AdSlotProps {
  kind?: AdKind;
  supportHref?: string;
}

export default function AdSlot({ kind = 'banner', supportHref = '/support' }: AdSlotProps) {
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
