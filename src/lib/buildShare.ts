//Server-free build sharing + local drafts. A build encodes to a versioned base64url payload
//carried in the URL fragment (`/build-lab#b1:<payload>`) — the fragment dodges the static host's
//trailingSlash redirect (no server round-trip, no 404 class). Drafts persist in localStorage.
import type { BuildInput } from './computeStats';

const VERSION = 'b1';

//Compact on-wire shape (short keys keep the fragment small). Only set fields ride along.
interface Wire {
  h: number;
  p?: string;
  i: number[];
  m?: Record<number, number>;
  c?: number[];
  n?: number[];
  u?: Record<number, number>;
  a?: number[];
}

function toWire(b: BuildInput): Wire {
  const w: Wire = { h: b.heroId, i: b.items };
  if (b.patch) w.p = b.patch;
  if (b.imbueTargets && Object.keys(b.imbueTargets).length) w.m = b.imbueTargets;
  if (b.conditionalItems?.length) w.c = b.conditionalItems;
  if (b.conditionalsOn?.length) w.n = b.conditionalsOn;
  if (b.upgradesFrom && Object.keys(b.upgradesFrom).length) w.u = b.upgradesFrom;
  if (b.abilityOrder?.length) w.a = b.abilityOrder;
  return w;
}

function numMap(o: unknown): Record<number, number> | undefined {
  if (!o || typeof o !== 'object') return undefined;
  const out: Record<number, number> = {};
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    const nk = Number(k);
    if (Number.isFinite(nk) && typeof v === 'number') out[nk] = v;
  }
  return out;
}
function numArr(a: unknown): number[] | undefined {
  return Array.isArray(a) ? a.filter((x): x is number => typeof x === 'number') : undefined;
}

function fromWire(w: Wire): BuildInput {
  return {
    heroId: w.h,
    patch: typeof w.p === 'string' ? w.p : undefined,
    items: numArr(w.i) ?? [],
    imbueTargets: numMap(w.m),
    conditionalItems: numArr(w.c),
    conditionalsOn: numArr(w.n),
    upgradesFrom: numMap(w.u),
    abilityOrder: numArr(w.a),
  };
}

function b64urlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s: string): string {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** `b1:<base64url>` — the versioned share payload for a build. */
export function encodeBuild(build: BuildInput): string {
  return `${VERSION}:${b64urlEncode(JSON.stringify(toWire(build)))}`;
}

/** Decode a `b1:<payload>` string; null on any malformed/unknown-version input. */
export function decodeBuild(payload: string | null | undefined): BuildInput | null {
  if (!payload) return null;
  const idx = payload.indexOf(':');
  if (idx < 0) return null;
  const version = payload.slice(0, idx);
  if (version !== VERSION) return null;
  try {
    const w = JSON.parse(b64urlDecode(payload.slice(idx + 1))) as Wire;
    if (typeof w?.h !== 'number' || !Array.isArray(w.i)) return null;
    return fromWire(w);
  } catch {
    return null;
  }
}

/** The `#b1:<payload>` fragment for a build (empty string for an empty build). */
export function buildShareHash(build: BuildInput): string {
  return build.items.length ? `#${encodeBuild(build)}` : '';
}

/** Read a build from a `#b1:<payload>` location hash (or the bare payload). */
export function readBuildFromHash(hash: string | null | undefined): BuildInput | null {
  if (!hash) return null;
  return decodeBuild(hash.replace(/^#/, ''));
}

//---- localStorage drafts -----------------------------------------------------
const DRAFTS_KEY = 'ranklock.buildDrafts.v1';

export interface Draft {
  id: string;
  name: string;
  updatedAt: number;
  build: BuildInput;
}

function safeStore(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadDrafts(): Draft[] {
  const store = safeStore();
  if (!store) return [];
  try {
    const raw = store.getItem(DRAFTS_KEY);
    const arr = raw ? (JSON.parse(raw) as Draft[]) : [];
    return Array.isArray(arr) ? arr.filter((d) => d && typeof d.id === 'string' && d.build) : [];
  } catch {
    return [];
  }
}

//Upsert by id, newest first. `now` is injected so the caller owns the clock (testable).
export function saveDraft(draft: Omit<Draft, 'updatedAt'>, now: number): Draft[] {
  const store = safeStore();
  const next: Draft = { ...draft, updatedAt: now };
  const rest = loadDrafts().filter((d) => d.id !== draft.id);
  const all = [next, ...rest].slice(0, 50);
  if (store) {
    try {
      store.setItem(DRAFTS_KEY, JSON.stringify(all));
    } catch {
      //quota/blocked — the caller still gets the in-memory list back.
    }
  }
  return all;
}

export function deleteDraft(id: string): Draft[] {
  const store = safeStore();
  const all = loadDrafts().filter((d) => d.id !== id);
  if (store) {
    try {
      store.setItem(DRAFTS_KEY, JSON.stringify(all));
    } catch {
      //ignore
    }
  }
  return all;
}
