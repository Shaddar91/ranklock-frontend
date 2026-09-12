//Hero Build §4 — the published builds ranked by their upstream 30-day win rate, plus the rank
//bracket selector. The bracket is page state, never a URL: one URL per intent (brief rule 7).
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../../lib/apiClient';
import { abilityOrderSequence, authorLabel, formatUpdated, isUpdatedThisPatch } from '../../../lib/buildMeta';
import { RANKED_BRACKETS, rankedBracketLabel } from '../../../lib/heroBuild';
import { count, DASH } from '../../../lib/format';
import QueryProvider from '../QueryProvider';
import SectionHeader from '../ui/SectionHeader';
import EmptyState from '../ui/EmptyState';
import type { CommunityBuild, RankedBracketKey, TrimmedBuild } from '../../../types/api';

export interface CommunityBuildsProps {
  heroId: number;
  initialBuilds: CommunityBuild[];
  //Ability id -> signature slot 1..4, so the first four points render as the hero's own keys.
  abilitySlots: Record<string, number>;
  currentPatchId: string | null;
  nowSeconds: number;
}

type Selection = 'weekly' | RankedBracketKey;

//The weekly join and the ranked route both floor at 20 matches; the weekly one additionally
//asks upstream for lobbies at badge 80 and above (backend COMMUNITY_BADGE_FLOOR).
const WEEKLY_NOTE =
  'Trending across all ranks · win rate from deadlock-api.com hero-build-stats: lobby-average badge 80+ · trailing 30 days · min 20 matches';

interface Row {
  key: string;
  title: string;
  untitled: boolean;
  author: string;
  categories: number;
  winRate: number | null;
  matches: number | null;
  weekly: number | null;
  points: number[];
  updated: string;
  thisPatch: boolean;
}

export default function CommunityBuilds(props: CommunityBuildsProps) {
  return (
    <QueryProvider>
      <Table {...props} />
    </QueryProvider>
  );
}

function Table({ heroId, initialBuilds, abilitySlots, currentPatchId, nowSeconds }: CommunityBuildsProps) {
  const [selection, setSelection] = useState<Selection>('weekly');
  const ranked = selection !== 'weekly';

  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.heroRankedBuilds(heroId, selection),
    queryFn: () => api.getRankedBuilds(heroId, selection),
    enabled: ranked,
    staleTime: 30 * 60_000,
  });

  const rows = useMemo(() => {
    const toRow = (b: TrimmedBuild, winRate: number | null, matches: number | null, author: string): Row => ({
      key: String(b.hero_build_id),
      title: b.name?.trim() || author,
      untitled: !b.name?.trim(),
      author,
      categories: b.categories.length,
      winRate,
      matches,
      weekly: b.num_weekly_favorites,
      points: abilityOrderSequence(b.ability_order)
        .slice(0, 4)
        .map((id) => abilitySlots[String(id)] ?? 0),
      updated: formatUpdated(b.last_updated_timestamp, nowSeconds),
      thisPatch: isUpdatedThisPatch(b.last_updated_timestamp, currentPatchId),
    });
    if (!ranked) {
      return initialBuilds.map((b) =>
        toRow(b, b.win_rate_30d == null ? null : b.win_rate_30d * 100, b.matches, authorLabel(b)),
      );
    }
    return (data?.builds ?? []).map((b) => toRow(b, b.win_rate * 100, b.matches, authorLabel(b)));
  }, [ranked, data, initialBuilds, abilitySlots, currentPatchId, nowSeconds]);

  const note = ranked
    ? data
      ? `${data.source} · ${data.window} · min ${data.min_matches} matches · sorted by Wilson lower bound`
      : 'deadlock-api.com hero-build-stats — lobby-average badge · trailing 30 days · min 20 matches'
    : WEEKLY_NOTE;

  return (
    <section id="community">
      <SectionHeader kicker="Which published build actually wins" title="Community builds" note={note} />
      <div className="bp-brackets" role="group" aria-label="Rank bracket">
        <button
          type="button"
          className={selection === 'weekly' ? 'bp-brk on' : 'bp-brk'}
          aria-pressed={selection === 'weekly'}
          onClick={() => setSelection('weekly')}
        >
          Trending
        </button>
        {RANKED_BRACKETS.map((option) => (
          <button
            type="button"
            key={option.key}
            className={selection === option.key ? 'bp-brk on' : 'bp-brk'}
            aria-pressed={selection === option.key}
            onClick={() => setSelection(option.key)}
          >
            {rankedBracketLabel(option)}
          </button>
        ))}
      </div>

      {ranked && isPending ? (
        <EmptyState title="Loading" message="Fetching the builds that win in this bracket." />
      ) : ranked && isError ? (
        <EmptyState title="Unavailable" message="The bracket list could not be fetched. Trending is still above." />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No build clears the floor"
          message="No published build in this bracket has 20 matches at a lobby-average badge inside it. Nothing from a neighbouring bracket is shown in its place."
        />
      ) : (
        <div className="panel bp-table">
          <div className="bp-brow bp-bhead">
            <span className="label-xs">Build</span>
            <span className="label-xs num">30d WR</span>
            <span className="label-xs num">Matches</span>
            <span className="label-xs num">Weekly ♥</span>
            <span className="label-xs">First 4 points</span>
            <span className="label-xs num">Updated</span>
          </div>
          {rows.map((r) => (
            <div className="bp-brow" key={r.key}>
              <span className="bp-btitle">
                <span className={r.untitled ? 'display bp-bname bp-bname-untitled' : 'display bp-bname'}>{r.title}</span>
                <span className="bp-bby">
                  by {r.author} · {r.categories} categories
                </span>
              </span>
              <span
                className="tnum num"
                style={r.winRate == null ? undefined : { color: r.winRate >= 50 ? 'var(--win)' : 'var(--loss)' }}
              >
                {r.winRate == null ? DASH : `${r.winRate.toFixed(1)}%`}
              </span>
              <span className="tnum num muted">{count(r.matches)}</span>
              <span className="tnum num muted">{count(r.weekly)}</span>
              <span className="bp-points">
                {r.points.length === 0 ? (
                  <span className="muted">—</span>
                ) : (
                  r.points.map((slot, i) => (
                    <span className={`kit-key k${slot}`} key={i}>
                      {slot || '?'}
                    </span>
                  ))
                )}
              </span>
              <span className={r.thisPatch ? 'bp-upd bp-upd-now' : 'bp-upd'}>
                {r.thisPatch ? 'This patch' : r.updated}
              </span>
            </div>
          ))}
          {ranked && rows.length < 3 && (
            <p className="bp-thin">
              Fewer than 3 builds clear the floor in this bracket — lobby-average badge, 20 matches. The rows above are
              every one that does; no build from another bracket is padded in.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
