//Hero Build §3 left — the folded six-purchase sets. An island rather than SSR markup because
//every shop tile carries the app-wide item hover card, which needs a React root + QueryProvider.
import { overlayFromMeta, type OverlayMeta } from '../../../lib/itemOverlay';
import { count } from '../../../lib/format';
import type { SetRow } from '../../../lib/heroBuild';
import QueryProvider from '../QueryProvider';
import GameIcon from '../ui/GameIcon';
import AbilityGlyph from '../ui/AbilityGlyph';
import EmptyState from '../ui/EmptyState';
import ItemHoverCard from '../ui/ItemHoverCard';

export interface WinningSetsProps {
  sets: SetRow[];
  catalog: Record<string, OverlayMeta>;
  //Ability id -> signature slot 1..4: an ability point in a set renders as the hero's key chip.
  abilitySlots: Record<string, number>;
  //Ability id -> its glyph; the chip shows the key number when a hero serves none.
  abilityIcons?: Record<string, string | null>;
}

export default function WinningSets(props: WinningSetsProps) {
  return (
    <QueryProvider>
      <Table {...props} />
    </QueryProvider>
  );
}

function Table({ sets, catalog, abilitySlots, abilityIcons }: WinningSetsProps) {
  if (sets.length === 0) {
    return (
      <EmptyState tone="cold" title="Computing" message="No set has been folded for this hero yet. This block refreshes hourly." />
    );
  }
  return (
    <div className="panel bp-table">
      <div className="bp-srow bp-bhead">
        <span className="label-xs">Set</span>
        <span className="label-xs num">Games</span>
        <span className="label-xs num">WR</span>
        <span className="label-xs num">Wilson</span>
      </div>
      {sets.map((s, i) => (
        <div className="bp-srow" key={i}>
          <span className="bp-set">
            {s.entries.map((e, j) =>
              e.shopItem ? (
                <ItemHoverCard data={overlayFromMeta(e.itemId, catalog[String(e.itemId)])} asChild key={j}>
                  <a className="bp-tile" href={`/items/${e.itemId}/`} title={e.name}>
                    <GameIcon kind="item" name={e.name} src={e.iconUrl} size={30} />
                  </a>
                </ItemHoverCard>
              ) : (
                <span
                  className={`kit-key k${abilitySlots[String(e.itemId)] ?? 0}`}
                  title={`${e.name} — ability point`}
                  key={j}
                >
                  <AbilityGlyph slot={abilitySlots[String(e.itemId)] ?? 0} icon={abilityIcons?.[String(e.itemId)]} />
                </span>
              ),
            )}
          </span>
          <span className="mono tnum num muted">{count(s.games)}</span>
          <span className="mono tnum num wr" style={{ color: s.winRate >= 50 ? 'var(--win)' : 'var(--loss)' }}>
            {s.winRate.toFixed(1)}%
          </span>
          <span className="mono tnum num muted">{s.wilson.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}
