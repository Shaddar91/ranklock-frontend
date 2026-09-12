//Lab §3 — the import field, the "start from" presets built out of served data, and the
//imported-build header with its four metric tiles. Every tile prints its window or the
//honest gap; nothing here computes a number the model did not hand it.
import { useState } from 'react';
import { EmptyState, StatTile } from '../ui/index';
import { count, DASH, pct } from '../../../lib/format';
import { IMPORT_CODE_NOTE, IMPORT_PLACEHOLDER, parseImport, type ImportRef } from './analyzeModel';

export interface StartFromPreset {
  key: string;
  label: string;
  hint: string;
  itemIds: number[];
}

export interface ImportedHeader {
  heroName: string | null;
  title: string;
  author: string;
  updated: string;
  fresh: boolean;
  weekly: number | null;
  categories: number;
  items: number;
  points: number;
  winRate: number | null;
  matches: number | null;
  price: number;
  owned: number;
  afford: string;
  affordNote: string;
}

interface ImportPanelProps {
  onImport: (ref: ImportRef) => void;
  pending: boolean;
  error: string | null;
  presets: StartFromPreset[];
  activePreset: string | null;
  onPreset: (preset: StartFromPreset) => void;
  header: ImportedHeader | null;
  onEditCopy: () => void;
  paceSwitch: React.ReactNode;
}

export default function ImportPanel({
  onImport,
  pending,
  error,
  presets,
  activePreset,
  onPreset,
  header,
  onEditCopy,
  paceSwitch,
}: ImportPanelProps) {
  const [text, setText] = useState('');

  return (
    <section className="grid" style={{ gap: 14 }}>
      <form
        className="flex"
        style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}
        onSubmit={(e) => {
          e.preventDefault();
          onImport(parseImport(text));
        }}
      >
        <input
          className="field"
          style={{ flex: '1 1 340px', minWidth: 0 }}
          value={text}
          placeholder={IMPORT_PLACEHOLDER}
          aria-label="Build id or RankLock share link"
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn btn-brass" style={{ padding: '8px 16px' }} disabled={pending}>
          {pending ? 'Importing…' : 'Import build'}
        </button>
      </form>
      <p className="faint" style={{ fontSize: 12, margin: 0 }}>{IMPORT_CODE_NOTE}</p>
      {error && (
        <p className="loss-c" style={{ fontSize: 12.5, margin: 0 }} role="alert">
          {error}
        </p>
      )}

      <div className="flex" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="label-xs">Or start from</span>
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            className={'tab' + (activePreset === p.key ? ' on' : '')}
            style={{ padding: '4px 11px', fontSize: 12 }}
            title={p.hint}
            disabled={p.itemIds.length === 0}
            onClick={() => onPreset(p)}
          >
            {p.label}
            <span className="faint tnum" style={{ marginLeft: 6 }}>{p.itemIds.length}</span>
          </button>
        ))}
      </div>

      {header == null ? (
        <EmptyState
          title="Nothing imported yet"
          message="Paste a build id or a RankLock share link, or start from one of the served sets above."
          icon="inbox"
        />
      ) : (
        <div className="panel panel-pad grid" style={{ gap: 12 }}>
          <div className="between" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ minWidth: 0 }}>
              <div className="flex" style={{ gap: 9, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="display" style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
                  {header.title}
                </span>
                {header.fresh && (
                  <span
                    className="label-xs"
                    style={{ padding: '2px 8px', borderRadius: 999, border: '1px solid var(--win)', color: 'var(--win)' }}
                  >
                    This patch
                  </span>
                )}
              </div>
              <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>
                {[header.author, header.heroName, `updated ${header.updated}`].filter(Boolean).join(' · ')}
              </div>
              <div className="faint tnum" style={{ fontSize: 12, marginTop: 2 }}>
                {header.categories} categories · {header.items} items · {header.points} ability points
              </div>
            </div>
            <button type="button" className="btn btn-ghost" style={{ padding: '6px 14px' }} onClick={onEditCopy}>
              Edit a copy
            </button>
          </div>

          <div className="stat-grid">
            <StatTile
              label="30-day win rate"
              value={header.winRate == null ? DASH : pct(header.winRate)}
              sub={
                <span className="faint" style={{ fontSize: 11.5 }}>
                  {header.matches == null
                    ? 'Upstream carries no 30-day row for this build at the lobby-average badge floor.'
                    : `${count(header.matches)} matches · rolling 30 days, lobby-average badge floor`}
                </span>
              }
              color={header.winRate == null ? undefined : 'var(--cyan-bright)'}
            />
            <StatTile
              label="Weekly ♥"
              value={header.weekly == null ? DASH : count(header.weekly)}
              sub={<span className="faint" style={{ fontSize: 11.5 }}>Favourites in the last week</span>}
              color="var(--gold)"
            />
            <StatTile
              label="Price"
              value={count(header.price)}
              unit="souls"
              sub={<span className="faint" style={{ fontSize: 11.5 }}>{header.owned} items owned</span>}
              color="var(--amber)"
            />
            <StatTile
              label="Affordable"
              value={header.afford}
              sub={
                <span className="grid" style={{ gap: 5 }}>
                  <span className="faint" style={{ fontSize: 11.5 }}>{header.affordNote}</span>
                  {paceSwitch}
                </span>
              }
            />
          </div>
        </div>
      )}
    </section>
  );
}
