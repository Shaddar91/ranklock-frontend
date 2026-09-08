//Parses a raw Deadlock changelog into renderable lines plus the hero/item each
//bullet names, so a patch page can link what the patch actually touched. Nothing
//is inferred: a line whose leading entity is not in the roster stays plain text.

export interface NoteEntity {
  kind: 'hero' | 'item';
  name: string;
  href: string;
}

export interface TouchedEntity extends NoteEntity {
  lines: number;
}

export interface NoteLine {
  kind: 'heading' | 'text' | 'bullet';
  entity: NoteEntity | null;
  //Literal source spelling of the matched entity, so the page links the words the changelog used.
  label: string;
  text: string;
}

export interface PatchNotes {
  lines: NoteLine[];
  heroes: TouchedEntity[];
  items: TouchedEntity[];
  bullets: number;
}

export interface EntitySource {
  heroes: readonly { hero_name: string; slug: string }[];
  items: readonly { item_id: number; name: string }[];
}

const EMPTY: PatchNotes = { lines: [], heroes: [], items: [], bullets: 0 };

//Changelogs spell entities loosely ("Mo & Krill", "Diviner's Kevlar"); compare on
//alphanumeric words only so punctuation never decides a match.
const norm = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

function entityKeys(source: EntitySource): Map<string, NoteEntity> {
  const keys = new Map<string, NoteEntity>();
  const put = (key: string, entity: NoteEntity) => {
    if (key !== '' && !keys.has(key)) keys.set(key, entity);
  };
  for (const h of source.heroes) {
    const entity: NoteEntity = { kind: 'hero', name: h.hero_name, href: `/heroes/${h.slug}/` };
    const key = norm(h.hero_name);
    put(key, entity);
    //Changelogs drop the article ("Doorman:" for "The Doorman").
    put(key.replace(/^the /, ''), entity);
  }
  //Two catalog ids share a name (Silencer); the lowest id wins so the link is stable across builds.
  const byName = new Map<string, { item_id: number; name: string }>();
  for (const i of source.items) {
    const key = norm(i.name);
    const prev = byName.get(key);
    if (!prev || i.item_id < prev.item_id) byName.set(key, i);
  }
  for (const [key, i] of byName) put(key, { kind: 'item', name: i.name, href: `/items/${i.item_id}/` });
  return keys;
}

//Longest entity name in the roster, in words — the ceiling for the prefix scan.
const maxWords = (keys: Map<string, NoteEntity>): number => {
  let max = 1;
  for (const key of keys.keys()) max = Math.max(max, key.split(' ').length);
  return max;
};

//A colon this far into a bullet is prose punctuation, not an entity prefix.
const LABEL_LIMIT = 40;

function matchEntity(
  body: string,
  keys: Map<string, NoteEntity>,
  words: number,
): { entity: NoteEntity; label: string; rest: string } | null {
  const colon = body.indexOf(':');
  if (colon > 0 && colon <= LABEL_LIMIT) {
    const entity = keys.get(norm(body.slice(0, colon)));
    if (entity) return { entity, label: body.slice(0, colon), rest: body.slice(colon) };
  }
  const parts = body.split(/(\s+)/);
  for (let n = Math.min(words, Math.ceil(parts.length / 2)); n >= 1; n--) {
    const head = parts.slice(0, n * 2 - 1).join('');
    const entity = keys.get(norm(head));
    if (entity) return { entity, label: head, rest: body.slice(head.length) };
  }
  return null;
}

export function parsePatchNotes(text: string | null, source: EntitySource): PatchNotes {
  if (!text) return EMPTY;
  const keys = entityKeys(source);
  const words = maxWords(keys);
  const lines: NoteLine[] = [];
  const touched = new Map<string, TouchedEntity>();
  let bullets = 0;

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === '') continue;
    if (/^\[.*\]$/.test(line)) {
      lines.push({ kind: 'heading', entity: null, label: '', text: line.replace(/^\[\s*|\s*\]$/g, '') });
      continue;
    }
    if (!line.startsWith('- ')) {
      lines.push({ kind: 'text', entity: null, label: '', text: line });
      continue;
    }
    bullets += 1;
    const body = line.slice(2).trim();
    const hit = matchEntity(body, keys, words);
    if (!hit) {
      lines.push({ kind: 'bullet', entity: null, label: '', text: body });
      continue;
    }
    lines.push({ kind: 'bullet', entity: hit.entity, label: hit.label, text: hit.rest });
    const seen = touched.get(hit.entity.href);
    if (seen) seen.lines += 1;
    else touched.set(hit.entity.href, { ...hit.entity, lines: 1 });
  }

  const byName = (a: TouchedEntity, b: TouchedEntity) => a.name.localeCompare(b.name);
  return {
    lines,
    heroes: [...touched.values()].filter((e) => e.kind === 'hero').sort(byName),
    items: [...touched.values()].filter((e) => e.kind === 'item').sort(byName),
    bullets,
  };
}
