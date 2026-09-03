//Text transforms for the patch-content fill generator: frontmatter edits,
//sentinel fills, and the wave2 comment-block strip/uncomment/restore moves.
import { fail } from './patch-fill-log.mjs';

export const WAVE1_TOKENS = ['PATCH_LABEL', 'PATCH_DATE', 'CHANGED_ENTITIES', 'CHANGED_COUNT', 'DATA_WINDOW', 'DATA_LAG'];
export const WAVE2_TOKENS = ['MOVERS_TABLE', 'SAMPLE_N'];
export const SENTINEL = /\{\{[A-Z_]{3,}\}\}/;
const SENTINEL_G = /\{\{[A-Z_]{3,}\}\}/g;
const PATCH_PHRASE = /(since the|after the|this)\s+(patch|update)/i;

export function splitFrontmatter(text, label) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) fail(`post has no frontmatter block: ${label}`);
  return { fm: match[1], rest: text.slice(match[0].length) };
}

export const joinFm = (fm, rest) => `---\n${fm}\n---\n${rest}`;

export function getDescription(fm) {
  return fm.match(/^description:\s*"(?<value>[\s\S]*?)"\s*$/m)?.groups?.value ?? null;
}

export function setDescription(fm, value) {
  return fm.replace(/^description:.*$/m, `description: "${value}"`);
}

export function setFmField(fm, key, value) {
  const line = new RegExp(`^${key}:.*$`, 'm');
  return line.test(fm) ? fm.replace(line, `${key}: ${value}`) : `${fm}\n${key}: ${value}`;
}

export const isHeld = (fm) => /^draft:\s*true\s*$/m.test(fm);

export function fillTokens(text, values) {
  let out = text;
  for (const [token, value] of Object.entries(values)) {
    out = out.split(`{{${token}}}`).join(value);
  }
  return out;
}

export const sentinelsIn = (text) => [...new Set(text.match(SENTINEL_G) ?? [])];
export const tokenName = (s) => s.replace(/[{}]/g, '');

//A published line may not carry a patch phrase on one line (gate check 2), so
//the phrase is wrapped mid-way; markdown renders the newline as a space.
export function wrapPatchPhrases(text) {
  return text
    .split('\n')
    .map((line) => {
      if (SENTINEL.test(line) || !PATCH_PHRASE.test(line)) return line;
      return line.replace(PATCH_PHRASE, '$1\n$2');
    })
    .join('\n');
}

const WAVE2_BLOCK = /[ \t]*<!--\s*wave2:start\s*\r?\n[\s\S]*?\r?\n?[ \t]*wave2:end\s*-->\r?\n?/;
const WAVE2_MARKER = /^(<!--\s*wave2:start|wave2:end\s*-->)$/;
const dropMarkers = (text) =>
  text.split(/\r?\n/).filter((l) => !WAVE2_MARKER.test(l.trim())).join('\n');

export function stripWave2Block(text, label) {
  const match = text.match(WAVE2_BLOCK);
  if (!match) return null;
  const after = text.slice(match.index + match[0].length);
  const anchor = after.split(/\r?\n/).find((l) => l.trim() !== '');
  if (!anchor) fail(`no anchor line after the wave2 block in ${label}`);
  const rest = (text.slice(0, match.index) + after).replace(/\n{3,}/g, '\n\n');
  return { block: match[0], anchor: anchor.trim(), text: rest };
}

export const uncommentWave2Block = (block) => dropMarkers(block).replace(/^\n+|\n+$/g, '');
export const uncommentWave2InPlace = (text) => dropMarkers(text);

export function restoreWave2Block(text, filledBlock, anchor, label) {
  const lines = text.split('\n');
  const index = lines.findIndex((l) => l.trim() === anchor);
  if (index === -1) fail(`wave2 anchor line not found in ${label}: ${anchor}`);
  lines.splice(index, 0, filledBlock, '');
  return lines.join('\n');
}

//Drop the comma-clause carrying an unfillable sentinel, then whole sentences.
export function stripDescriptionSentinels(description) {
  const clause = description.replace(/,\s*[^,.;{}]*\{\{[A-Z_]{3,}\}\}[^,.;{}]*/g, '');
  if (!SENTINEL.test(clause)) return clause;
  return clause.split(/(?<=\.)\s+/).filter((s) => !SENTINEL.test(s)).join(' ');
}
