//Lab §14 — one row per purchase on a 0–40 minute track. The bar is the editorial slow…fast
//window, the dot the selected pace. "You" appears only for a signed-in player with a served curve.
import { GameIcon, ItemHoverCard, SectionHeader } from '../ui/index';
import { count } from '../../../lib/format';
import { overlayFromCatalog, type ItemOverlayData } from '../../../lib/itemOverlay';
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

function Track({ row }: { row: TimelineRow }) {
  const fast = trackPercent(row.fast);
  const slow = trackPercent(row.slow);
  const dot = trackPercent(row.at);
  const left = fast ?? 0;
  const width = slow == null ? (fast == null ? 0 : 100 - left) : Math.max(1, slow - left);

  return (
    <div
      style={{
        position: 'relative',
        height: 18,
        background: 'repeating-linear-gradient(90deg, var(--border) 0 1px, transparent 1px 25%)',
      }}
    >
      {fast != null && (
        <div
          style={{
            position: 'absolute',
            top: 5,
            left: `${left}%`,
            width: `${width}%`,
            height: 8,
            borderRadius: 2,
            background: 'color-mix(in oklab, var(--gold) 45%, transparent)',
          }}
          title={`Affordable between ${minuteLabel(row.fast)} (fast) and ${minuteLabel(row.slow)} (slow)`}
        />
      )}
      {dot != null && (
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: `${dot}%`,
            marginLeft: -6,
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: 'var(--cyan-bright)',
            border: '1px solid var(--ink)',
          }}
          title={minuteLabel(row.at)}
        />
      )}
      <span
        className="mono tnum"
        style={{ position: 'absolute', top: 1, left: `calc(${dot ?? 0}% + 10px)`, fontSize: 11, color: 'var(--text-2)', whiteSpace: 'nowrap' }}
      >
        {minuteLabel(row.at)}
      </span>
    </div>
  );
}

export default function SoulsTimeline({ rows, pace, onPace, ownCurveAvailable, window }: SoulsTimelineProps) {
  const paces = PACES.filter((p) => p.key !== 'you' || ownCurveAvailable);
  const grid = 'minmax(0, 200px) 86px minmax(0, 1fr)';

  if (rows.length === 0) return null;

  return (
    <section className="grid" style={{ gap: 10 }}>
      <SectionHeader
        kicker="When can I buy this"
        title="Souls timeline"
        note={`Bar = affordable between a fast (×${PACE_FAST} on the cost) and a slow (×${PACE_SLOW}) run at the median curve — both factors are editorial, not measured. Dot = the pace selected.`}
        action={
          <span className="tabs" role="group" aria-label="Farm pace">
            {paces.map((p) => (
              <button
                key={p.key}
                type="button"
                className={'tab' + (pace === p.key ? ' on' : '')}
                style={{ padding: '3px 10px', fontSize: 12 }}
                title={p.hint}
                onClick={() => onPace(p.key)}
              >
                {p.label}
              </button>
            ))}
          </span>
        }
      />
      <div className="panel" style={{ padding: '4px 13px 12px' }}>
        <div className="grid" style={{ gridTemplateColumns: grid, gap: 13, padding: '8px 0 6px' }}>
          <span className="label-xs">Slot</span>
          <span className="label-xs" style={{ textAlign: 'right' }}>Total souls</span>
          <span className="between mono tnum faint" style={{ fontSize: 10 }}>
            {TIMELINE_TICKS.map((t) => (
              <span key={t}>{t === TIMELINE_MINUTES ? `${t} min` : t}</span>
            ))}
          </span>
        </div>
        {rows.map((row) => (
          <div
            key={`${row.pos}-${row.itemId}`}
            className="grid"
            style={{ gridTemplateColumns: grid, gap: 13, alignItems: 'center', padding: '5px 0', borderTop: '1px solid var(--border)' }}
          >
            <ItemHoverCard data={row.item ? overlayFromCatalog(row.item) : bareOverlay(row.itemId, row.name)}>
              <span className="flex" style={{ alignItems: 'center', gap: 8, minWidth: 0 }}>
                <GameIcon kind="item" name={row.name} src={row.item?.icon} size={26} />
                <span className="display" style={{ fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {row.name}
                </span>
              </span>
            </ItemHoverCard>
            <span className="mono tnum amber-c" style={{ fontSize: 12, textAlign: 'right' }}>{count(row.cum)}</span>
            <Track row={row} />
          </div>
        ))}
        <p className="faint" style={{ fontSize: 11.5, margin: 0, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          {window}
          {ownCurveAvailable
            ? ' · "You" reads your own per-minute souls curve from your profile.'
            : ''}
        </p>
      </div>
    </section>
  );
}
