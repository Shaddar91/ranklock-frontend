//Living styleguide for the gaslamp design system (C3). Mounted with
//client:only="react" on /styleguide. Renders every token group + library
//component with sample data so the system can be eyeballed and theme-switched
//live (flip a skin in the switcher and the whole gallery recolors with no layout
//shift — the success criterion). NOT shipped on the SEO surface.
import { useState } from 'react';
import ThemeSwitcher from './ThemeSwitcher';
import ConsentManager from './privacy/ConsentManager';
import { reopenBanner } from '../../lib/consent';
import {
  AdSlot,
  BracketFilter,
  type BracketValue,
  Chip,
  DataTable,
  type DataTableColumn,
  Delta,
  EmptyState,
  FormDots,
  GameIcon,
  Icon,
  LiveStatChip,
  MvpBadge,
  RankBadge,
  Skeleton,
  StatTile,
  TierPill,
  WinBar,
  Wordmark,
} from './ui';
import RadarChart from './charts/RadarChart';
import EconomyCurve from './charts/EconomyCurve';
import SourceBreakdown from './charts/SourceBreakdown';
import MatchEconChart from './charts/MatchEconChart';
import {
  ECON_CURVE,
  HEROES,
  heroImg,
  itemImg,
  LEADERS,
  MATCH_ECON,
  RADAR,
  SAMPLE_FORM,
  SOURCES,
  type SampleHero,
} from '../../lib/sampleData';
import { subLabel } from '../../lib/ranks';

