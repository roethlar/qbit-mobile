import { useState } from 'react';
import { Play, Pause, Trash2, MoreVertical } from 'lucide-react';
import type { Torrent } from '../types/qbittorrent';
import { formatBytes, formatSpeed, formatProgress, getStateColor, getStateText } from '../utils/formatters';
import { Card, BottomSheet } from './Layout';
import { clsx } from 'clsx';

interface TorrentListProps {
  torrents: Torrent[];
  onPause: (hash: string) => void;
  onResume: (hash: string) => void;
  onDelete: (hash: string, deleteFiles?: boolean) => void;
  onTorrentClick?: (torrent: Torrent) => void;
}

export function TorrentList({ torrents, onPause, onResume, onDelete, onTorrentClick }: TorrentListProps) {
  const [selectedTorrent, setSelectedTorrent] = useState<Torrent | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
    <div className="flex-1 space-y-3 p-4">
      {torrents.map((torrent) => (
        <TorrentCard
          key={torrent.hash}
          torrent={torrent}
          onClick={() => handleTorrentClick(torrent)}
          onActionClick={(e) => handleActionClick(torrent, e)}
        />
      ))}

      <BottomSheet
        isOpen={showActions}
        onClose={() => setShowActions(false)}
        title={selectedTorrent?.name}
      >
        <div className="p-4 space-y-2">
          <button
            onClick={handlePauseResume}
            className="w-full flex items-center p-4 rounded-xl bg-gray-50 active:bg-gray-100 transition-colors"
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
            className="w-full flex items-center p-4 rounded-xl bg-red-50 active:bg-red-100 transition-colors"
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

interface TorrentCardProps {
  torrent: Torrent;
  onClick: () => void;
  onActionClick: (e: React.MouseEvent) => void;
}

function TorrentCard({ torrent, onClick, onActionClick }: TorrentCardProps) {
  const isActive = torrent.state === 'downloading' || torrent.state === 'uploading';
  const isPaused = torrent.state === 'pausedDL' || torrent.state === 'pausedUP';

  return (
    <Card onClick={onClick} className="p-0 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-medium text-gray-900 text-base leading-tight flex-1 mr-3 selectable">
            {torrent.name}
          </h3>
          <button
            onClick={onActionClick}
            className="p-1 -m-1 text-gray-400 active:text-gray-600 transition-colors flex-shrink-0"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex items-center justify-between mb-3">
          <span className={clsx('text-sm font-medium', getStateColor(torrent.state))}>
            {getStateText(torrent.state)}
          </span>
          <span className="text-sm text-gray-500">
            {formatProgress(torrent.progress)}
          </span>
        </div>
        
        <div className="mb-3">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={clsx(
                'h-2 rounded-full transition-all duration-300',
                isActive ? 'bg-blue-500' : isPaused ? 'bg-gray-400' : 'bg-green-500'
              )}
              style={{ width: `${torrent.progress * 100}%` }}
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
          <div>
            <div className="font-medium text-gray-900">Size</div>
            <div>{formatBytes(torrent.size)}</div>
          </div>
          <div>
            <div className="font-medium text-gray-900">Speed</div>
            <div className="flex items-center space-x-1">
              {torrent.dlspeed > 0 && (
                <span className="text-blue-600">↓{formatSpeed(torrent.dlspeed)}</span>
              )}
              {torrent.upspeed > 0 && (
                <span className="text-green-600">↑{formatSpeed(torrent.upspeed)}</span>
              )}
              {torrent.dlspeed === 0 && torrent.upspeed === 0 && (
                <span className="text-gray-400">—</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}