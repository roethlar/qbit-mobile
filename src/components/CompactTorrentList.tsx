import { useState, useMemo, useEffect } from 'react';
import { Play, Pause, Trash2, MoreVertical, Search, X, ArrowUpDown, ArrowUp, ArrowDown, Tag } from 'lucide-react';
import type { Torrent } from '../types/qbittorrent';
import { formatBytes, formatSpeed, formatProgress, getStateColor, getStateText } from '../utils/formatters';
import { BottomSheet } from './Layout';
import { clsx } from 'clsx';

interface CompactTorrentListProps {
  torrents: Torrent[];
  onPause: (hash: string) => void;
  onResume: (hash: string) => void;
  onDelete: (hash: string, deleteFiles?: boolean) => void;
  onTorrentClick?: (torrent: Torrent) => void;
}

export function CompactTorrentList({ torrents, onPause, onResume, onDelete, onTorrentClick }: CompactTorrentListProps) {
  const [selectedTorrent, setSelectedTorrent] = useState<Torrent | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'progress' | 'dlspeed' | 'upspeed' | 'added_on' | 'state'>(() => {
    const saved = localStorage.getItem('qbit-sort-by');
    return (saved as any) || 'name';
  });
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() => {
    const saved = localStorage.getItem('qbit-sort-order');
    return (saved as 'asc' | 'desc') || 'asc';
  });
  const [selectedTag, setSelectedTag] = useState<string>(() => {
    return localStorage.getItem('qbit-selected-tag') || '';
  });
  const [showSortOptions, setShowSortOptions] = useState(false);
  const itemsPerPage = 5000; // Show all torrents to save space

  // Get unique tags from torrents
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    torrents.forEach(torrent => {
      if (torrent.tags) {
        torrent.tags.split(',').forEach(tag => {
          const trimmedTag = tag.trim();
          if (trimmedTag) tagSet.add(trimmedTag);
        });
      }
    });
    return Array.from(tagSet).sort();
  }, [torrents]);

  // Filter and sort torrents
  const filteredAndSortedTorrents = useMemo(() => {
    let filtered = torrents;
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(torrent => 
        torrent.name.toLowerCase().includes(query) ||
        torrent.category.toLowerCase().includes(query) ||
        torrent.tags.toLowerCase().includes(query) ||
        getStateText(torrent.state).toLowerCase().includes(query)
      );
    }
    
    // Filter by tag
    if (selectedTag) {
      filtered = filtered.filter(torrent => 
        torrent.tags.split(',').map(t => t.trim()).includes(selectedTag)
      );
    }
    
    // Sort torrents
    const sorted = [...filtered].sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'size':
          aValue = a.size;
          bValue = b.size;
          break;
        case 'progress':
          aValue = a.progress;
          bValue = b.progress;
          break;
        case 'dlspeed':
          aValue = a.dlspeed;
          bValue = b.dlspeed;
          break;
        case 'upspeed':
          aValue = a.upspeed;
          bValue = b.upspeed;
          break;
        case 'added_on':
          aValue = a.added_on;
          bValue = b.added_on;
          break;
        case 'state':
          aValue = getStateText(a.state);
          bValue = getStateText(b.state);
          break;
        default:
          return 0;
      }
      
      if (typeof aValue === 'string') {
        return sortOrder === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        return sortOrder === 'asc' 
          ? aValue - bValue
          : bValue - aValue;
      }
    });
    
    return sorted;
  }, [torrents, searchQuery, selectedTag, sortBy, sortOrder]);

  // Paginate filtered results
  const paginatedTorrents = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedTorrents.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedTorrents, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedTorrents.length / itemsPerPage);

  // Save preferences to localStorage
  useEffect(() => {
    localStorage.setItem('qbit-sort-by', sortBy);
  }, [sortBy]);

  useEffect(() => {
    localStorage.setItem('qbit-sort-order', sortOrder);
  }, [sortOrder]);

  useEffect(() => {
    localStorage.setItem('qbit-selected-tag', selectedTag);
  }, [selectedTag]);

  const handleSort = (newSortBy: typeof sortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  const handleTorrentClick = (torrent: Torrent) => {
    if (onTorrentClick) {
      onTorrentClick(torrent);
    }
  };

  const handleActionClick = (torrent: Torrent, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTorrent(torrent);
    setShowActions(true);
  };

  const handlePauseResume = () => {
    if (!selectedTorrent) return;
    
    if (selectedTorrent.state === 'pausedDL' || selectedTorrent.state === 'pausedUP') {
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

  if (torrents.length === 0) {
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

  return (
    <div className="flex-1 flex flex-col">
      {/* Search Header - More compact */}
      <div className="bg-white dark:bg-gray-850 border-b border-gray-100 dark:border-gray-700 px-2 py-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {filteredAndSortedTorrents.length}/{torrents.length}
          </span>
          <div className="flex items-center">
            {availableTags.length > 0 && (
              <button
                onClick={() => setShowTags(!showTags)}
                className="p-1 text-gray-500 hover:text-gray-700 rounded active:bg-gray-100 relative"
              >
                <Tag className="w-4 h-4" />
                {selectedTag && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary-600 rounded-full"></span>
                )}
              </button>
            )}
            <button
              onClick={() => setShowSortOptions(!showSortOptions)}
              className="p-1 text-gray-500 hover:text-gray-700 rounded active:bg-gray-100"
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-1 text-gray-500 hover:text-gray-700 rounded active:bg-gray-100"
            >
              {showSearch ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Sort Options - Compact */}
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
                  onClick={() => handleSort(option.key)}
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

        {/* Tag Filter - Popup */}
        {showTags && availableTags.length > 0 && (
          <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-800 rounded">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-600">Tags</span>
              {selectedTag && (
                <button
                  onClick={() => {
                    setSelectedTag('');
                    setCurrentPage(1);
                  }}
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
                    setSelectedTag(selectedTag === tag ? '' : tag);
                    setCurrentPage(1);
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
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1); // Reset to first page when searching
              }}
              placeholder="Search..."
              className="w-full pl-7 pr-2 py-1 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-transparent"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Compact Torrent List */}
      <div className="flex-1 overflow-auto">
        {paginatedTorrents.map((torrent) => (
          <CompactTorrentRow
            key={torrent.hash}
            torrent={torrent}
            onClick={() => handleTorrentClick(torrent)}
            onActionClick={(e) => handleActionClick(torrent, e)}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white dark:bg-gray-850 border-t border-gray-100 dark:border-gray-700 p-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm font-medium text-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            <span className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm font-medium text-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Action Sheets */}
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
            {selectedTorrent?.state === 'pausedDL' || selectedTorrent?.state === 'pausedUP' ? (
              <Play className="w-5 h-5 mr-3 text-green-600" />
            ) : (
              <Pause className="w-5 h-5 mr-3 text-orange-600" />
            )}
            <span className="text-base font-medium">
              {selectedTorrent?.state === 'pausedDL' || selectedTorrent?.state === 'pausedUP' ? 'Resume' : 'Pause'}
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
  onClick: () => void;
  onActionClick: (e: React.MouseEvent) => void;
}

function CompactTorrentRow({ torrent, onClick, onActionClick }: CompactTorrentRowProps) {
  const isActive = torrent.state === 'downloading' || torrent.state === 'uploading';
  const isPaused = torrent.state === 'pausedDL' || torrent.state === 'pausedUP';

  return (
    <div 
      className="border-b border-gray-100 dark:border-gray-700 px-2 py-1.5 active:bg-gray-50 dark:active:bg-gray-700 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        {/* Left side - Name and status */}
        <div className="flex-1 min-w-0 mr-3">
          <div className="flex items-center">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 text-xs leading-tight truncate selectable">
              {torrent.name}
            </h3>
            <span className={clsx('ml-2 text-xs font-medium flex-shrink-0', getStateColor(torrent.state))}>
              {getStateText(torrent.state)}
            </span>
          </div>
          
          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-0.5 mt-0.5">
            <div
              className={clsx(
                'h-0.5 rounded-full transition-all duration-300',
                isActive ? 'bg-blue-500' : isPaused ? 'bg-gray-400' : 'bg-green-500'
              )}
              style={{ width: `${torrent.progress * 100}%` }}
            />
          </div>
          
          {/* Stats row */}
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
          
          {/* Tags row */}
          {torrent.tags && torrent.tags.trim() && (
            <div className="flex items-center mt-1">
              <Tag className="w-3 h-3 mr-1 text-gray-400" />
              <div className="flex flex-wrap gap-1">
                {torrent.tags.split(',').map((tag, index) => {
                  const trimmedTag = tag.trim();
                  if (!trimmedTag) return null;
                  return (
                    <span
                      key={index}
                      className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs font-medium"
                    >
                      {trimmedTag}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        
        {/* Right side - Action button */}
        <button
          onClick={onActionClick}
          className="p-2 -mr-2 text-gray-400 active:text-gray-600 transition-colors flex-shrink-0"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}