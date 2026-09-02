//Released-roster guard for the static build: a `heroes` row named `Unknown Hero …` is an
//unreleased placeholder the API must never serve. A build refuses it; dev drops it with a warning.
export const UNRELEASED_NAME_PREFIX = 'Unknown Hero';

export interface RosterRow {
  hero_id: number;
  hero_name: string;
}

export const isUnreleased = (h: Pick<RosterRow, 'hero_name'>): boolean =>
  h.hero_name.startsWith(UNRELEASED_NAME_PREFIX);

export function releasedRoster<T extends RosterRow>(
  heroes: T[],
  where: string,
  strict: boolean = import.meta.env.PROD,
): T[] {
  const leaked = heroes.filter(isUnreleased);
  if (leaked.length === 0) return heroes;
  const ids = leaked.map((h) => `${h.hero_id} "${h.hero_name}"`).join(', ');
  if (strict) {
    throw new Error(
      `[released-roster guard] ${where}: /heroes served ${leaked.length} unreleased hero(es): ${ids}. ` +
        `Refusing to generate pages or sitemap entries for them.`,
    );
  }
  console.warn(`[released-roster guard] ${where}: dropping ${leaked.length} unreleased hero(es): ${ids}`);
  return heroes.filter((h) => !isUnreleased(h));
}
