import { useState, useRef, useCallback, memo } from 'react';
import { Play, Pause, Trash2, MoreVertical, Search, X, ArrowUpDown, ArrowUp, ArrowDown, Tag, Check } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Torrent, TorrentState } from '../types/qbittorrent';
import { PAUSED_STATES_SET } from '../types/qbittorrent';
import { formatBytes, formatSpeed, formatProgress, getStateColor, getStateText } from '../utils/formatters';
import { BottomSheet } from './Layout';
import type { SortField, SortOrder } from '../hooks/useTorrentFilters';
import { clsx } from 'clsx';

const isPausedState = (state: TorrentState) => PAUSED_STATES_SET.has(state);

interface CompactTorrentListProps {
  // visibleTorrents: post-everything-filter list this component should render.
  // unfilteredCount: denominator for the "N/M" toolbar count — typically the
  //   length of the parent's top-bar-filtered list, before search/tag/sort.
  visibleTorrents: Torrent[];
  unfilteredCount: number;
  onPause: (hash: string) => void;
  onResume: (hash: string) => void;
  onDelete: (hash: string, deleteFiles?: boolean) => void;
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
  const [selectedTorrent, setSelectedTorrent] = useState<Torrent | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [showSortOptions, setShowSortOptions] = useState(false);

  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: visibleTorrents.length,
    getScrollElement: () => parentRef.current,
    // Rough average; measureElement adjusts per row as it scrolls into view.
    estimateSize: () => 46,
    overscan: 8,
    getItemKey: index => visibleTorrents[index]?.hash ?? index,
  });

  const handleRowClick = useCallback((torrent: Torrent) => {
    if (selectMode) {
      onToggleSelect?.(torrent.hash);
      return;
    }
    onTorrentClick?.(torrent);
  }, [selectMode, onToggleSelect, onTorrentClick]);

  const handleRowActionClick = useCallback((torrent: Torrent, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectMode) {
      onToggleSelect?.(torrent.hash);
      return;
    }
    setSelectedTorrent(torrent);
    setShowActions(true);
  }, [selectMode, onToggleSelect]);

  const handlePauseResume = () => {
    if (!selectedTorrent) return;

    if (isPausedState(selectedTorrent.state)) {
      onResume(selectedTorrent.hash);
    } else {
      onPause(selectedTorrent.hash);
    }
    setShowActions(false);
  };

  const handleDeleteClick = () => {
    setShowActions(false);
    setShowDeleteConfirm(true);
  };

  const handleDelete = (deleteFiles: boolean) => {
    if (selectedTorrent) {
      onDelete(selectedTorrent.hash, deleteFiles);
    }
    setShowDeleteConfirm(false);
    setSelectedTorrent(null);
  };

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
      <div className="bg-white dark:bg-gray-850 border-b border-gray-100 dark:border-gray-700 px-2 py-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {visibleTorrents.length}/{unfilteredCount}
          </span>
          <div className="flex items-center">
            {(availableTags.length > 0 || selectedTag) && (
              <button
                onClick={() => setShowTags(!showTags)}
                aria-label="Filter by tag"
                aria-expanded={showTags}
                className="p-2 text-gray-500 hover:text-gray-700 rounded active:bg-gray-100 relative"
              >
                <Tag className="w-4 h-4" />
                {selectedTag && (
                  <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-primary-600 rounded-full"></span>
                )}
              </button>
            )}
            <button
              onClick={() => setShowSortOptions(!showSortOptions)}
              aria-label="Sort torrents"
              aria-expanded={showSortOptions}
              className="p-2 text-gray-500 hover:text-gray-700 rounded active:bg-gray-100"
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowSearch(!showSearch)}
              aria-label={showSearch ? 'Close search' : 'Search torrents'}
              aria-expanded={showSearch}
              className="p-2 text-gray-500 hover:text-gray-700 rounded active:bg-gray-100"
            >
              {showSearch ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {showSortOptions && (
          <div className="mt-1 p-1 bg-gray-50 dark:bg-gray-800 rounded">
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                { key: 'name' as const, label: 'Name' },
                { key: 'size' as const, label: 'Size' },
                { key: 'progress' as const, label: 'Progress' },
                { key: 'dlspeed' as const, label: 'DL Speed' },
                { key: 'upspeed' as const, label: 'UL Speed' },
                { key: 'added_on' as const, label: 'Date Added' },
                { key: 'state' as const, label: 'Status' }
              ].map((option) => (
                <button
                  key={option.key}
                  onClick={() => onSort(option.key)}
                  className={clsx(
                    'flex items-center justify-between p-2 rounded-lg transition-colors',
                    sortBy === option.key
                      ? 'bg-primary-600 text-white'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 active:bg-gray-100 dark:active:bg-gray-600'
                  )}
                >
                  <span>{option.label}</span>
                  {sortBy === option.key && (
                    sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {showTags && (availableTags.length > 0 || selectedTag) && (
          <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-800 rounded">
            {selectedTag && !availableTags.includes(selectedTag) && (
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">
                No torrents currently carry the tag "{selectedTag}".
              </p>
            )}
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-600">Tags</span>
              {selectedTag && (
                <button
                  onClick={() => onSelectedTagChange('')}
                  className="text-xs text-primary-600 hover:text-primary-800"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => {
                    onSelectedTagChange(selectedTag === tag ? '' : tag);
                    setShowTags(false);
                  }}
                  className={clsx(
                    'px-1.5 py-0.5 rounded text-xs transition-colors',
                    selectedTag === tag
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 active:bg-gray-300 dark:active:bg-gray-600'
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {showSearch && (
          <div className="relative mt-1">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3 h-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Search..."
              className="w-full pl-7 pr-2 py-1 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-transparent"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => onSearchQueryChange('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      <div ref={parentRef} className="flex-1 overflow-auto" style={{ contain: 'strict' }}>
        <div
          style={{
            height: rowVirtualizer.getTotalSize(),
            position: 'relative',
            width: '100%',
          }}
        >
          {virtualItems.map(virtualRow => {
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
                  onClick={handleRowClick}
                  onActionClick={handleRowActionClick}
                />
              </div>
            );
          })}
        </div>
      </div>

      <BottomSheet
        isOpen={showActions}
        onClose={() => setShowActions(false)}
        title={selectedTorrent?.name}
      >
        <div className="p-4 space-y-2">
          <button
            onClick={handlePauseResume}
            className="w-full flex items-center p-4 rounded-xl bg-gray-50 dark:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 transition-colors"
          >
            {selectedTorrent && isPausedState(selectedTorrent.state) ? (
              <Play className="w-5 h-5 mr-3 text-green-600" />
            ) : (
              <Pause className="w-5 h-5 mr-3 text-orange-600" />
            )}
            <span className="text-base font-medium">
              {selectedTorrent && isPausedState(selectedTorrent.state) ? 'Resume' : 'Pause'}
            </span>
          </button>

          <button
            onClick={handleDeleteClick}
            className="w-full flex items-center p-4 rounded-xl bg-red-50 dark:bg-red-900/20 active:bg-red-100 dark:active:bg-red-900/30 transition-colors"
          >
            <Trash2 className="w-5 h-5 mr-3 text-red-600" />
            <span className="text-base font-medium text-red-600">Delete</span>
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Torrent"
      >
        <div className="p-4 space-y-4">
          <p className="text-gray-600">
            Are you sure you want to delete "{selectedTorrent?.name}"?
          </p>

          <div className="space-y-2">
            <button
              onClick={() => handleDelete(false)}
              className="w-full ios-button-secondary"
            >
              Delete torrent only
            </button>

            <button
              onClick={() => handleDelete(true)}
              className="w-full bg-red-600 text-white rounded-xl py-3 px-6 font-medium active:bg-red-700 transition-colors"
            >
              Delete torrent and files
            </button>

            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="w-full ios-button-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

interface CompactTorrentRowProps {
  torrent: Torrent;
  selectMode: boolean;
  isSelected: boolean;
  onClick: (torrent: Torrent) => void;
  onActionClick: (torrent: Torrent, e: React.MouseEvent) => void;
}

const CompactTorrentRow = memo(function CompactTorrentRow({
  torrent,
  selectMode,
  isSelected,
  onClick,
  onActionClick,
}: CompactTorrentRowProps) {
  const isActive = torrent.state === 'downloading' || torrent.state === 'uploading';
  const isPaused = isPausedState(torrent.state);

  return (
    <div
      className={clsx(
        'border-b border-gray-100 dark:border-gray-700 px-2 py-1.5 transition-colors cursor-pointer',
        isSelected
          ? 'bg-primary-50 dark:bg-primary-900/20 border-l-2 border-l-primary-600'
          : 'active:bg-gray-50 dark:active:bg-gray-700',
      )}
      onClick={() => onClick(torrent)}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0 mr-3">
          <div className="flex items-center">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 text-xs leading-tight truncate selectable">
              {torrent.name}
            </h3>
            <span className={clsx('ml-2 text-xs font-medium flex-shrink-0', getStateColor(torrent.state))}>
              {getStateText(torrent.state)}
            </span>
          </div>

          <div
            className="w-full bg-gray-200 rounded-full h-0.5 mt-0.5"
            role="progressbar"
            aria-valuenow={Math.round(torrent.progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${torrent.name} progress`}
          >
            <div
              className={clsx(
                'h-0.5 rounded-full transition-all duration-300',
                isActive ? 'bg-blue-500' : isPaused ? 'bg-gray-400' : 'bg-green-500'
              )}
              style={{ width: `${torrent.progress * 100}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-gray-600 mt-0.5">
            <div className="flex items-center space-x-3">
              <span>{formatProgress(torrent.progress)}</span>
              <span>{formatBytes(torrent.size)}</span>
              {(torrent.dlspeed > 0 || torrent.upspeed > 0) && (
                <div className="flex items-center space-x-1">
                  {torrent.dlspeed > 0 && (
                    <span className="text-blue-600">↓{formatSpeed(torrent.dlspeed)}</span>
                  )}
                  {torrent.upspeed > 0 && (
                    <span className="text-green-600">↑{formatSpeed(torrent.upspeed)}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {selectMode ? (
          <button
            onClick={(e) => onActionClick(torrent, e)}
            aria-label={isSelected ? `Deselect ${torrent.name}` : `Select ${torrent.name}`}
            aria-pressed={isSelected}
            className={clsx(
              'w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
              isSelected
                ? 'bg-primary-600 border-primary-600 text-white'
                : 'border-gray-300 dark:border-gray-500',
            )}
          >
            {isSelected && <Check className="w-4 h-4" />}
          </button>
        ) : (
          <button
            onClick={(e) => onActionClick(torrent, e)}
            aria-label={`Actions for ${torrent.name}`}
            className="p-2 -mr-2 text-gray-400 active:text-gray-600 transition-colors flex-shrink-0"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
});
