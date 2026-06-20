//Player search island (mount with client:load — used in the nav, compact, and
//on the home hero, large). Debounced typeahead against /players/search; results
//link to the CSR player profile (/players/:id). Build-ahead safe: an offline API
//or no matches shows a message, never a crash. Enter on a numeric query jumps
//straight to that account id.
import { useEffect, useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, queryKeys, isUnauthorized } from '../../lib/apiClient';
import QueryProvider from './QueryProvider';
import { Icon, RankBadge } from './ui/index';
import { rankFromBadge } from '../../lib/ranks';
import { count } from '../../lib/format';

function goTo(href: string) {
  if (typeof window !== 'undefined') window.location.href = href;
}

interface SearchBoxProps {
  variant?: 'large' | 'compact';
  placeholder?: string;
}

function SearchInner({ variant = 'large', placeholder }: SearchBoxProps) {
  const [raw, setRaw] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const listId = useId();

  //debounce the query the API actually sees (250ms)
  useEffect(() => {
    const t = setTimeout(() => setQ(raw.trim()), 250);
    return () => clearTimeout(t);
  }, [raw]);

  const enabled = q.length >= 2;
  const { data, isFetching, isError, error } = useQuery({
    queryKey: queryKeys.search(q),
    queryFn: () => api.searchPlayers(q, 8),
    enabled,
  });

  const results = data ?? [];

  function onSubmit() {
    const term = raw.trim();
    if (/^\d{3,}$/.test(term)) {
      goTo(`/players/${term}`);
      return;
    }
    const first = results[0];
    if (first) goTo(`/players/${first.account_id}`);
  }

  const compact = variant === 'compact';

  return (
    <div className="searchbig" style={compact ? { minWidth: 0 } : undefined}>
      <Icon name="search" size={compact ? 16 : 20} style={compact ? { left: 12 } : undefined} />
      <input
        className="field"
        style={compact ? { height: 38, paddingLeft: 36, fontSize: 13, maxWidth: '100%', minWidth: 0 } : undefined}
        placeholder={placeholder ?? 'Search a player, Steam ID, or hero…'}
        value={raw}
        onChange={(e) => {
          setRaw(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit();
          if (e.key === 'Escape') setOpen(false);
        }}
        role="combobox"
        aria-expanded={open && enabled}
        aria-controls={listId}
        aria-label="Search players"
        autoComplete="off"
      />
      {open && enabled && (
        <div className="search-pop panel" id={listId} role="listbox">
          {isFetching && results.length === 0 ? (
            <div className="search-note muted">Searching…</div>
          ) : isError ? (
            <div className="search-note muted">
              {isUnauthorized(error) ? 'Sign in to search.' : 'Search is offline right now.'}
            </div>
          ) : results.length === 0 ? (
            <div className="search-note muted">No players found for “{q}”.</div>
          ) : (
            results.map((r) => {
              const rk = rankFromBadge(r.badge);
              return (
                <a key={r.account_id} className="search-row" href={`/players/${r.account_id}`} role="option" aria-selected="false">
                  {rk && <RankBadge tier={rk.tier} size={24} glow={false} />}
                  <span className="display" style={{ flex: 1, fontWeight: 600, color: 'var(--text)' }}>
                    {r.steam_name}
                  </span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {count(r.matches)} games
                  </span>
                </a>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default function SearchBox(props: SearchBoxProps) {
  return (
    <QueryProvider>
      <SearchInner {...props} />
    </QueryProvider>
  );
}
