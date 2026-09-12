//Shop item tiers I-V and their prices, mirroring the client's own
//ItemPricePerTier = [0, 800, 1600, 3200, 6400, 9999] (index === tier).
//Every lookup returns null for an unknown tier — never a guessed 0.

export interface ItemTier {
  tier: number;
  numeral: string;
  cost: number;
  //Only Tier V carries a name upstream; I-IV are numbered, not named.
  name?: string;
}

export const ITEM_TIERS: readonly ItemTier[] = [
  { tier: 1, numeral: 'I', cost: 800 },
  { tier: 2, numeral: 'II', cost: 1600 },
  { tier: 3, numeral: 'III', cost: 3200 },
  { tier: 4, numeral: 'IV', cost: 6400 },
  { tier: 5, numeral: 'V', cost: 9999, name: 'Apex' },
];

export const ITEM_TIER_COST: readonly number[] = [0, 800, 1600, 3200, 6400, 9999];

export function itemTier(tier: number | null | undefined): ItemTier | undefined {
  return tier == null ? undefined : ITEM_TIERS.find((t) => t.tier === tier);
}

export function itemTierCost(tier: number | null | undefined): number | null {
  return itemTier(tier)?.cost ?? null;
}

export function itemTierNumeral(tier: number | null | undefined): string | null {
  return itemTier(tier)?.numeral ?? null;
}

//"Tier III" / "Tier V · Apex".
export function itemTierLabel(tier: number | null | undefined): string | null {
  const t = itemTier(tier);
  if (!t) return null;
  return t.name ? `Tier ${t.numeral} · ${t.name}` : `Tier ${t.numeral}`;
}
