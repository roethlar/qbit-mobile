import { useState, useRef, useCallback, memo } from 'react';
import {
  Play, Pause, Trash2, RefreshCw, Radio, FolderInput,
  Search, X, ArrowUpDown, ArrowUp, ArrowDown, Tag, Check, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Torrent, TorrentState } from '../types/qbittorrent';
import { PAUSED_STATES_SET } from '../types/qbittorrent';
import {
  formatBytes, formatSpeed, formatProgress, formatTime, formatRatio, formatDate,
  getStateColor, getStateText,
} from '../utils/formatters';
import { BottomSheet } from './Layout';
import type { SortField, SortOrder } from '../hooks/useTorrentFilters';
import { useTorrentDetailActions } from '../hooks/useTorrentDetail';
import { MoveLocationSheet } from './MoveLocationSheet';
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
  const [showSearch, setShowSearch] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [showSortOptions, setShowSortOptions] = useState(false);

  const { recheck, reannounce } = useTorrentDetailActions();

  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: visibleTorrents.length,
    getScrollElement: () => parentRef.current,
    // Rough average for collapsed rows; measureElement remeasures when a row
    // expands (or collapses) so the virtualizer reflows around the new height.
    estimateSize: () => 46,
    overscan: 6,
    getItemKey: index => visibleTorrents[index]?.hash ?? index,
  });

  const handleRowClick = useCallback((torrent: Torrent) => {
    if (selectMode) {
      onToggleSelect?.(torrent.hash);
      return;
    }
    setExpandedHash((prev) => (prev === torrent.hash ? null : torrent.hash));
  }, [selectMode, onToggleSelect]);

  const handleRowAction = useCallback(
    (torrent: Torrent, action: 'toggle' | 'recheck' | 'reannounce' | 'delete' | 'move' | 'detail') => {
      switch (action) {
        case 'toggle':
          if (isPausedState(torrent.state)) onResume(torrent.hash);
          else onPause(torrent.hash);
          break;
        case 'recheck':
          recheck.mutate(torrent.hash);
          break;
        case 'reannounce':
          reannounce.mutate(torrent.hash);
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
    [onPause, onResume, onTorrentClick, recheck, reannounce],
  );

  const handleDelete = (deleteFiles: boolean) => {
    if (pendingDelete) {
      onDelete(pendingDelete.hash, deleteFiles);
    }
    setPendingDelete(null);
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
            {selectedTag && visibleTorrents.length === 0 && (
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">
                No torrents in the current view match tag "{selectedTag}".
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
                  isExpanded={expandedHash === torrent.hash}
                  onClick={handleRowClick}
                  onAction={handleRowAction}
                  recheckPending={recheck.isPending && recheck.variables === torrent.hash}
                  reannouncePending={reannounce.isPending && reannounce.variables === torrent.hash}
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

      <BottomSheet
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="Delete Torrent"
      >
        <div className="p-4 space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Are you sure you want to delete "{pendingDelete?.name}"?
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
              onClick={() => setPendingDelete(null)}
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

type RowAction = 'toggle' | 'recheck' | 'reannounce' | 'delete' | 'move' | 'detail';

interface CompactTorrentRowProps {
  torrent: Torrent;
  selectMode: boolean;
  isSelected: boolean;
  isExpanded: boolean;
  onClick: (torrent: Torrent) => void;
  onAction: (torrent: Torrent, action: RowAction) => void;
  recheckPending: boolean;
  reannouncePending: boolean;
}

const CompactTorrentRow = memo(function CompactTorrentRow({
  torrent,
  selectMode,
  isSelected,
  isExpanded,
  onClick,
  onAction,
  recheckPending,
  reannouncePending,
}: CompactTorrentRowProps) {
  const isActive = torrent.state === 'downloading' || torrent.state === 'uploading';
  const isPaused = isPausedState(torrent.state);

  return (
    <div
      className={clsx(
        'border-b border-gray-100 dark:border-gray-700 px-2 py-1.5 transition-colors cursor-pointer',
        isSelected
          ? 'bg-primary-50 dark:bg-primary-900/20 border-l-2 border-l-primary-600'
          : isExpanded
            ? 'bg-gray-50 dark:bg-gray-800'
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
            onClick={(e) => { e.stopPropagation(); onClick(torrent); }}
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
          <ChevronDown
            className={clsx(
              'w-4 h-4 text-gray-400 flex-shrink-0 transition-transform',
              isExpanded && 'rotate-180',
            )}
            aria-hidden="true"
          />
        )}
      </div>

      {isExpanded && !selectMode && (
        <ExpandedDetail
          torrent={torrent}
          isPaused={isPaused}
          onAction={onAction}
          recheckPending={recheckPending}
          reannouncePending={reannouncePending}
        />
      )}
    </div>
  );
});

interface ExpandedDetailProps {
  torrent: Torrent;
  isPaused: boolean;
  onAction: (torrent: Torrent, action: RowAction) => void;
  recheckPending: boolean;
  reannouncePending: boolean;
}

function ExpandedDetail({ torrent, isPaused, onAction, recheckPending, reannouncePending }: ExpandedDetailProps) {
  // Stop click bubble: tapping inside the expansion shouldn't collapse the row.
  return (
    <div
      className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 space-y-2"
      onClick={(e) => e.stopPropagation()}
    >
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <Stat label="ETA" value={formatTime(torrent.eta)} />
        <Stat label="Ratio" value={formatRatio(torrent.ratio)} />
        <Stat label="Seeds" value={`${torrent.num_seeds} / ${torrent.num_complete}`} />
        <Stat label="Peers" value={`${torrent.num_leechs} / ${torrent.num_incomplete}`} />
        <Stat label="Added" value={formatDate(torrent.added_on)} />
        <Stat
          label="Completed"
          value={torrent.completion_on > 0 ? formatDate(torrent.completion_on) : '—'}
        />
        <div className="col-span-2 flex gap-2">
          <dt className="text-gray-500 dark:text-gray-400 flex-shrink-0">Path</dt>
          <dd className="text-gray-900 dark:text-gray-100 truncate selectable" title={torrent.save_path}>
            {torrent.save_path || '—'}
          </dd>
        </div>
      </dl>

      <div className="grid grid-cols-3 gap-1 pt-1">
        <ActionButton
          label={isPaused ? 'Resume' : 'Pause'}
          icon={isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          tone={isPaused ? 'positive' : 'neutral'}
          onClick={() => onAction(torrent, 'toggle')}
        />
        <ActionButton
          label="Recheck"
          icon={<RefreshCw className={clsx('w-4 h-4', recheckPending && 'animate-spin')} />}
          onClick={() => onAction(torrent, 'recheck')}
          disabled={recheckPending}
        />
        <ActionButton
          label="Reannounce"
          icon={<Radio className={clsx('w-4 h-4', reannouncePending && 'animate-pulse')} />}
          onClick={() => onAction(torrent, 'reannounce')}
          disabled={reannouncePending}
        />
        <ActionButton
          label="Move"
          icon={<FolderInput className="w-4 h-4" />}
          onClick={() => onAction(torrent, 'move')}
        />
        <ActionButton
          label="Delete"
          icon={<Trash2 className="w-4 h-4" />}
          tone="danger"
          onClick={() => onAction(torrent, 'delete')}
        />
        <ActionButton
          label="Details"
          icon={<ChevronRight className="w-4 h-4" />}
          onClick={() => onAction(torrent, 'detail')}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-gray-900 dark:text-gray-100 text-right selectable">{value}</dd>
    </>
  );
}

interface ActionButtonProps {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'neutral' | 'positive' | 'danger';
}

function ActionButton({ label, icon, onClick, disabled, tone = 'neutral' }: ActionButtonProps) {
  const toneClasses =
    tone === 'danger'
      ? 'text-red-600 dark:text-red-400 active:bg-red-50 dark:active:bg-red-900/20'
      : tone === 'positive'
        ? 'text-green-600 dark:text-green-400 active:bg-green-50 dark:active:bg-green-900/20'
        : 'text-gray-700 dark:text-gray-200 active:bg-gray-100 dark:active:bg-gray-700';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={clsx(
        'flex flex-col items-center justify-center py-1.5 rounded-lg transition-colors disabled:opacity-50',
        toneClasses,
      )}
    >
      {icon}
      <span className="text-[10px] mt-0.5">{label}</span>
    </button>
  );
}
