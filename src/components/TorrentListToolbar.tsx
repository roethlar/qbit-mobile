import { useState } from 'react';
import { Search, X, ArrowUpDown, ArrowUp, ArrowDown, Tag } from 'lucide-react';
import { clsx } from 'clsx';
import type { SortField, SortOrder } from '../hooks/useTorrentFilters';

interface TorrentListToolbarProps {
  visibleCount: number;
  unfilteredCount: number;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  sortBy: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  selectedTag: string;
  onSelectedTagChange: (tag: string) => void;
  availableTags: string[];
}

const SORT_OPTIONS: ReadonlyArray<{ key: SortField; label: string }> = [
  { key: 'name', label: 'Name' },
  { key: 'size', label: 'Size' },
  { key: 'progress', label: 'Progress' },
  { key: 'dlspeed', label: 'DL Speed' },
  { key: 'upspeed', label: 'UL Speed' },
  { key: 'added_on', label: 'Date Added' },
  { key: 'state', label: 'Status' },
];

export function TorrentListToolbar({
  visibleCount,
  unfilteredCount,
  searchQuery,
  onSearchQueryChange,
  sortBy,
  sortOrder,
  onSort,
  selectedTag,
  onSelectedTagChange,
  availableTags,
}: TorrentListToolbarProps) {
  const [showSearch, setShowSearch] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [showSort, setShowSort] = useState(false);

  const tagButtonVisible = availableTags.length > 0 || !!selectedTag;

  return (
    <div className="bg-white dark:bg-gray-850 border-b border-gray-100 dark:border-gray-700 px-2 py-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {visibleCount}/{unfilteredCount}
        </span>
        <div className="flex items-center">
          {tagButtonVisible && (
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
            onClick={() => setShowSort(!showSort)}
            aria-label="Sort torrents"
            aria-expanded={showSort}
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

      {showSort && (
        <div className="mt-1 p-1 bg-gray-50 dark:bg-gray-800 rounded">
          <div className="grid grid-cols-2 gap-2 text-sm">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.key}
                onClick={() => onSort(option.key)}
                className={clsx(
                  'flex items-center justify-between p-2 rounded-lg transition-colors',
                  sortBy === option.key
                    ? 'bg-primary-600 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 active:bg-gray-100 dark:active:bg-gray-600',
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

      {showTags && tagButtonVisible && (
        <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-800 rounded">
          {selectedTag && visibleCount === 0 && (
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
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 active:bg-gray-300 dark:active:bg-gray-600',
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
  );
}