//---- local layout helpers ---------------------------------------------------
function Section({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
  return (
    <section className="panel panel-pad" style={{ marginBottom: 22 }}>
      <div className="kicker" style={{ marginBottom: 4 }}>
        {kicker}
      </div>
      <h2 className="h-sec" style={{ marginBottom: 16 }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex" style={{ gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>{children}</div>;
}

const TOKENS: { label: string; var: string }[] = [
  { label: 'ink', var: '--ink' },
  { label: 'surface', var: '--surface' },
  { label: 'raised', var: '--raised' },
  { label: 'overlay', var: '--overlay' },
  { label: 'border', var: '--border' },
  { label: 'text', var: '--text' },
  { label: 'muted', var: '--muted' },
  { label: 'cyan', var: '--cyan-bright' },
  { label: 'win', var: '--win' },
  { label: 'loss', var: '--loss' },
  { label: 'gold', var: '--gold' },
  { label: 'amber', var: '--amber-acc' },
  { label: 'sapphire', var: '--sapphire-acc' },
  { label: 'brass', var: '--brass-edge' },
];

const heroColumns: DataTableColumn<SampleHero>[] = [
  {
    key: 'hero',
    header: 'Hero',
    sortValue: (h) => h.name,
    render: (h) => (
      <div className="flex" style={{ alignItems: 'center', gap: 10 }}>
        <GameIcon kind="hero" name={h.name} src={heroImg(h.id)} size={30} />
        <span className="display" style={{ fontWeight: 600 }}>
          {h.name}
        </span>
      </div>
    ),
  },
  { key: 'tier', header: 'Tier', sortValue: (h) => h.tier, render: (h) => <TierPill tier={h.tier} /> },
  { key: 'wr', header: 'Win rate', numeric: true, sortValue: (h) => h.wr, render: (h) => <WinBar wr={h.wr} /> },
  { key: 'trend', header: '7d', numeric: true, sortValue: (h) => h.trend, render: (h) => <Delta value={h.trend} /> },
  {
    key: 'pick',
    header: 'Pick %',
    numeric: true,
    sortValue: (h) => h.pick,
    render: (h) => <span className="tnum">{h.pick.toFixed(1)}%</span>,
  },
  {
    key: 'kda',
    header: 'KDA',
    numeric: true,
    sortValue: (h) => h.kda,
    render: (h) => <span className="tnum">{h.kda.toFixed(2)}</span>,
  },
];

export default function Styleguide() {
  const [bracket, setBracket] = useState<BracketValue>('all');
  const [loadingTable, setLoadingTable] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);

  return (
    <div className="container">
      <div className="between" style={{ marginBottom: 22, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="kicker">Design system</div>
          <h1 className="h-page">RankLock styleguide</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Gaslamp tokens · 5 skins · component library. Switch a skin → the whole page recolors, no layout shift.
          </p>
        </div>
        <ThemeSwitcher />
      </div>

      <Section kicker="Brand" title="Wordmark">
        <Row>
          <Wordmark />
        </Row>
      </Section>

      <Section kicker="Tokens" title="Color ramp">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {TOKENS.map((t) => (
            <div key={t.var} style={{ width: 92 }}>
              <div
                style={{
                  height: 48,
                  borderRadius: 'var(--r-card)',
                  border: '1px solid var(--border)',
                  background: `var(${t.var})`,
                }}
              />
              <div className="label-xs" style={{ marginTop: 6 }}>
                {t.label}
              </div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--faint)' }}>
                {t.var}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section kicker="Tokens" title="Typography">
        <div className="h-hero">Heading hero · 54</div>
        <div className="h-page" style={{ marginTop: 8 }}>
          Heading page · 30
        </div>
        <div className="h-sec" style={{ marginTop: 8 }}>
          Heading section · 20
        </div>
        <div className="kicker" style={{ marginTop: 10 }}>
          Kicker · uppercase tracked
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          Body copy in the system font. <span className="tnum">1,234,567</span> renders with tabular numerals via{' '}
          <code className="mono">.tnum</code>.
        </p>
      </Section>

      <Section kicker="Controls" title="Buttons & fields">
        <Row>
          <button className="btn btn-primary">Primary</button>
          <button className="btn btn-brass">Brass</button>
          <button className="btn">Default</button>
          <button className="btn btn-ghost">Ghost</button>
          <input className="field" style={{ maxWidth: 240 }} placeholder="Search player…" />
        </Row>
      </Section>

      <Section kicker="Surfaces" title="Panels, tiles & brass frame">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
          <div className="panel panel-pad">
            <div className="label-xs">.panel</div>
            <p className="muted" style={{ marginTop: 6 }}>
              Elevated surface with a top highlight.
            </p>
          </div>
          <div className="tile" style={{ padding: '16px' }}>
            <div className="label-xs">.tile</div>
            <p className="muted" style={{ marginTop: 6 }}>
              Inner raised surface.
            </p>
          </div>
          <div className="brass-frame" style={{ padding: '18px', position: 'relative' }}>
            <span className="corner tl" />
            <span className="corner tr" />
            <span className="corner bl" />
            <span className="corner br" />
            <div className="label-xs">.brass-frame</div>
            <p className="muted" style={{ marginTop: 6 }}>
              The gaslamp instrument look + filigree corners.
            </p>
          </div>
        </div>
        <div className="deco-rule" style={{ marginTop: 18 }}>
          <span className="dia" />
        </div>
      </Section>

      <Section kicker="Indicators" title="Badges, chips & momentum">
        <Row>
          <RankBadge tier={7} sub={4} showLabel size={48} />
          <RankBadge tier={11} sub={6} showLabel size={48} />
          <RankBadge tier={4} size={40} />
        </Row>
        <Row>
          <TierPill tier="S" />
          <TierPill tier="A" />
          <TierPill tier="B" />
          <TierPill tier="C" />
          <TierPill tier="D" />
          <MvpBadge rank={1} />
          <MvpBadge rank={3} />
          <Chip tone="win">Win</Chip>
          <Chip tone="loss">Loss</Chip>
          <Chip tone="gold">Supporter</Chip>
          <Chip>Neutral</Chip>
        </Row>
        <Row>
          <Delta value={3.1} />
          <Delta value={-2.2} />
          <Delta value={0} />
          <FormDots form={SAMPLE_FORM} />
        </Row>
        <Row>
          <WinBar wr={53.8} />
          <WinBar wr={46.2} />
        </Row>
        <Row>
          <LiveStatChip kind="hero" name="Haze" wr={53.8} iconUrl={heroImg('haze')} />
          <LiveStatChip kind="item" name="Arcane Medallion" wr={54.1} iconUrl={itemImg('tech-arcane_medallion')} />
          <LiveStatChip kind="hero" name="No-art Hero" wr={48.4} />
        </Row>
      </Section>

      <Section kicker="Indicators" title="Stat tiles">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16 }}>
          <StatTile label="Win rate" value="53.8" unit="%" color="var(--win)" icon="target" sub={<Delta value={1.8} />} />
          <StatTile label="Souls / min" value="684" icon="coins" sub={<Delta value={-7.8} better />} />
          <StatTile label="Matches" value="1,840" icon="swords" />
          <StatTile label="Percentile" value="11" unit="th" color="var(--gold)" icon="trophy" />
        </div>
      </Section>

      <Section kicker="Filters" title="Bracket / rank-emblem filter">
        <BracketFilter value={bracket} onChange={setBracket} />
        <p className="muted" style={{ marginTop: 10 }}>
          Selected: <span className="cyan-c">{bracket === 'all' ? 'All brackets' : subLabel(bracket)}</span>
        </p>
      </Section>

      <Section kicker="Data" title="Premium sortable table">
        <Row>
          <button className="btn" onClick={() => setLoadingTable((v) => !v)}>
            <Icon name="bolt" size={13} /> {loadingTable ? 'Show data' : 'Show skeleton'}
          </button>
          <button className="btn" onClick={() => setShowEmpty((v) => !v)}>
            <Icon name="inbox" size={13} /> {showEmpty ? 'Show rows' : 'Show empty state'}
          </button>
        </Row>
        <div style={{ marginTop: 14 }}>
          <DataTable
            columns={heroColumns}
            rows={showEmpty ? [] : HEROES}
            rowKey={(h) => h.id}
            loading={loadingTable}
            initialSort={{ key: 'wr', dir: -1 }}
            caption="Hero meta — win rate, pick rate, KDA by rank bracket"
            emptyTitle="No heroes match"
            emptyMessage="Nothing served for this bracket yet — try another filter."
          />
        </div>
      </Section>

      <Section kicker="States" title="Empty & skeleton">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
          <div className="tile" style={{ padding: 8 }}>
            <EmptyState title="Not served yet" message="This endpoint comes online with the data pipeline (§8.1)." icon="inbox" />
          </div>
          <div className="tile" style={{ padding: 16 }}>
            <Skeleton height={18} style={{ marginBottom: 12 }} />
            <Skeleton lines={4} />
          </div>
        </div>
      </Section>

      <Section kicker="Charts" title="Recharts islands">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16 }}>
          <div className="tile" style={{ padding: 14 }}>
            <div className="label-xs" style={{ marginBottom: 8 }}>
              Playstyle radar
            </div>
            <RadarChart data={RADAR} youLabel="You · Archon IV" cohortLabel="Oracle avg" />
          </div>
          <div className="tile" style={{ padding: 14 }}>
            <div className="label-xs" style={{ marginBottom: 8 }}>
              Economy curve
            </div>
            {/* Labels are now caller-composed (no jargon defaults) — a series renders only
                while its label is passed, so the demo names its two league slots. */}
            <EconomyCurve data={ECON_CURVE} youLabel="League A average" cohortLabel="League B average" />
          </div>
          <div className="tile" style={{ padding: 14 }}>
            <div className="label-xs" style={{ marginBottom: 8 }}>
              Gold-source breakdown
            </div>
            <SourceBreakdown data={SOURCES} />
          </div>
          <div className="tile" style={{ padding: 14 }}>
            <div className="label-xs" style={{ marginBottom: 8 }}>
              Match net-worth lead (amber ⇄ sapphire)
            </div>
            <MatchEconChart data={MATCH_ECON} />
          </div>
        </div>
      </Section>

      <Section kicker="Monetization" title="Ad slots (re-skinned)">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
          <AdSlot kind="banner" />
          <AdSlot kind="rect" />
        </div>
        <p className="faint" style={{ fontSize: 12, marginTop: 10 }}>
          The AdSense fill loads once a publisher/slot id is configured — ads consent is
          gathered by Google's own CMP. Otherwise this gaslamp placeholder shows — never a
          network call.
        </p>
      </Section>

      <Section kicker="Privacy" title="Consent (gaslamp re-skin)">
        <p className="muted" style={{ fontSize: 13, margin: '0 0 14px', maxWidth: '64ch' }}>
          Analytics consent, persisted to{' '}
          <code className="mono">localStorage['ranklock-consent']</code>. The same control
          lives on <a href="/privacy#consent">/privacy</a>. Nothing tracks until accepted.
          Ads consent belongs to Google's CMP.
        </p>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ marginBottom: 16 }}
          onClick={() => reopenBanner()}
        >
          <Icon name="shield" size={15} /> Preview the consent banner
        </button>
        <ConsentManager />
      </Section>

      <Section kicker="Reference" title="Leaderboard rows">
        <DataTable
          columns={[
            { key: 'rank', header: '#', numeric: true, sortValue: (r) => r.rank, render: (r) => <span className="rank-num">{r.rank}</span> },
            {
              key: 'name',
              header: 'Player',
              sortValue: (r) => r.name,
              render: (r) => (
                <div className="flex" style={{ alignItems: 'center', gap: 10 }}>
                  <RankBadge tier={r.tier} size={26} glow={false} />
                  <span className="display" style={{ fontWeight: 600 }}>
                    {r.name}
                  </span>
                </div>
              ),
            },
            { key: 'region', header: 'Region', sortValue: (r) => r.region, render: (r) => <Chip>{r.region}</Chip> },
            { key: 'wr', header: 'Win rate', numeric: true, sortValue: (r) => r.wr, render: (r) => <WinBar wr={r.wr} /> },
            {
              key: 'games',
              header: 'Games',
              numeric: true,
              sortValue: (r) => r.games,
              render: (r) => <span className="tnum">{r.games.toLocaleString()}</span>,
            },
            {
              key: 'pp',
              header: 'Points',
              numeric: true,
              sortValue: (r) => r.pp,
              render: (r) => <span className="tnum">{r.pp.toLocaleString()}</span>,
            },
          ]}
          rows={LEADERS}
          rowKey={(r) => r.rank}
          initialSort={{ key: 'rank', dir: 1 }}
          caption="Top players by ranked points"
        />
      </Section>
    </div>
  );
}
