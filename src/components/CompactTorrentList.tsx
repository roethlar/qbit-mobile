import { useState, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Torrent } from '../types/qbittorrent';
import { PAUSED_STATES_SET } from '../types/qbittorrent';
import { MoveLocationSheet } from './MoveLocationSheet';
import { ConfirmDeleteSheet } from './ConfirmDeleteSheet';
import { CompactTorrentRow, type RowAction, type SwipeAction } from './CompactTorrentRow';
import { TorrentListToolbar } from './TorrentListToolbar';
import type { SortField, SortOrder } from '../hooks/useTorrentFilters';

const isPausedState = (state: Torrent['state']) => PAUSED_STATES_SET.has(state);

interface CompactTorrentListProps {
  // visibleTorrents: post-everything-filter list this component should render.
  // unfilteredCount: denominator for the "N/M" toolbar count — typically the
  //   length of the parent's top-bar-filtered list, before search/tag/sort.
  visibleTorrents: Torrent[];
  unfilteredCount: number;
  onPause: (hash: string) => void;
  onResume: (hash: string) => void;
  onDelete: (hash: string, deleteFiles?: boolean) => void;
  onSetLocation: (hashes: string[], location: string) => Promise<void>;
  onTorrentClick?: (torrent: Torrent) => void;
  selectMode?: boolean;
  selectedHashes?: ReadonlySet<string>;
  onToggleSelect?: (hash: string) => void;
  // Search / sort / tag state lifted to the parent so "select all visible"
  // and the displayed counts agree on what "visible" means.
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  sortBy: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  selectedTag: string;
  onSelectedTagChange: (tag: string) => void;
  availableTags: string[];
}

export function CompactTorrentList({
  visibleTorrents,
  unfilteredCount,
  onPause,
  onResume,
  onDelete,
  onSetLocation,
  onTorrentClick,
  selectMode = false,
  selectedHashes,
  onToggleSelect,
  searchQuery,
  onSearchQueryChange,
  sortBy,
  sortOrder,
  onSort,
  selectedTag,
  onSelectedTagChange,
  availableTags,
}: CompactTorrentListProps) {
  const [expandedHash, setExpandedHash] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Torrent | null>(null);
  const [pendingMove, setPendingMove] = useState<Torrent | null>(null);

  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: visibleTorrents.length,
    getScrollElement: () => parentRef.current,
    // Rough average for collapsed rows; measureElement remeasures when a row
    // expands (or collapses) so the virtualizer reflows around the new height.
    estimateSize: () => 46,
    overscan: 6,
    getItemKey: (index) => visibleTorrents[index]?.hash ?? index,
  });

  const handleRowClick = useCallback(
    (torrent: Torrent) => {
      if (selectMode) {
        onToggleSelect?.(torrent.hash);
        return;
      }
      setExpandedHash((prev) => (prev === torrent.hash ? null : torrent.hash));
    },
    [selectMode, onToggleSelect],
  );

  const handleRowAction = useCallback(
    (torrent: Torrent, action: RowAction) => {
      switch (action) {
        case 'toggle':
          if (isPausedState(torrent.state)) onResume(torrent.hash);
          else onPause(torrent.hash);
          break;
        case 'delete':
          setPendingDelete(torrent);
          break;
        case 'move':
          setPendingMove(torrent);
          break;
        case 'detail':
          onTorrentClick?.(torrent);
          break;
      }
    },
    [onPause, onResume, onTorrentClick],
  );

  // Swipe gestures funnel into the same confirmation flows as the action grid
  // and bulk-select toolbar, so destructive actions always require a tap to
  // commit.
  const handleSwipeAction = useCallback(
    (torrent: Torrent, action: SwipeAction) => {
      if (action === 'delete') setPendingDelete(torrent);
      else setPendingMove(torrent);
    },
    [],
  );

  if (unfilteredCount === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No torrents</h3>
          <p className="text-gray-500">Add a torrent to get started</p>
        </div>
      </div>
    );
  }

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TorrentListToolbar
        visibleCount={visibleTorrents.length}
        unfilteredCount={unfilteredCount}
        searchQuery={searchQuery}
        onSearchQueryChange={onSearchQueryChange}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={onSort}
        selectedTag={selectedTag}
        onSelectedTagChange={onSelectedTagChange}
        availableTags={availableTags}
      />

      <div ref={parentRef} className="flex-1 overflow-auto" style={{ contain: 'strict' }}>
        <div
          style={{
            height: rowVirtualizer.getTotalSize(),
            position: 'relative',
            width: '100%',
          }}
        >
          {virtualItems.map((virtualRow) => {
            const torrent = visibleTorrents[virtualRow.index];
            if (!torrent) return null;
            const isSelected = selectedHashes ? selectedHashes.has(torrent.hash) : false;
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <CompactTorrentRow
                  torrent={torrent}
                  selectMode={selectMode}
                  isSelected={isSelected}
                  isExpanded={expandedHash === torrent.hash}
                  onClick={handleRowClick}
                  onAction={handleRowAction}
                  onSwipeAction={handleSwipeAction}
                />
              </div>
            );
          })}
        </div>
      </div>

      <MoveLocationSheet
        isOpen={!!pendingMove}
        onClose={() => setPendingMove(null)}
        currentPath={pendingMove?.save_path ?? ''}
        subject={pendingMove?.name ?? ''}
        onSubmit={(location) =>
          pendingMove ? onSetLocation([pendingMove.hash], location) : Promise.resolve()
        }
      />

      <ConfirmDeleteSheet
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        subject={pendingDelete?.name ?? ''}
        onConfirm={(deleteFiles) => {
          if (pendingDelete) onDelete(pendingDelete.hash, deleteFiles);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
