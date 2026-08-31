//Read-only render of computeStats' output: the Weapon / Vitality / Spirit panels, the per-ability
//imbue breakdown, and the souls spend. Every number here comes straight off ComputedStats — this
//file formats, it never derives.
import { EmptyState, GameIcon, Icon, type IconName } from '../ui/index';
import { count, fixed } from '../../../lib/format';
import type { ComputedStats, ImbueLine, StatLine } from '../../../lib/computeStats';
import type { HeroAbility } from '../../../types/api';

interface CalculatedPanelsProps {
  stats: ComputedStats;
  abilities: HeroAbility[];
  hasItems: boolean;
}

function num(n: number): string {
  return Number.isInteger(n) ? count(n) : fixed(n, 1);
}

//Percent lines carry their own sign (cooldown reduction arrives negative); flat lines are absolute.
function lineValue(unit: 'flat' | 'percent', value: number): string {
  return unit === 'percent' ? `${value > 0 ? '+' : ''}${num(value)}%` : num(value);
}

function StatRow({ line }: { line: StatLine }) {
  return (
    <div className="statrow">
      <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{line.label}</span>
      <span className="flex" style={{ alignItems: 'center', gap: 8 }}>
        {line.base > 0 && (
          <span className="faint tnum" style={{ fontSize: 12 }}>{num(line.base)} →</span>
        )}
        <span className="sv tnum cyan-c">{lineValue(line.unit, line.value)}</span>
      </span>
    </div>
  );
}

function StatPanel({ title, icon, lines }: { title: string; icon: IconName; lines: StatLine[] }) {
  return (
    <section className="panel catpanel">
      <div className="cat-h">
        <Icon name={icon} size={15} color="var(--cyan-bright)" />
        <span className="display" style={{ flex: 1 }}>{title}</span>
        <span className="label-xs tnum">{lines.length}</span>
      </div>
      {lines.length === 0 ? (
        <p className="faint" style={{ fontSize: 12.5, padding: '12px 15px', margin: 0 }}>
          Nothing in this build changes a {title.toLowerCase()} stat yet.
        </p>
      ) : (
        lines.map((line) => <StatRow key={line.key} line={line} />)
      )}
    </section>
  );
}

function AbilityBlock({
  ability,
  abilityId,
  lines,
}: {
  ability: HeroAbility | undefined;
  abilityId: number;
  lines: ImbueLine[];
}) {
  return (
    <div style={{ padding: '10px 15px', borderBottom: '1px solid var(--border-soft)' }}>
      <div className="flex" style={{ alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <GameIcon kind="item" name={ability?.name ?? 'Ability'} src={ability?.icon_url} size={22} />
        <span className="display" style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
          {ability?.name ?? `Ability ${abilityId}`}
        </span>
      </div>
      {lines.map((entry) => (
        <div key={entry.itemId} className="flex" style={{ alignItems: 'baseline', gap: 8, flexWrap: 'wrap', paddingLeft: 30 }}>
          <span className="faint" style={{ fontSize: 12 }}>{entry.itemName}</span>
          {entry.lines.map((l) => (
            <span key={l.key} className="chip" style={{ padding: '1px 7px', fontSize: 11 }}>
              {l.label} <span className="tnum cyan-c">{lineValue(l.unit, l.value)}</span>
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function SpendRow({ label, value, hint, strong }: { label: string; value: number; hint?: string; strong?: boolean }) {
  return (
    <div className="statrow" title={hint}>
      <span style={{ fontSize: 13, color: strong ? 'var(--text)' : 'var(--text-2)', fontWeight: strong ? 600 : 400 }}>
        {label}
      </span>
      <span className="sv tnum amber-c">{count(value)}</span>
    </div>
  );
}

export default function CalculatedPanels({ stats, abilities, hasItems }: CalculatedPanelsProps) {
  if (!hasItems) {
    return (
      <EmptyState
        title="Nothing calculated yet"
        message="Add items to the build — the Weapon, Vitality and Spirit panels fill in from the live item modifiers."
        icon="chart"
      />
    );
  }

  const abilityById = new Map(abilities.map((a) => [a.ability_id, a]));
  const abilityOrder = new Map(abilities.map((a, i) => [a.ability_id, i]));
  const imbued = Object.entries(stats.perAbility)
    .map(([id, lines]) => ({ abilityId: Number(id), lines }))
    .sort((a, b) => (abilityOrder.get(a.abilityId) ?? 99) - (abilityOrder.get(b.abilityId) ?? 99));

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        <StatPanel title="Weapon" icon="target" lines={stats.weapon} />
        <StatPanel title="Vitality" icon="shield" lines={stats.vitality} />
        <StatPanel title="Spirit" icon="flame" lines={stats.spirit} />
      </div>

      <section className="panel catpanel">
        <div className="cat-h">
          <Icon name="bolt" size={15} color="var(--cyan-bright)" />
          <span className="display" style={{ flex: 1 }}>Imbued abilities</span>
          <span className="label-xs tnum">{imbued.length}</span>
        </div>
        {imbued.length === 0 ? (
          <p className="faint" style={{ fontSize: 12.5, padding: '12px 15px', margin: 0 }}>
            No imbues yet. Assign an item with ability stats (cooldown, range, radius, duration) to an ability.
          </p>
        ) : (
          imbued.map((row) => (
            <AbilityBlock
              key={row.abilityId}
              abilityId={row.abilityId}
              ability={abilityById.get(row.abilityId)}
              lines={row.lines}
            />
          ))
        )}
      </section>

      <section className="panel catpanel">
        <div className="cat-h">
          <Icon name="coins" size={15} color="var(--cyan-bright)" />
          <span className="display" style={{ flex: 1 }}>Souls spent</span>
        </div>
        <SpendRow label="Weapon items" value={stats.spend.weapon} />
        <SpendRow label="Vitality items" value={stats.spend.vitality} />
        <SpendRow label="Spirit items" value={stats.spend.spirit} />
        <SpendRow
          label="Flex items"
          value={stats.spend.flex}
          hint="Souls on items whose own category is flex. Flex SLOTS on the board hold weapon / vitality / spirit items, which count under their own category."
        />
        <SpendRow label="Total" value={stats.spend.total} strong />
        <SpendRow
          label="Effective total"
          value={stats.spend.effectiveTotal}
          hint="Total minus the souls already sunk into components an item upgrades from."
          strong
        />
      </section>
    </div>
  );
}
