//The shared item hover card (design Lab §15), rendered inside a Tooltip: category-tinted
//header with icon, name, cost and slot · tier; the full modifier list; the Active / Passive
//block with its cooldown; "Upgrades from / into"; and the investment / resale footer.
//One card for every item tile in the app — mount it through ItemHoverCard.
import type { ItemOverlayData } from '../../../lib/itemOverlay';
import { slotName } from '../../../lib/itemDetail';
import { itemTierLabel } from '../../../lib/itemTiers';
import { count } from '../../../lib/format';
import GameIcon from './GameIcon';
import Chip from './Chip';
import type { UpgradeRef } from '../../../lib/itemOverlay';

function modValue(value: number, isPercent: boolean): string {
  const sign = value > 0 ? '+' : '';
  const v = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${sign}${v}${isPercent ? '%' : ''}`;
}

function UpgradeList({ label, refs }: { label: string; refs: UpgradeRef[] }) {
  return (
    <div className="itemcard-path">
      <span className="label-xs itemcard-pathlabel">{label}</span>
      <span className="itemcard-pathrefs">
        {refs.map((u) => (
          <span key={u.id} className="itemcard-pathref">
            <GameIcon kind="item" name={u.name} src={u.icon} size={16} />
            <span>{u.name}</span>
          </span>
        ))}
      </span>
    </div>
  );
}

export default function ItemOverlayCard({
  data,
  catalogPatch,
}: {
  data: ItemOverlayData;
  //Stamps the footer; omitted entirely when the served patch is unknown.
  catalogPatch?: string | null;
}) {
  const category = slotName(data.slot);
  const tier = data.brawl ? null : itemTierLabel(data.tier);
  const meta = [category, tier].filter(Boolean).join(' · ');
  const kind = data.ability?.active ? 'Active' : data.modifiers.length > 0 || data.ability ? 'Passive' : null;
  const text = data.ability?.desc ?? null;
  const passive = data.ability?.passive ?? null;
  const footer = data.brawl
    ? null
    : [
        data.cost != null && category ? `Adds ${count(data.cost)} to ${category} investment` : null,
        data.cost != null ? `sells for ${count(Math.round(data.cost / 2))} souls` : null,
        catalogPatch ? `catalog patch ${catalogPatch}` : null,
      ]
        .filter(Boolean)
        .join(' · ');

  return (
    <div className={`itemcard cat-${data.slot ?? 'flex'}`}>
      <div className="itemcard-head">
        <GameIcon kind="item" name={data.name} src={data.icon} size={44} />
        <div className="itemcard-id">
          <div className="display itemcard-name">{data.name}</div>
          <div className="itemcard-sub">
            {!data.brawl && data.cost != null && <span className="tnum itemcard-cost">{count(data.cost)} souls</span>}
            {meta && <span className="itemcard-meta">{meta}</span>}
          </div>
        </div>
        {data.brawl && <Chip>Street Brawl</Chip>}
      </div>

      <div className="itemcard-mods">
        {data.modifiers.length === 0 ? (
          <span className="faint">No modifiers in this catalog snapshot</span>
        ) : (
          data.modifiers.map((m, i) => (
            <div key={`${m.property_type}-${i}`} className="itemcard-mod">
              <span className="tnum itemcard-modv">{modValue(m.value, m.is_percent)}</span>
              <span>{m.label ?? m.property_type}</span>
            </div>
          ))
        )}
      </div>

      {(text || passive || data.ability?.imbue) && (
        <div className="itemcard-text">
          <div className="itemcard-texthead">
            <span className="label-xs itemcard-kind">{kind ?? 'Passive'}</span>
            <span className="itemcard-cd">
              {data.ability?.imbue && <span className="itemcard-imbue">Imbue</span>}
              {data.cooldown != null && <span className="tnum">{data.cooldown}s cooldown</span>}
            </span>
          </div>
          {text && <p className="itemcard-body">{text}</p>}
          {passive && passive !== text && (
            <p className="itemcard-body itemcard-passive">
              <span className="label-xs">Passive</span> {passive}
            </p>
          )}
        </div>
      )}

      {(data.upgradesFrom.length > 0 || data.upgradesInto.length > 0) && (
        <div className="itemcard-paths">
          {data.upgradesFrom.length > 0 && <UpgradeList label="Upgrades from" refs={data.upgradesFrom} />}
          {data.upgradesInto.length > 0 && <UpgradeList label="Upgrades into" refs={data.upgradesInto} />}
        </div>
      )}

      {data.brawl ? (
        <div className="itemcard-foot">Street Brawl shop only — its tier and souls cost are placeholders.</div>
      ) : (
        footer && <div className="itemcard-foot">{footer}</div>
      )}
    </div>
  );
}
