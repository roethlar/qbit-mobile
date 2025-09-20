import { useState, useMemo, useEffect } from 'react';
import { Play, Pause, Trash2, MoreVertical } from 'lucide-react';
import type { Torrent } from '../types/qbittorrent';
import { formatBytes, formatSpeed, formatProgress, getStateColor, getStateText } from '../utils/formatters';
import { BottomSheet } from './Layout';
import { clsx } from 'clsx';

export type TorrentSortField = 'name' | 'size' | 'progress' | 'dlspeed' | 'upspeed' | 'added_on' | 'state';
export type TorrentSortOrder = 'asc' | 'desc';

interface CompactTorrentListProps {
  torrents: Torrent[];
  searchQuery?: string;
  sortBy: TorrentSortField;
  sortOrder: TorrentSortOrder;
  onPause: (hash: string) => void;
  onResume: (hash: string) => void;
  onDelete: (hash: string, deleteFiles?: boolean) => void;
  onTorrentClick?: (torrent: Torrent) => void;
}

export function CompactTorrentList({ torrents, searchQuery = '', sortBy, sortOrder, onPause, onResume, onDelete, onTorrentClick }: CompactTorrentListProps) {
  const [selectedTorrent, setSelectedTorrent] = useState<Torrent | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTag] = useState<string>(() => {
    return localStorage.getItem('qbit-selected-tag') || '';
  });
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
      let aValue: string | number, bValue: string | number;
      
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

  useEffect(() => {
    setCurrentPage(1);
  }, [sortBy, sortOrder]);

  // Persist selected tag for future sessions
  useEffect(() => {
    localStorage.setItem('qbit-selected-tag', selectedTag);
  }, [selectedTag]);


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
      {/* Compact Torrent List */}
      <div className="flex-1 overflow-auto">
        {paginatedTorrents.map((torrent, index) => (
          <CompactTorrentRow
            key={`${torrent.hash}-${sortBy}-${sortOrder}-${index}`}
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