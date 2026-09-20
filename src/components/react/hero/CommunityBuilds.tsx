//Hero Build §4 / Build Lab §13: the published builds ranked by their upstream 30-day win rate.
//One island, two mount points: the Build page reads the ranked route (one upstream sample, no
//bracket choice), the lab mount reads weekly and adds the per-row Import.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../../lib/apiClient';
import { abilityOrderSequence, authorLabel, patchesAgo } from '../../../lib/buildMeta';
import { tierSpanLabel } from '../../../lib/brackets';
import { printableBuildName } from '../../../lib/heroPlay';
import { count, DASH } from '../../../lib/format';
import QueryProvider from '../QueryProvider';
import SectionHeader from '../ui/SectionHeader';
import EmptyState from '../ui/EmptyState';
import AbilityGlyph from '../ui/AbilityGlyph';
import type {
  CommunityBuild,
  Patch,
  RankedBracketInfo,
  RankedBracketKey,
  RankedBuildsResponse,
  TrimmedBuild,
} from '../../../types/api';

export interface CommunityBuildsProps {
  heroId: number;
  initialBuilds: CommunityBuild[];
  //Ability id -> signature slot 1..4, so the first four points render as the hero's own keys.
  abilitySlots: Record<string, number>;
  //Ability id -> glyph; absent, the chips print the key number.
  abilityIcons?: Record<string, string | null>;
  patches: Pick<Patch, 'released_at'>[];
  nowSeconds: number;
  //The ranked key the page bakes rows for, so the table renders its win-rate column in the
  //static HTML.
  initialSelection?: Selection;
  initialRanked?: RankedBuildsResponse | null;
  kicker?: string;
  //Off in the lab: the ranked read is the Build page's (04 §4).
  brackets?: boolean;
  //Supplied by the lab mount only; a row whose id never rode the wire cannot be imported.
  onImport?: (buildId: number) => void;
}

export type Selection = 'weekly' | RankedBracketKey;

//The weekly-favorites join scores only a handful of its rows, so the table cannot rank on
//the win-rate column here; the ranked route can.
const WEEKLY_NOTE = 'Trending across all ranks by weekly favorites · most rows carry no 30-day win rate';
const IMPORT_NOTE = 'Import opens the build in Analyze';

//Upstream keys its sample on the match's average rank; the served badge bounds name the span.
const spanLabel = (b: RankedBracketInfo): string =>
  tierSpanLabel([Math.floor(b.min_badge / 10), Math.floor(b.max_badge / 10)]);

interface Row {
  key: string;
  buildId: number;
  title: string;
  untitled: boolean;
  author: string;
  categories: number;
  winRate: number | null;
  matches: number | null;
  weekly: number | null;
  //the first four ability ids of the order
  points: number[];
  updated: string;
  thisPatch: boolean;
}

export default function CommunityBuilds(props: CommunityBuildsProps) {
  return (
    <QueryProvider>
      <CommunityBuildsTable {...props} />
    </QueryProvider>
  );
}

export function CommunityBuildsTable({
  heroId,
  initialBuilds,
  abilitySlots,
  abilityIcons,
  patches,
  nowSeconds,
  initialSelection = 'weekly',
  initialRanked = null,
  kicker = 'Which published build actually wins',
  brackets = true,
  onImport,
}: CommunityBuildsProps) {
  const selection: Selection = brackets ? initialSelection : 'weekly';
  const ranked = brackets && selection !== 'weekly';

  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.heroRankedBuilds(heroId, selection),
    queryFn: () => api.getRankedBuilds(heroId, selection),
    enabled: ranked,
    initialData: selection === initialSelection && initialRanked ? initialRanked : undefined,
    staleTime: 30 * 60_000,
  });

  const rows = useMemo(() => {
    //Trending carries the weekly favorite count, the ranked route the all-time one; a row
    //never mixes the two and the column header names the one it holds.
    const toRow = (b: TrimmedBuild, winRate: number | null, matches: number | null, author: string): Row => {
      const updated = patchesAgo(b.last_updated_timestamp, patches, nowSeconds);
      const printable = !!b.name?.trim() && printableBuildName(b.name);
      return {
        key: String(b.hero_build_id),
        buildId: b.hero_build_id,
        title: printable ? b.name!.trim() : author,
        untitled: !printable,
        author,
        categories: b.categories.length,
        winRate,
        matches,
        weekly: ranked ? b.num_favorites : b.num_weekly_favorites,
        points: abilityOrderSequence(b.ability_order).slice(0, 4),
        updated,
        thisPatch: updated === 'This patch',
      };
    };
    if (!ranked) {
      return initialBuilds.map((b) =>
        toRow(b, b.win_rate_30d == null ? null : b.win_rate_30d * 100, b.matches, authorLabel(b)),
      );
    }
    return (data?.builds ?? []).map((b) => toRow(b, b.win_rate * 100, b.matches, authorLabel(b)));
  }, [ranked, data, initialBuilds, patches, nowSeconds]);

  const base = ranked
    ? data
      ? `Real 30-day win rate, minimum ${data.min_matches} matches · Wilson lower bound breaks ties · deadlock-api.com hero-build-stats, upstream 30-day sample, matches averaging ${spanLabel(data.bracket)}`
      : 'Real 30-day win rate · deadlock-api.com hero-build-stats, upstream 30-day sample'
    : WEEKLY_NOTE;
  const note = onImport ? `${base} · ${IMPORT_NOTE}` : base;

  return (
    <section id="community">
      <SectionHeader kicker={kicker} title="Community builds" note={note} />

      {ranked && isPending ? (
        <EmptyState title="Loading" message="Fetching the builds that win." />
      ) : ranked && isError ? (
        <EmptyState title="Unavailable" message="The ranked build list could not be fetched. Trending is still above." />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No build clears the floor"
          message="No published build has 20 matches in the upstream 30-day sample."
        />
      ) : (
        <div className={onImport ? 'panel bp-table bp-table-import' : 'panel bp-table'}>
          <div className="bp-brow bp-bhead">
            <span className="label-xs">Build</span>
            <span className="label-xs num">30d WR</span>
            <span className="label-xs num">Matches</span>
            <span className="label-xs num">{ranked ? 'Favorites ♥' : 'Weekly ♥'}</span>
            <span className="label-xs">First 4 points</span>
            <span className="label-xs num">Updated</span>
            {onImport && <span aria-hidden="true" />}
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
                className="tnum num wr"
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
                  r.points.map((id, i) => {
                    const slot = abilitySlots[String(id)] ?? 0;
                    return (
                      <span className={`kit-key k${slot}`} key={i}>
                        <AbilityGlyph slot={slot} icon={abilityIcons?.[String(id)]} />
                      </span>
                    );
                  })
                )}
              </span>
              <span className={r.thisPatch ? 'bp-upd bp-upd-now' : 'bp-upd'}>{r.updated}</span>
              {onImport && (
                <button
                  type="button"
                  className="btn btn-ghost bp-import"
                  disabled={r.buildId <= 0}
                  aria-label={`Import ${r.title} into Analyze`}
                  onClick={() => onImport(r.buildId)}
                >
                  Import
                </button>
              )}
            </div>
          ))}
          {ranked && rows.length < 3 && (
            <p className="bp-thin">
              Fewer than 3 builds clear the 20-match floor in the upstream 30-day sample. The rows above are every
              one that does.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
