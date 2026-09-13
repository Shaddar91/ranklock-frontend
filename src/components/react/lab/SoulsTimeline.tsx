//Lab §14 — one row per purchase on a 0–40 minute track, on every tab. The bar is the editorial
//slow…fast window, the dot the selected pace. "You" appears only for a signed-in player with a
//served curve.
import { GameIcon, ItemHoverCard, SectionHeader } from '../ui/index';
import { count } from '../../../lib/format';
import { overlayFromCatalog, type ItemOverlayData } from '../../../lib/itemOverlay';
import { catClass } from '../../../lib/itemDetail';
import { PACE_FAST, PACE_SLOW, type AffordableAt } from '../../../lib/labCalc';
import { TIMELINE_MINUTES, TIMELINE_TICKS, trackPercent, type TimelinePace, type TimelineRow } from './createModel';

const PACES: { key: TimelinePace; label: string; hint: string }[] = [
  { key: 'p25', label: 'Slow · p25', hint: 'The 25th-percentile souls curve of the served cohort' },
  { key: 'p50', label: 'Median · p50', hint: 'The median souls curve of the served cohort' },
  { key: 'p75', label: 'Fast · p75', hint: 'The 75th-percentile souls curve of the served cohort' },
  { key: 'you', label: 'You', hint: 'Your own per-minute souls curve from your profile' },
];

interface SoulsTimelineProps {
  rows: TimelineRow[];
  pace: TimelinePace;
  onPace: (pace: TimelinePace) => void;
  //omitted from the switch entirely when the viewer is signed out or serves no curve.
  ownCurveAvailable: boolean;
  window: string;
}

function bareOverlay(itemId: number, name: string): ItemOverlayData {
  return {
    id: itemId,
    name,
    icon: null,
    slot: null,
    tier: null,
    cost: null,
    brawl: false,
    modifiers: [],
    upgradesFrom: [],
    upgradesInto: [],
    cooldown: null,
    ability: null,
  };
}

function minuteLabel(at: AffordableAt | null): string {
  if (at == null) return 'past 40′';
  const total = Math.round(at.tSeconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function Track({ row, pace }: { row: TimelineRow; pace: TimelinePace }) {
  const fast = trackPercent(row.fast);
  const slow = trackPercent(row.slow);
  const dot = trackPercent(row.at);
  const left = fast ?? 0;
  const width = slow == null ? (fast == null ? 0 : 100 - left) : Math.max(1, slow - left);

  return (
    <div className="lab-tltrack">
      {fast != null && (
        <div
          className="lab-tlbar"
          style={{ left: `${left}%`, width: `${width}%` }}
          title={`Affordable between ${minuteLabel(row.fast)} (fast) and ${minuteLabel(row.slow)} (slow)`}
        />
      )}
      {dot != null && (
        <span
          className={pace === 'you' ? 'lab-tldot you' : 'lab-tldot'}
          style={{ left: `${dot}%` }}
          title={minuteLabel(row.at)}
        />
      )}
      <span className="lab-tlat" style={{ left: `calc(${dot ?? 0}% + 10px)` }}>{minuteLabel(row.at)}</span>
    </div>
  );
}

export default function SoulsTimeline({ rows, pace, onPace, ownCurveAvailable, window }: SoulsTimelineProps) {
  const paces = PACES.filter((p) => p.key !== 'you' || ownCurveAvailable);

  if (rows.length === 0) return null;

  return (
    <section>
      <SectionHeader
        kicker="When can I buy this"
        title="Souls timeline"
        note={`Bar = affordable between a fast (×${PACE_FAST} on the cost) and a slow (×${PACE_SLOW}) run · dot = the pace selected`}
        action={
          <span className="lab-seg" role="group" aria-label="Farm pace">
            {paces.map((p) => (
              <button
                key={p.key}
                type="button"
                className={pace === p.key ? 'on' : undefined}
                title={p.hint}
                onClick={() => onPace(p.key)}
              >
                {p.label}
              </button>
            ))}
          </span>
        }
      />
      <div className="lab-card lab-tlcard">
        <div className="lab-tlrow lab-tlhead">
          <span>Slot</span>
          <span>Total souls</span>
          <span className="lab-tlticks">
            {TIMELINE_TICKS.map((t) => (
              <span key={t}>{t === TIMELINE_MINUTES ? `${t} min` : t}</span>
            ))}
          </span>
        </div>
        {rows.map((row) => (
          <div key={`${row.pos}-${row.itemId}`} className="lab-tlrow">
            <ItemHoverCard data={row.item ? overlayFromCatalog(row.item) : bareOverlay(row.itemId, row.name)}>
              <span className={`lab-tlname lab-itile ${catClass(row.item?.item_slot_type)}`}>
                <GameIcon kind="item" name={row.name} src={row.item?.icon} size={26} />
                <span className="nm">{row.name}</span>
              </span>
            </ItemHoverCard>
            <span className="lab-tlcum tnum">{count(row.cum)}</span>
            <Track row={row} pace={pace} />
          </div>
        ))}
        <p className="lab-tlfoot">
          {window}
          {ownCurveAvailable ? ' · "You" reads your own per-minute souls curve from your profile.' : ''}
        </p>
      </div>
    </section>
  );
}
