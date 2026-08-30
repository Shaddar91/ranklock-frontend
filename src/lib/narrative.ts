//Shared shapes + helpers for the build-time prose on hero and item pages.
export type Seg = string | { text: string; href: string };
export type Para = Seg[];
export interface Section {
  heading: string;
  paras: Para[];
}

export const link = (text: string, href: string): Seg => ({ text, href });

export function ordinal(n: number): string {
  const v = n % 100;
  const suffix = v >= 11 && v <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
}

/** 1-based rank of `v` among `values`, highest first. */
export function rankDesc(values: number[], v: number): number {
  return values.filter((x) => x > v).length + 1;
}

export function mean(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

/** Win rates arrive either as 0..1 fractions or 0..100 percentages; normalize to percent. */
export function toPct(wr: number): number {
  return wr <= 1 ? wr * 100 : wr;
}

/** Quarter of the roster (at least 1) used for "top/bottom quarter" reads. */
export function quarter(n: number): number {
  return Math.max(1, Math.ceil(n / 4));
}

/** "A", "A and B", "A, B and C" over segment lists. */
export function joinSegs(parts: Seg[][]): Seg[] {
  const out: Seg[] = [];
  parts.forEach((p, i) => {
    if (i > 0) out.push(i === parts.length - 1 ? ' and ' : ', ');
    out.push(...p);
  });
  return out;
}

export function plainText(sections: Section[]): string {
  return sections
    .map((s) => `${s.heading}\n${s.paras.map((p) => p.map((seg) => (typeof seg === 'string' ? seg : seg.text)).join('')).join('\n')}`)
    .join('\n\n');
}
