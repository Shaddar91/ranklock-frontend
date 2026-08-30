//The shared scope controls for the playstyle radar and the Compare tab picker:
//Games|Days pill toggle, that kind's preset row, and a hero select defaulting to
//"All heroes". When a second player is picked, heroes they also play are marked
//"(both played)". Reuses the brkfilter/minitog + field select styles.
import { count } from '../../../lib/format';
import { SCOPE_PRESETS, type PlayerScope, type PlayerScopeKind } from '../../../lib/playerScope';
import { usePlayerHeroesPlayed } from './usePlayer';

const KINDS: ReadonlyArray<{ key: PlayerScopeKind; label: string }> = [
  { key: 'games', label: 'Games' },
  { key: 'days', label: 'Days' },
];

interface PlayerScopeControlsProps {
  scope: PlayerScope;
  onKind: (kind: PlayerScopeKind) => void;
  onN: (n: number | 'all') => void;
  onHero: (hero_id: number) => void;
  playerId: number;
  themId?: number;
}

export function PlayerScopeControls({ scope, onKind, onN, onHero, playerId, themId }: PlayerScopeControlsProps) {
  const heroes = usePlayerHeroesPlayed(playerId);
  const themHeroes = usePlayerHeroesPlayed(themId ?? 0);
  const themSet = new Set((themHeroes.data ?? []).map((h) => h.hero_id));
  const options = [...(heroes.data ?? [])].sort((a, b) => b.matches_played - a.matches_played);

  return (
    <div className="flex" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <div className="brkfilter" style={{ padding: 3, flexWrap: 'nowrap', flexShrink: 0 }}>
        {KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            className={'minitog' + (scope.kind === k.key ? ' on' : '')}
            onClick={() => onKind(k.key)}
            aria-pressed={scope.kind === k.key}
          >
            {k.label}
          </button>
        ))}
      </div>
      <div className="brkfilter" style={{ padding: 3, flexWrap: 'nowrap', flexShrink: 0 }}>
        {SCOPE_PRESETS[scope.kind].map((p) => (
          <button
            key={String(p)}
            type="button"
            className={'minitog' + (scope.n === p ? ' on' : '')}
            onClick={() => onN(p)}
            aria-pressed={scope.n === p}
          >
            {p === 'all' ? 'All' : p}
          </button>
        ))}
      </div>
      {options.length > 0 && (
        <label className="flex" style={{ alignItems: 'center', gap: 8 }}>
          <span className="label-xs">Hero</span>
          <select
            className="field"
            style={{ width: 'auto', padding: '7px 10px' }}
            value={scope.hero_id}
            onChange={(e) => onHero(Number(e.target.value))}
            aria-label="Scope to one hero"
          >
            <option value={0}>All heroes</option>
            {options.map((h) => (
              <option key={h.hero_id} value={h.hero_id}>
                {h.hero_name} ({count(h.matches_played)})
                {themSet.has(h.hero_id) ? ' (both played)' : ''}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
