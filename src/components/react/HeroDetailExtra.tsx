//Hero-detail interactive tabs (mount with client:visible on /heroes/:id).
//
//The hero entity header + headline stats are PRERENDERED in the .astro page (SEO
//without JS). This island carries only the deeper, interactive tiers — matchups
//and community builds — which fetch client-side and EMPTY-STATE until their
//endpoints serve (build-ahead, §8.1). Kept as ONE island, not many.
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../lib/apiClient';
import QueryProvider from './QueryProvider';
import { EmptyState, GameIcon, WinBar } from './ui/index';
import { count } from '../../lib/format';
import type { HeroItemWinRate, HeroSummary, HeroSynergyRow, MatchupEntry, TrimmedBuild } from '../../types/api';

type Tab = 'matchups' | 'synergies' | 'items' | 'builds';

//Hero reference (id → name + icon) from GET /heroes — shared by the matchups and
//synergy grids so partner heroes render with their real name/portrait rather than
//"Hero 42". react-query dedupes this against the page's other /heroes reads.
function useHeroRef() {
  const { data } = useQuery<HeroSummary[]>({ queryKey: queryKeys.heroes(), queryFn: () => api.getHeroes() });
  return useMemo(() => {
    const m = new Map<number, HeroSummary>();
    (data ?? []).forEach((h) => m.set(h.hero_id, h));
    return m;
  }, [data]);
}

