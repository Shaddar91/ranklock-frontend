//Lab §7 — the whole roster as one scrollable chip row. Picking a hero re-bases the board (the
//draft resets), so a hero with no base-stats row is disabled rather than silently picking empty.
import { useMemo } from 'react';
import { GameIcon } from '../ui/index';
import type { HeroBaseStats, HeroSummary } from '../../../types/api';

interface HeroChipRowProps {
  roster: HeroSummary[];
  playable: HeroBaseStats[];
  heroId: number | null;
  onHero: (id: number) => void;
}

export default function HeroChipRow({ roster, playable, heroId, onHero }: HeroChipRowProps) {
  const withStats = useMemo(() => new Set(playable.map((h) => h.hero_id)), [playable]);
  const heroes = useMemo(() => {
    const named = roster.filter((h) => h.hero_name?.trim());
    const source = named.length > 0 ? named : playable.map((h) => ({ hero_id: h.hero_id, hero_name: h.hero_name, icon_url: null }));
    return [...source].sort((a, b) => a.hero_name.localeCompare(b.hero_name));
  }, [roster, playable]);

  if (heroes.length === 0) {
    return (
      <p className="faint" style={{ fontSize: 12.5, margin: 0 }}>
        The hero roster has not been served yet — nothing to pick.
      </p>
    );
  }

  return (
    <section className="grid" style={{ gap: 7 }}>
      <div className="between" style={{ gap: 10, flexWrap: 'wrap' }}>
        <span className="label-xs">Hero</span>
        <span className="faint tnum" style={{ fontSize: 11.5 }}>
          {heroes.length} heroes · picking one clears the board
        </span>
      </div>
      <div
        className="flex"
        role="radiogroup"
        aria-label="Select a hero"
        style={{ gap: 6, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'thin' }}
      >
        {heroes.map((h) => {
          const on = h.hero_id === heroId;
          const usable = withStats.size === 0 || withStats.has(h.hero_id);
          return (
            <button
              key={h.hero_id}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={!usable}
              title={usable ? h.hero_name : `${h.hero_name} — no base-stats row in this patch's capture`}
              className="tile flex"
              style={{
                alignItems: 'center',
                gap: 7,
                flex: 'none',
                padding: '4px 11px 4px 4px',
                borderRadius: 20,
                cursor: usable ? 'pointer' : 'not-allowed',
                opacity: usable ? 1 : 0.45,
                borderColor: on ? 'var(--cyan)' : undefined,
                color: on ? 'var(--text)' : 'var(--text-2)',
              }}
              onClick={() => usable && onHero(h.hero_id)}
            >
              <GameIcon kind="hero" name={h.hero_name} src={h.icon_url} size={24} />
              <span className="display" style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>
                {h.hero_name}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
