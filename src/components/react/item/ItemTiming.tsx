//Item detail §4 "When it is bought" — the 11-band purchase histogram with its quartile
//caption beside the win rate of the six coarser buy windows.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import QueryProvider from '../QueryProvider';
import { api, queryKeys } from '../../../lib/apiClient';
import { BUY_HISTOGRAM, BUY_WR_BANDS, foldTiming } from '../../../lib/itemDetail';
import { count, DASH } from '../../../lib/format';
import SectionHeader from '../ui/SectionHeader';
import EmptyState from '../ui/EmptyState';
import Skeleton from '../ui/Skeleton';
import WinBar from '../ui/WinBar';

export interface ItemTimingProps {
  itemId: number;
}

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
        data.p50 == null ? null : `median minute ${data.p50}`,
        data.p25 == null ? null : `p25 ${data.p25}`,
        data.p75 == null ? null : `p75 ${data.p75}`,
      ].filter(Boolean)
    : [];

  return (
    <section id="when-bought">
      <SectionHeader
        kicker="When to buy"
        title="When it is bought"
        note={
          data
            ? `Share of purchases by game minute · win rate = games where it was bought in that window · ${data.window} · ${data.source}`
            : 'Share of purchases by game minute · win rate = games where it was bought in that window'
        }
      />
      {isPending ? (
        <Skeleton height={220} />
      ) : isError || buckets.length === 0 ? (
        <EmptyState
          title="Computing"
          message="Purchase timing for this item has not been folded yet. This block refreshes hourly."
        />
      ) : (
        <div className="itemd-when">
          <div className="panel panel-pad">
            <div className="itemd-hist">
              {bars.map((b) => (
                <div className="itemd-bar" key={b.label}>
                  <span className="mono itemd-bar-share">{b.share >= 0.5 ? `${Math.round(b.share)}%` : ''}</span>
                  <div className="itemd-bar-track">
                    <i
                      className={b.share === peak ? 'itemd-bar-fill itemd-bar-peak' : 'itemd-bar-fill'}
                      style={{ height: `${peak > 0 ? (b.share / peak) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="mono itemd-bar-label">{b.label}</span>
                </div>
              ))}
            </div>
            <p className="itemd-hist-cap">
              Minute of purchase{quartiles.length > 0 ? ` · ${quartiles.join(' · ')}` : ''} ·{' '}
              {count(data.total_matches)} purchases
            </p>
          </div>

          <div className="panel itemd-wrwin">
            <div className="itemd-wrrow itemd-wrhead">
              <span className="label-xs">Bought at</span>
              <span className="label-xs num">Win rate</span>
              <span className="label-xs num">Games</span>
            </div>
            {rows.map((r) => (
              <div className="itemd-wrrow" key={r.label}>
                <span className="itemd-wrband">{r.label}</span>
                <span className="num">{r.winRate == null ? DASH : <WinBar wr={r.winRate} />}</span>
                <span className="tnum num muted">{r.matches === 0 ? DASH : count(r.matches)}</span>
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