function MatchupsTab({ heroId }: { heroId: number }) {
  const heroRef = useHeroRef();
  const { data, isPending, isError } = useQuery<MatchupEntry[]>({
    queryKey: queryKeys.heroMatchups(heroId),
    queryFn: () => api.getHeroMatchups(heroId),
  });

  const nameOf = (id: number) => heroRef.get(id)?.hero_name ?? `Hero ${id}`;

  const rows = useMemo(() => [...(data ?? [])].sort((a, b) => b.win_rate - a.win_rate), [data]);

  if (isPending) return <p className="muted" style={{ padding: '14px 2px' }}>Loading matchups…</p>;
  if (isError || rows.length === 0) {
    return (
      <EmptyState
        title="Matchups not served yet"
        message="Per-bracket counter & synergy data comes online with the analytics pipeline."
        icon="swords"
      />
    );
  }
  return (
    <table className="dt" style={{ marginTop: 6 }}>
      <thead>
        <tr>
          <th><span className="th-static">Opponent</span></th>
          <th className="num"><span className="th-static">Win rate</span></th>
          <th className="num"><span className="th-static">Matches</span></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((m) => (
          <tr key={m.hero_b_id}>
            <td>
              <span className="display" style={{ fontWeight: 600, color: 'var(--text)' }}>vs {nameOf(m.hero_b_id)}</span>
            </td>
            <td className="num"><WinBar wr={m.win_rate <= 1 ? m.win_rate * 100 : m.win_rate} /></td>
            <td className="num"><span className="tnum">{count(m.matches)}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

//Synergy matrix (§A.4) — GET /heroes/:id/synergies. The backend returns pair rows
//(hero_id1, hero_id2); the partner is whichever side isn't this hero. Win rate is
//derived from wins/matches_played. Empty-states until the upstream serves.
function SynergiesTab({ heroId }: { heroId: number }) {
  const heroRef = useHeroRef();
  const { data, isPending, isError } = useQuery<HeroSynergyRow[]>({
    queryKey: queryKeys.heroSynergies(heroId),
    queryFn: () => api.getHeroSynergies(heroId),
  });

  const rows = useMemo(() => {
    return [...(data ?? [])]
      .map((r) => {
        const partnerId = r.hero_id1 === heroId ? r.hero_id2 : r.hero_id1;
        const winRate = r.matches_played > 0 ? (r.wins / r.matches_played) * 100 : null;
        return { partnerId, matches: r.matches_played, winRate };
      })
      .filter((r) => r.matches > 0)
      .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0));
  }, [data, heroId]);

  if (isPending) return <p className="muted" style={{ padding: '14px 2px' }}>Loading synergies…</p>;
  if (isError || rows.length === 0) {
    return (
      <EmptyState
        title="Synergies not served yet"
        message="Best-duo win-rates come online with the analytics pipeline."
        icon="users"
      />
    );
  }
  return (
    <table className="dt" style={{ marginTop: 6 }}>
      <thead>
        <tr>
          <th><span className="th-static">Duo partner</span></th>
          <th className="num"><span className="th-static">Win rate</span></th>
          <th className="num"><span className="th-static">Matches</span></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const partner = heroRef.get(r.partnerId);
          return (
            <tr key={r.partnerId}>
              <td>
                <div className="flex" style={{ alignItems: 'center', gap: 10 }}>
                  <GameIcon kind="hero" name={partner?.hero_name ?? `Hero ${r.partnerId}`} src={partner?.icon_url} size={28} />
                  <span className="display" style={{ fontWeight: 600, color: 'var(--text)' }}>
                    with {partner?.hero_name ?? `Hero ${r.partnerId}`}
                  </span>
                </div>
              </td>
              <td className="num">{r.winRate == null ? <span className="faint">—</span> : <WinBar wr={r.winRate} />}</td>
              <td className="num"><span className="tnum">{count(r.matches)}</span></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

//Best items by win rate (rich-analytics tier) — GET /heroes/:id/item-win-rates.
//Hero-scoped item win-rates the API serves; sorted best-first, normalized 0..1 or
//0..100 like the matchups win rate. Empty-states (202/501 build-ahead) until served.
function ItemsTab({ heroId }: { heroId: number }) {
  const { data, isPending, isError } = useQuery<HeroItemWinRate[]>({
    queryKey: queryKeys.heroItemWinRates(heroId),
    queryFn: () => api.getHeroItemWinRates(heroId),
    retry: false,
  });

  const rows = useMemo(
    () =>
      [...(data ?? [])]
        .filter((r) => r.win_rate != null)
        .sort((a, b) => (b.win_rate ?? 0) - (a.win_rate ?? 0))
        .slice(0, 20),
    [data],
  );

  if (isPending) return <p className="muted" style={{ padding: '14px 2px' }}>Loading item win-rates…</p>;
  if (isError || rows.length === 0) {
    return (
      <EmptyState
        title="Item win-rates not served yet"
        message="Best items by win rate come online with the analytics pipeline."
        icon="book"
      />
    );
  }
  return (
    <table className="dt" style={{ marginTop: 6 }}>
      <thead>
        <tr>
          <th><span className="th-static">Item</span></th>
          <th className="num"><span className="th-static">Win rate</span></th>
          <th className="num"><span className="th-static">Matches</span></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const wr = r.win_rate as number;
          return (
            <tr key={r.item_id}>
              <td>
                <div className="flex" style={{ alignItems: 'center', gap: 10 }}>
                  <GameIcon kind="item" name={r.item_name ?? `Item ${r.item_id}`} src={r.icon_url} size={28} />
                  <span className="display" style={{ fontWeight: 600, color: 'var(--text)' }}>
                    {r.item_name ?? `Item ${r.item_id}`}
                  </span>
                </div>
              </td>
              <td className="num"><WinBar wr={wr <= 1 ? wr * 100 : wr} /></td>
              <td className="num"><span className="tnum">{count(r.matches)}</span></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function BuildsTab({ heroId }: { heroId: number }) {
  const { data, isPending, isError } = useQuery<TrimmedBuild[]>({
    queryKey: queryKeys.heroBuilds(heroId),
    queryFn: () => api.getHeroBuilds(heroId),
  });
  const rows = data ?? [];
  if (isPending) return <p className="muted" style={{ padding: '14px 2px' }}>Loading builds…</p>;
  if (isError || rows.length === 0) {
    return (
      <EmptyState
        title="Builds not served yet"
        message="Top community builds surface here once the builds endpoint is wired."
        icon="book"
      />
    );
  }
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: '8px 0' }}>
      {rows.slice(0, 12).map((b, i) => (
        <li key={`${b.name}-${i}`} className="statrow">
          <span className="display" style={{ fontWeight: 600, color: 'var(--text)' }}>{b.name}</span>
          <span className="mono" style={{ fontSize: 12, color: 'var(--gold)' }}>
            ♥ {count(b.num_favorites)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function HeroDetailExtraInner({ heroId }: { heroId: number }) {
  const [tab, setTab] = useState<Tab>('matchups');
  return (
    <div>
      <div className="tabs" role="tablist" aria-label="Hero detail">
        <button type="button" role="tab" aria-selected={tab === 'matchups'} className={'tab' + (tab === 'matchups' ? ' on' : '')} onClick={() => setTab('matchups')}>
          Matchups
        </button>
        <button type="button" role="tab" aria-selected={tab === 'synergies'} className={'tab' + (tab === 'synergies' ? ' on' : '')} onClick={() => setTab('synergies')}>
          Synergies
        </button>
        <button type="button" role="tab" aria-selected={tab === 'items'} className={'tab' + (tab === 'items' ? ' on' : '')} onClick={() => setTab('items')}>
          Best items
        </button>
        <button type="button" role="tab" aria-selected={tab === 'builds'} className={'tab' + (tab === 'builds' ? ' on' : '')} onClick={() => setTab('builds')}>
          Builds
        </button>
      </div>
      <div style={{ paddingTop: 8 }}>
        {tab === 'matchups' && <MatchupsTab heroId={heroId} />}
        {tab === 'synergies' && <SynergiesTab heroId={heroId} />}
        {tab === 'items' && <ItemsTab heroId={heroId} />}
        {tab === 'builds' && <BuildsTab heroId={heroId} />}
      </div>
    </div>
  );
}

export default function HeroDetailExtra({ heroId }: { heroId: number }) {
  return (
    <QueryProvider>
      <HeroDetailExtraInner heroId={heroId} />
    </QueryProvider>
  );
}
