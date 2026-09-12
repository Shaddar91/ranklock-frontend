//"Buy it against" (design 01 §Item §7) is written by the content program, never derived
//from match data. The rail block renders only for an item that has an entry here.

export interface CounterNote {
  hero: string;
  why: string;
}

const BUY_IT_AGAINST: Record<string, readonly CounterNote[]> = {};

export function buyItAgainst(itemId: number | null | undefined): readonly CounterNote[] {
  return itemId == null ? [] : (BUY_IT_AGAINST[String(itemId)] ?? []);
}
