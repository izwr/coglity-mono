import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type OnChangeFn,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { CountResult } from '@coglity/shared';
import { useDensity } from '../../theme/DensityContext';
import { formatCount, formatExact } from '../../lib/format';

export interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  getRowId: (row: T) => string;
  /** Total matching rows (first page of the cursor list); ≈ when estimated. */
  totalCount?: CountResult | null;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => void;
  isLoading?: boolean;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  /** Whitelist mirroring the backend sortBy contract. */
  sortableColumnIds?: string[];
  onRowClick?: (row: T) => void;
  /** Scroll container height. The grid owns its own scrolling. */
  height?: string;
  enableRowSelection?: boolean;
  selectedIds?: ReadonlySet<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  emptyState?: ReactNode;
  overscan?: number;
}

const SELECT_COL_WIDTH = 36;
const DEFAULT_COL_WIDTH = 150;
const FETCH_AHEAD_ROWS = 20;

export function DataTable<T>({
  columns,
  data,
  getRowId,
  totalCount,
  hasNextPage = false,
  isFetchingNextPage = false,
  fetchNextPage,
  isLoading = false,
  sorting = [],
  onSortingChange,
  sortableColumnIds = [],
  onRowClick,
  height = 'calc(100vh - 320px)',
  enableRowSelection = false,
  selectedIds,
  onSelectionChange,
  emptyState,
  overscan = 12,
}: DataTableProps<T>) {
  const { density } = useDensity();
  const rowHeight = density === 'compact' ? 32 : 40;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange,
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => getRowId(row),
  });

  const rows = table.getRowModel().rows;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    getItemKey: (index) => rows[index]?.id ?? index,
    overscan,
  });

  // Density flips change the fixed row height; remeasure everything once.
  useEffect(() => {
    virtualizer.measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowHeight]);

  const virtualItems = virtualizer.getVirtualItems();

  // Infinite trigger: fetch when the viewport nears the loaded tail.
  const lastVirtualIndex = virtualItems.length ? virtualItems[virtualItems.length - 1].index : -1;
  useEffect(() => {
    if (
      fetchNextPage &&
      hasNextPage &&
      !isFetchingNextPage &&
      rows.length > 0 &&
      lastVirtualIndex >= rows.length - FETCH_AHEAD_ROWS
    ) {
      fetchNextPage();
    }
  }, [lastVirtualIndex, hasNextPage, isFetchingNextPage, fetchNextPage, rows.length]);

  const minWidth = useMemo(() => {
    const colsWidth = columns.reduce((sum, col) => sum + (col.size ?? DEFAULT_COL_WIDTH), 0);
    return colsWidth + (enableRowSelection ? SELECT_COL_WIDTH : 0);
  }, [columns, enableRowSelection]);

  const toggleSelected = (id: string) => {
    if (!onSelectionChange) return;
    const next = new Set(selectedIds ?? []);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const loadedIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allLoadedSelected =
    loadedIds.length > 0 && loadedIds.every((id) => selectedIds?.has(id) ?? false);

  const toggleAllLoaded = () => {
    if (!onSelectionChange) return;
    onSelectionChange(allLoadedSelected ? new Set() : new Set(loadedIds));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (rows.length === 0) return;
    let next = activeIndex;
    if (e.key === 'ArrowDown') next = Math.min(rows.length - 1, activeIndex + 1);
    else if (e.key === 'ArrowUp') next = Math.max(0, activeIndex === -1 ? 0 : activeIndex - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = rows.length - 1;
    else if (e.key === 'Enter' && activeIndex >= 0) {
      onRowClick?.(rows[activeIndex].original);
      return;
    } else if (e.key === ' ' && enableRowSelection && activeIndex >= 0) {
      e.preventDefault();
      toggleSelected(rows[activeIndex].id);
      return;
    } else {
      return;
    }
    e.preventDefault();
    setActiveIndex(next);
    virtualizer.scrollToIndex(next);
  };

  const colStyle = (size: number | undefined, flex: boolean | undefined) =>
    flex
      ? { flex: '1 1 auto', minWidth: size ?? DEFAULT_COL_WIDTH }
      : { flex: `0 0 ${size ?? DEFAULT_COL_WIDTH}px`, width: size ?? DEFAULT_COL_WIDTH };

  const skeletonCount = Math.min(14, Math.max(6, Math.floor(560 / rowHeight)));

  return (
    <div className="dt" style={{ height }}>
      <div
        ref={scrollRef}
        className="dt-scroll"
        role="grid"
        aria-rowcount={totalCount?.value ?? rows.length}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        aria-activedescendant={activeIndex >= 0 ? `dt-row-${rows[activeIndex]?.id}` : undefined}
      >
        <div className="dt-head" style={{ minWidth }}>
          {enableRowSelection && (
            <div className="dt-th dt-check" style={{ flex: `0 0 ${SELECT_COL_WIDTH}px` }}>
              <input
                type="checkbox"
                aria-label="Select all loaded rows"
                checked={allLoadedSelected}
                onChange={toggleAllLoaded}
              />
            </div>
          )}
          {table.getHeaderGroups().map((headerGroup) =>
            headerGroup.headers.map((header) => {
              const sortable = sortableColumnIds.includes(header.column.id);
              const sortDir = sorting.find((s) => s.id === header.column.id);
              const meta = header.column.columnDef.meta as { flex?: boolean } | undefined;
              return (
                <div
                  key={header.id}
                  className={`dt-th${sortable ? ' sortable' : ''}`}
                  style={colStyle(header.column.columnDef.size, meta?.flex)}
                  onClick={
                    sortable ? header.column.getToggleSortingHandler() : undefined
                  }
                  role="columnheader"
                  aria-sort={
                    sortDir ? (sortDir.desc ? 'descending' : 'ascending') : undefined
                  }
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {sortDir && <span className="sort-arrow">{sortDir.desc ? '▼' : '▲'}</span>}
                </div>
              );
            }),
          )}
        </div>

        {isLoading ? (
          <div style={{ minWidth }}>
            {Array.from({ length: skeletonCount }, (_, i) => (
              <div key={i} className="skel-row" aria-hidden>
                <div className="skel" style={{ width: '24%', height: 12 }} />
                <div className="skel" style={{ width: '12%', height: 12 }} />
                <div className="skel" style={{ width: '32%', height: 12 }} />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          (emptyState ?? (
            <div className="empty--inline">
              <span className="microlabel">No matches</span>
              <div className="sub">Nothing matches these filters.</div>
            </div>
          ))
        ) : (
          <div
            className="dt-spacer"
            style={{ height: virtualizer.getTotalSize(), minWidth }}
          >
            {virtualItems.map((virtualRow) => {
              const row = rows[virtualRow.index];
              const selected = selectedIds?.has(row.id) ?? false;
              const active = virtualRow.index === activeIndex;
              return (
                <div
                  key={row.id}
                  id={`dt-row-${row.id}`}
                  role="row"
                  aria-selected={selected || undefined}
                  className={`dt-row${onRowClick ? ' clickable' : ''}${selected ? ' selected' : ''}${active ? ' active' : ''}`}
                  style={{ transform: `translateY(${virtualRow.start}px)`, minWidth }}
                  onClick={() => {
                    setActiveIndex(virtualRow.index);
                    onRowClick?.(row.original);
                  }}
                >
                  {enableRowSelection && (
                    <div
                      className="dt-cell dt-check"
                      style={{ flex: `0 0 ${SELECT_COL_WIDTH}px` }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        aria-label="Select row"
                        checked={selected}
                        onChange={() => toggleSelected(row.id)}
                      />
                    </div>
                  )}
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as { flex?: boolean } | undefined;
                    return (
                      <div
                        key={cell.id}
                        className="dt-cell"
                        role="gridcell"
                        style={colStyle(cell.column.columnDef.size, meta?.flex)}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="dt-footer">
        <span>
          {isLoading
            ? '—'
            : totalCount
              ? `showing ${formatExact(rows.length)} of ${formatCount(totalCount)}`
              : `showing ${formatExact(rows.length)}`}
        </span>
        <span>{isFetchingNextPage ? 'loading more…' : hasNextPage ? 'scroll for more' : ''}</span>
      </div>
    </div>
  );
}
