//The app-wide item hover card: every item tile wraps its trigger in THIS, never in a bare
//Tooltip + ItemOverlayCard. Content renders only while open, so the detail fetch is lazy;
//needs a QueryProvider above it.
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../../lib/apiClient';
import { mergeItemDetail } from '../../../lib/itemDetail';
import type { ItemOverlayData } from '../../../lib/itemOverlay';
import ItemOverlayCard from './ItemOverlayCard';
import Tooltip from './Tooltip';
import type { ItemDetailResponse, Patch } from '../../../types/api';

const DAY_MS = 24 * 60 * 60_000;
//mirrors .tt-pop.tt-item in components.css — the flip-at-the-edge maths needs the literal
const CARD_W = 320;

function CardBody({ data }: { data: ItemOverlayData }) {
  const id = data.id;
  const detail = useQuery<ItemDetailResponse>({
    queryKey: queryKeys.itemDetail(id ?? -1),
    queryFn: () => api.getItemDetail(id!),
    enabled: id != null && !data.brawl,
    staleTime: DAY_MS,
    retry: false,
  });
  const patch = useQuery<Patch>({
    queryKey: queryKeys.patchCurrent(),
    queryFn: () => api.getCurrentPatch(),
    staleTime: DAY_MS,
    retry: false,
  });
  return <ItemOverlayCard data={mergeItemDetail(data, detail.data)} catalogPatch={patch.data?.patch_id ?? null} />;
}

export default function ItemHoverCard({
  data,
  asChild,
  children,
}: {
  data: ItemOverlayData;
  asChild?: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip asChild={asChild} popClass="tt-item" popWidth={CARD_W} content={<CardBody data={data} />}>
      {children}
    </Tooltip>
  );
}
