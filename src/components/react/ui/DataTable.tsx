//Premium sortable data table — the workhorse for heroes/items/leaderboard.
//
//Features: client-side sort with a real <button> in each sortable <th> (keyboard
//+ screen-reader friendly) and aria-sort on the header; skeleton rows while
//loading; an empty/zero state when there are no rows; inline cell renderers (so a
//column can render a <WinBar> bar+glyph, a <RankBadge>, etc.). Generic over the
//row type T.
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Skeleton from './Skeleton';
import EmptyState from './EmptyState';
import Icon, { type IconName } from './Icon';

export interface DataTableColumn<T> {
  //unique column id (also the sort key)
  key: string;
  header: ReactNode;
  //right-align + tabular-nums
  numeric?: boolean;
  //comparable value for sorting; provide it to make the column sortable
  sortValue?: (row: T) => number | string | null | undefined;
  //explicitly disable sorting even when sortValue is present
  sortable?: boolean;
  //cell renderer
  render: (row: T) => ReactNode;
  width?: number | string;
}

interface SortState {
  key: string;
  dir: 1 | -1;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string | number;
  loading?: boolean;
  skeletonRows?: number;
  initialSort?: SortState;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyIcon?: IconName;
  //screen-reader caption describing the table
  caption?: string;
}

function isSortable<T>(col: DataTableColumn<T>): boolean {
  return col.sortable !== false && typeof col.sortValue === 'function';
}

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  skeletonRows = 8,
  initialSort,
  emptyTitle = 'Nothing here yet',
  emptyMessage = 'No rows to show.',
  emptyIcon = 'inbox',
  caption,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState | null>(initialSort ?? null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col || !col.sortValue) return rows;
    const sv = col.sortValue;
    const copy = [...rows];
    copy.sort((a, b) => {
      const va = sv(a);
      const vb = sv(b);
      //nulls/undefined always sort to the bottom regardless of direction
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      const cmp =
        typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return cmp * sort.dir;
    });
    return copy;
  }, [rows, sort, columns]);

  function onSort(key: string) {
    setSort((s) => (s && s.key === key ? { key, dir: (s.dir === 1 ? -1 : 1) as 1 | -1 } : { key, dir: -1 }));
  }

  function ariaSort(col: DataTableColumn<T>): 'ascending' | 'descending' | 'none' {
    if (!sort || sort.key !== col.key) return 'none';
    return sort.dir === 1 ? 'ascending' : 'descending';
  }

  return (
    <div className="dt-wrap">
      <table className="dt">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((col) => {
              const sortableCol = isSortable(col);
              const dir = ariaSort(col);
              return (
                <th
                  key={col.key}
                  className={col.numeric ? 'num' : undefined}
                  aria-sort={sortableCol ? dir : undefined}
                  style={col.width ? { width: col.width } : undefined}
                  scope="col"
                >
                  {sortableCol ? (
                    <button type="button" className="th-btn" onClick={() => onSort(col.key)}>
                      {col.header}
                      {dir !== 'none' && (
                        <Icon name={dir === 'ascending' ? 'up' : 'down'} size={10} className="ar" />
                      )}
                    </button>
                  ) : (
                    <span className="th-static">{col.header}</span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: skeletonRows }, (_, r) => (
              <tr key={`skel-${r}`}>
                {columns.map((col) => (
                  <td key={col.key} className={col.numeric ? 'num' : undefined}>
                    <Skeleton width={col.numeric ? 48 : '80%'} height={12} style={col.numeric ? { marginLeft: 'auto' } : undefined} />
                  </td>
                ))}
              </tr>
            ))
          ) : sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                <EmptyState title={emptyTitle} message={emptyMessage} icon={emptyIcon} />
              </td>
            </tr>
          ) : (
            sorted.map((row, i) => (
              <tr key={rowKey(row, i)}>
                {columns.map((col) => (
                  <td key={col.key} className={col.numeric ? 'num' : undefined}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
