//Lab §3 — the design's one framed card: the import field, the "start from" presets built out of
//served data, and the imported-build header with its four metric tiles. Every tile prints its
//window or the honest gap; nothing here computes a number the model did not hand it.
import { useState } from 'react';
import { GameIcon } from '../ui/index';
import { count, DASH, pct } from '../../../lib/format';
import { IMPORT_CODE_NOTE, IMPORT_PLACEHOLDER, parseImport, type ImportRef } from './analyzeModel';
import type { StartFromPreset } from './createModel';

export interface ImportedHeader {
  heroName: string | null;
  heroIcon: string | null;
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
}

function Metric({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="lab-mcard">
      <div className="lab-mcard-l">{label}</div>
      <div className="lab-mcard-v" style={color ? { color } : undefined}>{value}</div>
      <div className="lab-mcard-s">{sub}</div>
    </div>
  );
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
}: ImportPanelProps) {
  const [text, setText] = useState('');

  return (
    <section className="lab-frame lab-import">
      <form
        className="lab-import-row"
        onSubmit={(e) => {
          e.preventDefault();
          onImport(parseImport(text));
        }}
      >
        <span className="lab-idfield" title={IMPORT_CODE_NOTE}>
          <span className="lab-idtag">ID</span>
          <input
            value={text}
            placeholder={IMPORT_PLACEHOLDER}
            aria-label="Build id or RankLock share link"
            onChange={(e) => setText(e.target.value)}
          />
        </span>
        <button type="submit" className="btn btn-brass lab-go" disabled={pending}>
          {pending ? 'Importing…' : 'Import build'}
        </button>
      </form>
      {error && (
        <p className="loss-c" style={{ fontSize: 12.5, margin: 0 }} role="alert">{error}</p>
      )}

      <div className="lab-pickrow">
        <span className="label-xs" style={{ letterSpacing: '0.16em' }}>Or start from</span>
        {presets.map((p) => (
          <button
            key={p.key}
            type="button"
            className={'lab-pick' + (activePreset === p.key ? ' on' : '')}
            title={p.hint}
            disabled={p.itemIds.length === 0}
            onClick={() => onPreset(p)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {header && (
        <div className="lab-imported">
          <div className="lab-imported-id">
            <GameIcon kind="hero" name={header.heroName ?? 'Hero'} src={header.heroIcon} size={48} />
            <div style={{ minWidth: 0 }}>
              <div className="flex" style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="lab-imported-name">{header.title}</span>
                {header.fresh && <span className="lab-fresh">This patch</span>}
              </div>
              <div className="lab-imported-meta">
                {[
                  header.author,
                  header.heroName,
                  `updated ${header.updated}`,
                  `${header.categories} categories, ${header.items} items, ${header.points} ability points`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
          </div>

          <div className="lab-mcards">
            <Metric
              label="30-day WR"
              value={header.winRate == null ? DASH : pct(header.winRate)}
              sub={header.matches == null ? 'no served 30-day row' : `${count(header.matches)} matches`}
              color={header.winRate == null ? undefined : 'var(--win)'}
            />
            <Metric
              label="Weekly ♥"
              value={header.weekly == null ? DASH : count(header.weekly)}
              sub="favourites, last 7 days"
            />
            <Metric
              label="Price"
              value={count(header.price)}
              sub={`souls · ${header.owned} items owned`}
              color="var(--gold)"
            />
            <Metric label="Affordable" value={header.afford} sub={header.affordNote} />
          </div>

          <div className="flex" style={{ gap: 8 }}>
            <button type="button" className="btn btn-ghost btn-caps" style={{ borderRadius: 4 }} onClick={onEditCopy}>
              Edit a copy
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
