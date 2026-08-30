//Presentational humanization for Build Lab stat labels — pure string work, kept
//in src/lib so it unit-tests and stays out of the island. Segments upstream stat
//keys / display names into wrap-friendly Title Case so no stat card clips.

//Stat words for segmenting an all-lowercase concatenated key that carries no
//camelCase or underscore boundary (e.g. "abilityresourceregenpersecond").
const STAT_WORDS = [
  'ability', 'resource', 'regen', 'per', 'second', 'dash', 'distance', 'meters',
  'duration', 'health', 'melee', 'damage', 'move', 'speed', 'accel', 'max',
  'base', 'bullet', 'weapon', 'spirit', 'stamina', 'sprint', 'bonus', 'range',
  'rate', 'reload', 'cooldown', 'ammo', 'clip', 'crit', 'fire', 'tech', 'shield',
];

function titleCase(words: string[]): string {
  return words
    .filter((w) => w.length > 0)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

//Greedy longest-match over STAT_WORDS; an unmatched run accretes into a trailing
//chunk so nothing in the key is dropped.
function dictSegment(s: string): string[] {
  const out: string[] = [];
  let pending = '';
  for (let i = 0; i < s.length; ) {
    let hit = '';
    for (const w of STAT_WORDS) {
      if (w.length > hit.length && s.startsWith(w, i)) hit = w;
    }
    if (hit) {
      if (pending) { out.push(pending); pending = ''; }
      out.push(hit);
      i += hit.length;
    } else {
      pending += s.charAt(i);
      i += 1;
    }
  }
  if (pending) out.push(pending);
  return out;
}

//Underscores → split; camelCase / letter–digit boundaries → split; a boundary-
//less lowercase run → dictionary segmentation; otherwise the raw text, Title-cased.
export function prettyLabel(raw: string): string {
  const s = (raw ?? '').trim();
  if (!s) return '';
  if (s.includes('_')) return titleCase(s.split(/_+/));
  if (/[a-z][A-Z]|[A-Z]{2}[a-z]|[A-Za-z][0-9]|[0-9][A-Za-z]/.test(s)) {
    const spaced = s
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .replace(/([A-Za-z])([0-9])/g, '$1 $2')
      .replace(/([0-9])([A-Za-z])/g, '$1 $2');
    return titleCase(spaced.split(/\s+/));
  }
  const seg = dictSegment(s.toLowerCase());
  return titleCase(seg.length > 1 ? seg : [s]);
}

//Build Lab stat label: the upstream display name (strip the single leading "E"
//enum tag) when present, else the raw key — both routed through prettyLabel.
export function statLabel(key: string, displayStatName?: string): string {
  const dsn = displayStatName?.trim();
  return dsn ? prettyLabel(dsn.replace(/^E/, '')) : prettyLabel(key);
}
