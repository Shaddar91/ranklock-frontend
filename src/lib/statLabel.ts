//Build Lab stat-label humanization: segments boundary-less upstream keys into wrap-friendly Title Case.

//Dictionary for keys with no camelCase/underscore boundary ("abilityresourceregenpersecond").
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

//Greedy longest-match; unmatched runs accrete so nothing is dropped.
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

//Upstream display name (leading "E" enum tag stripped) when present, else the raw key.
export function statLabel(key: string, displayStatName?: string): string {
  const dsn = displayStatName?.trim();
  return dsn ? prettyLabel(dsn.replace(/^E/, '')) : prettyLabel(key);
}
