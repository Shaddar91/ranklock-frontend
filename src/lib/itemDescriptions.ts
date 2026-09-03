//What an item actually DOES — the text and the active/imbue flags the stats endpoints don't carry.
//
//Neither /items/stats, /heroes/:id/item-win-rates nor /items/modifiers returns description,
//activation or imbue: the backend's build_item_modifiers (deadlock-backend
//src/handlers/builds.rs) copies seven fields out of the upstream item feed and drops the rest.
//So this map is generated at build time from that same feed by scripts/gen-item-catalog.mjs and
//bundled — { d: what it does, p: the passive rider on an active item, a: activation type when it
//is not a plain passive, i: imbue kind }.
//
//Import it from island code only (items table, item overlay card); keep it out of itemCatalog.ts
//and apiClient so the everywhere-loaded chunk hero pages share never pulls the text.
import descriptions from '../data/item-descriptions.json';

interface AbilityEntry {
  d?: string;
  p?: string;
  a?: string;
  i?: string;
}

const ENTRIES = descriptions as Record<string, AbilityEntry>;

export interface ItemAbility {
  //Cast on a key, versus always-on.
  active: boolean;
  //Rides on one of the hero's abilities instead of the hero.
  imbue: boolean;
  desc: string | null;
  //Second line: what an active item still does while the active is off cooldown.
  passive: string | null;
}

function entry(id: number | null | undefined): AbilityEntry | null {
  return id == null ? null : (ENTRIES[String(id)] ?? null);
}

/** Plain-text "what it does" for an item id, or null when the catalog has none. */
export function itemDescription(id: number | null | undefined): string | null {
  return entry(id)?.d ?? null;
}

/** Ability facts for the overlay card: active / imbue badges plus the text, or null. */
export function itemAbility(id: number | null | undefined): ItemAbility | null {
  const e = entry(id);
  if (!e) return null;
  return {
    active: e.a != null,
    imbue: e.i != null,
    desc: e.d ?? null,
    passive: e.p ?? null,
  };
}
