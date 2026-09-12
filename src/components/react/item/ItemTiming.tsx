//Item detail "When it is bought" — one card holding the 11-band purchase histogram with
//its quartile caption beside the win rate of the six coarser buy windows, as the design
//draws it.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import QueryProvider from '../QueryProvider';
import { api, queryKeys } from '../../../lib/apiClient';
import { BUY_HISTOGRAM, BUY_WR_BANDS, foldTiming, quartileClock } from '../../../lib/itemDetail';
import { count, DASH } from '../../../lib/format';
import SectionHeader from '../ui/SectionHeader';
import EmptyState from '../ui/EmptyState';
import Skeleton from '../ui/Skeleton';
import WinBar from '../ui/WinBar';

export interface ItemTimingProps {
  itemId: number;
}

//The design's tallest bar is 64px inside a 96px plot; every other bar scales against it.
const PEAK_BAR_PX = 64;

function TimingBlock({ itemId }: ItemTimingProps) {
  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.itemTiming(itemId),
    queryFn: () => api.getItemTiming(itemId),
    staleTime: 60 * 60_000,
  });

  const buckets = data?.buckets ?? [];
  const bars = useMemo(() => foldTiming(buckets, BUY_HISTOGRAM), [buckets]);
  const rows = useMemo(() => foldTiming(buckets, BUY_WR_BANDS), [buckets]);
  const peak = Math.max(0, ...bars.map((b) => b.share));

  const quartiles = data
    ? [
        data.p50 == null ? null : `median ${quartileClock(buckets, data.p50)}`,
        data.p25 == null ? null : `p25 ${quartileClock(buckets, data.p25)}`,
        data.p75 == null ? null : `p75 ${quartileClock(buckets, data.p75)}`,
      ].filter(Boolean)
    : [];

  return (
    <section id="when-bought">
      <SectionHeader
        kicker="When to buy"
        title="When it is bought"
        note="Share of purchases by game minute · WR = games where it was bought in that window"
      />
      {isPending ? (
        <Skeleton height={220} />
      ) : isError || buckets.length === 0 ? (
        <EmptyState
          tone="cold"
          title="Computing"
          message="Purchase timing for this item has not been folded yet. This block refreshes hourly."
        />
      ) : (
        <div className="itemd-card itemd-pad itemd-when">
          <div>
            <div className="itemd-hist">
              {bars.map((b) => (
                <div className="itemd-bar" key={b.label}>
                  <span className="mono itemd-bar-share">{b.share >= 0.5 ? `${Math.round(b.share)}%` : ''}</span>
                  <i
                    className={b.share === peak ? 'itemd-bar-fill itemd-bar-peak' : 'itemd-bar-fill'}
                    style={{ height: `${peak > 0 ? Math.round((b.share / peak) * PEAK_BAR_PX) : 0}px` }}
                  />
                </div>
              ))}
            </div>
            <div className="itemd-hist-axis">
              {bars.map((b) => (
                <span className="mono itemd-bar-label" key={b.label}>
                  {b.label}
                </span>
              ))}
            </div>
            <p className="itemd-hist-cap">
              minute of purchase{quartiles.length > 0 ? ` · ${quartiles.join(' · ')}` : ''}
            </p>
          </div>

          <div>
            <div className="itemd-wrrow itemd-wrhead">
              <span>Bought at</span>
              <span>Win rate</span>
              <span>Games</span>
            </div>
            {rows.map((r) => (
              <div className="itemd-wrrow" key={r.label}>
                <span className="mono itemd-wrband">{r.label}</span>
                <span>{r.winRate == null ? DASH : <WinBar wr={r.winRate} flex />}</span>
                <span className="mono tnum muted">{r.matches === 0 ? DASH : count(r.matches)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default function ItemTiming(props: ItemTimingProps) {
  return (
    <QueryProvider>
      <TimingBlock {...props} />
    </QueryProvider>
  );
}
