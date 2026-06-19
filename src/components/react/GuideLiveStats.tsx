//Live-stat chip strip for a guide/blog post (mount with client:visible).
//
//The "guides fused with live stats" differentiator (requirements §B.11): a post
//declares the heroes/items it references in front-matter; this island fetches
//the CURRENT win-rates and renders LiveStatChips, so a guide never goes stale.
//Build-ahead: if the API is offline or an entity isn't matched, it falls back to
//a plain name chip — the guide still reads, just without the live number.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../lib/apiClient';
import QueryProvider from './QueryProvider';
import { Chip, LiveStatChip } from './ui/index';
import type { HeroSummary, ItemStat } from '../../types/api';

interface GuideLiveStatsProps {
  heroes?: string[];
  items?: string[];
}

const norm = (s: string) => s.trim().toLowerCase();

function GuideLiveStatsInner({ heroes = [], items = [] }: GuideLiveStatsProps) {
  const wantHeroes = heroes.length > 0;
  const wantItems = items.length > 0;

  const { data: heroData } = useQuery<HeroSummary[]>({
    queryKey: queryKeys.heroes(),
    queryFn: () => api.getHeroes(),
    enabled: wantHeroes,
  });
  const { data: itemData } = useQuery<ItemStat[]>({
    queryKey: queryKeys.items(0),
    queryFn: () => api.getItems(),
    enabled: wantItems,
  });

  const heroByName = useMemo(() => {
    const m = new Map<string, HeroSummary>();
    (heroData ?? []).forEach((h) => m.set(norm(h.hero_name), h));
    return m;
  }, [heroData]);
  const itemByName = useMemo(() => {
    const m = new Map<string, ItemStat>();
    (itemData ?? []).forEach((it) => {
      if (it.item_name) m.set(norm(it.item_name), it);
    });
    return m;
  }, [itemData]);

  if (!wantHeroes && !wantItems) return null;

  return (
    <div className="flex" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {heroes.map((name) => {
        const h = heroByName.get(norm(name));
        return h && h.win_rate != null ? (
          <LiveStatChip key={`h-${name}`} kind="hero" name={h.hero_name} wr={h.win_rate} iconUrl={h.icon_url} />
        ) : (
          <Chip key={`h-${name}`}>{name}</Chip>
        );
      })}
      {items.map((name) => {
        const it = itemByName.get(norm(name));
        return it && it.win_rate != null ? (
          <LiveStatChip key={`i-${name}`} kind="item" name={it.item_name ?? name} wr={it.win_rate} iconUrl={it.icon_url} />
        ) : (
          <Chip key={`i-${name}`}>{name}</Chip>
        );
      })}
    </div>
  );
}

export default function GuideLiveStats(props: GuideLiveStatsProps) {
  return (
    <QueryProvider>
      <GuideLiveStatsInner {...props} />
    </QueryProvider>
  );
}
