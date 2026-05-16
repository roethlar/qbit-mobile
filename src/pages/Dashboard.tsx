import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Plus, Settings, RefreshCw, Moon, Sun, CheckSquare, Play, Pause, Trash2, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { Layout, Header, FloatingActionButton } from '../components/Layout';
import { CompactTorrentList } from '../components/CompactTorrentList';
import { AddTorrent } from '../components/AddTorrent';
import { TorrentDetail } from '../components/TorrentDetail';
import { useDirectTorrents, useDirectGlobalStats, useDirectTorrentActions } from '../hooks/useDirectTorrents';
import { formatSpeed } from '../utils/formatters';
import {
  PAUSED_STATES_SET,
  DOWNLOADING_STATES_SET,
  SEEDING_STATES_SET,
} from '../types/qbittorrent';
import type { AddTorrentOptions } from '../components/AddTorrent';

interface DashboardProps {
  onShowSettings: () => void;
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string } | undefined;
    return data?.error || error.message || fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export function Dashboard({ onShowSettings }: DashboardProps) {
  const [showAddTorrent, setShowAddTorrent] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [addSuccess, setAddSuccess] = useState<string | null>(null);
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedHashes, setSelectedHashes] = useState<Set<string>>(() => new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
  }, []);

  const scheduleSuccessDismiss = (msg: string) => {
    setAddSuccess(msg);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => setAddSuccess(null), 3000);
  };

  const { toggleTheme, isDark } = useTheme();
  const { data: torrents = [], isLoading, isError, refetch } = useDirectTorrents();
  const { data: globalStats } = useDirectGlobalStats();
  const {
    pauseTorrent,
    resumeTorrent,
    deleteTorrent,
    pauseTorrents,
    resumeTorrents,
    deleteTorrents,
    addTorrentUrl,
    addTorrentFile,
  } = useDirectTorrentActions();

  const toggleSelect = useCallback((hash: string) => {
    setSelectedHashes((prev) => {
      const next = new Set(prev);
      if (next.has(hash)) next.delete(hash);
      else next.add(hash);
      return next;
    });
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedHashes(new Set());
  }, []);

  const enterSelectMode = useCallback(() => {
    setSelectMode(true);
    setSelectedHash(null);
  }, []);

  const selectedTorrent = useMemo(
    () => (selectedHash ? torrents.find((t) => t.hash === selectedHash) ?? null : null),
    [torrents, selectedHash],
  );

  const filteredTorrents = useMemo(() => {
    return torrents.filter(torrent => {
      switch (filter) {
        case 'downloading':
          return DOWNLOADING_STATES_SET.has(torrent.state);
        case 'seeding':
          return SEEDING_STATES_SET.has(torrent.state);
        case 'paused':
          return PAUSED_STATES_SET.has(torrent.state);
        case 'completed':
          return torrent.progress >= 1;
        default:
          return true;
      }
    });
  }, [torrents, filter]);

  const handleRefresh = async () => {
    await refetch();
  };

  const handleAddTorrentUrl = async (url: string, options?: AddTorrentOptions) => {
    try {
      setAddSuccess(null);
      await addTorrentUrl.mutateAsync({ url, options });
      scheduleSuccessDismiss('Torrent added successfully!');
    } catch (error: unknown) {
      console.error('Failed to add torrent:', error);
      throw new Error(extractErrorMessage(error, 'Failed to add torrent'));
    }
  };

  const handleAddTorrentFile = async (file: File, options?: AddTorrentOptions) => {
    try {
      setAddSuccess(null);
      await addTorrentFile.mutateAsync({ file, options });
      scheduleSuccessDismiss('Torrent file added successfully!');
    } catch (error: unknown) {
      console.error('Failed to add torrent:', error);
      throw new Error(extractErrorMessage(error, 'Failed to add torrent file'));
    }
  };

  const visibleSelectedHashes = useMemo(
    () => filteredTorrents.filter((t) => selectedHashes.has(t.hash)).map((t) => t.hash),
    [filteredTorrents, selectedHashes],
  );

  const handleBulkPause = () => {
    if (selectedHashes.size === 0) return;
    pauseTorrents.mutate(Array.from(selectedHashes), { onSuccess: exitSelectMode });
  };
  const handleBulkResume = () => {
    if (selectedHashes.size === 0) return;
    resumeTorrents.mutate(Array.from(selectedHashes), { onSuccess: exitSelectMode });
  };
  const handleBulkDelete = (deleteFiles: boolean) => {
    if (selectedHashes.size === 0) return;
    deleteTorrents.mutate(
      { hashes: Array.from(selectedHashes), deleteFiles },
      { onSuccess: () => { setShowBulkDeleteConfirm(false); exitSelectMode(); } },
    );
  };

  const selectAllVisible = () => {
    setSelectedHashes((prev) => {
      const next = new Set(prev);
      for (const t of filteredTorrents) next.add(t.hash);
      return next;
    });
  };
  const deselectAllVisible = () => {
    setSelectedHashes((prev) => {
      const next = new Set(prev);
      for (const t of filteredTorrents) next.delete(t.hash);
      return next;
    });
  };
  const allVisibleSelected =
    filteredTorrents.length > 0 && visibleSelectedHashes.length === filteredTorrents.length;

  const filters = useMemo(() => {
    const counts = { downloading: 0, seeding: 0, paused: 0, completed: 0 };
    for (const t of torrents) {
      if (DOWNLOADING_STATES_SET.has(t.state)) counts.downloading++;
      if (SEEDING_STATES_SET.has(t.state)) counts.seeding++;
      if (PAUSED_STATES_SET.has(t.state)) counts.paused++;
      if (t.progress >= 1) counts.completed++;
    }
    return [
      { key: 'all', label: '●', count: torrents.length },
      { key: 'downloading', label: '↓', count: counts.downloading },
      { key: 'seeding', label: '↑', count: counts.seeding },
      { key: 'paused', label: '⏸', count: counts.paused },
      { key: 'completed', label: '✓', count: counts.completed },
    ];
  }, [torrents]);

  const bulkPending = pauseTorrents.isPending || resumeTorrents.isPending || deleteTorrents.isPending;

  return (
    <Layout padding={false}>
      {selectMode ? (
        <Header
          title={`${selectedHashes.size} selected`}
          leftButton={
            <button
              onClick={exitSelectMode}
              aria-label="Exit selection"
              className="p-2 -ml-1 text-gray-600 dark:text-gray-300 active:bg-gray-100 dark:active:bg-gray-700 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          }
          rightButton={
            <div className="flex items-center space-x-1">
              <button
                onClick={allVisibleSelected ? deselectAllVisible : selectAllVisible}
                className="px-2 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 active:bg-gray-100 dark:active:bg-gray-700 rounded"
              >
                {allVisibleSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>
          }
        />
      ) : (
        <Header
          title="qBit Mobile"
          rightButton={
            <div className="flex items-center space-x-1">
              <button
                onClick={enterSelectMode}
                aria-label="Select multiple"
                disabled={torrents.length === 0}
                className="p-2 text-gray-600 hover:text-gray-900 active:bg-gray-100 dark:text-gray-300 dark:hover:text-gray-100 dark:active:bg-gray-700 rounded transition-colors disabled:opacity-40"
              >
                <CheckSquare className="w-4 h-4" />
              </button>
              <button
                onClick={onShowSettings}
                aria-label="Settings"
                className="p-2 text-gray-600 hover:text-gray-900 active:bg-gray-100 dark:text-gray-300 dark:hover:text-gray-100 dark:active:bg-gray-700 rounded transition-colors"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={toggleTheme}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                className="p-2 text-gray-600 hover:text-gray-900 active:bg-gray-100 dark:text-gray-300 dark:hover:text-gray-100 dark:active:bg-gray-700 rounded transition-colors"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button
                onClick={handleRefresh}
                aria-label="Refresh torrents"
                className="p-2 text-gray-600 hover:text-gray-900 active:bg-gray-100 dark:text-gray-300 dark:hover:text-gray-100 dark:active:bg-gray-700 rounded transition-colors"
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          }
        />
      )}

      <div className="px-2 py-0.5 bg-white dark:bg-gray-850 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex overflow-x-auto space-x-1 flex-1">
          {filters.map((filterItem) => (
            <button
              key={filterItem.key}
              onClick={() => setFilter(filterItem.key)}
              className={`flex-shrink-0 px-1.5 py-0.5 rounded text-xs transition-colors ${
                filter === filterItem.key
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 active:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:active:bg-gray-600'
              }`}
            >
              {filterItem.label} ({filterItem.count})
            </button>
          ))}
          </div>
          {globalStats && (
            <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400 ml-2">
              <span>↓<span className="font-medium text-blue-600">{formatSpeed(globalStats.dl_info_speed)}</span></span>
              <span>↑<span className="font-medium text-green-600">{formatSpeed(globalStats.up_info_speed)}</span></span>
            </div>
          )}
        </div>
      </div>

      {isError && (
        <div className="mx-4 mt-2 mb-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center justify-between gap-3">
          <p className="text-red-800 dark:text-red-300 text-sm font-medium flex-1">
            Couldn't reach qBittorrent — retrying…
          </p>
          <button
            onClick={() => refetch()}
            className="text-red-800 dark:text-red-300 text-xs font-medium underline active:opacity-70"
          >
            Retry
          </button>
        </div>
      )}

      {addSuccess && (
        <div className="mx-4 mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
          <p className="text-green-800 dark:text-green-300 text-sm font-medium">{addSuccess}</p>
        </div>
      )}

      <div className="flex-1">
        <CompactTorrentList
          torrents={filteredTorrents}
          onPause={(hash) => pauseTorrent.mutate(hash)}
          onResume={(hash) => resumeTorrent.mutate(hash)}
          onDelete={(hash, deleteFiles) => deleteTorrent.mutate({ hash, deleteFiles })}
          onTorrentClick={(t) => setSelectedHash(t.hash)}
          selectMode={selectMode}
          selectedHashes={selectedHashes}
          onToggleSelect={toggleSelect}
        />
      </div>

      {selectMode ? (
        <div
          className="border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-2 pb-safe grid grid-cols-3 gap-2"
          role="toolbar"
          aria-label="Bulk actions"
        >
          <button
            onClick={handleBulkResume}
            disabled={selectedHashes.size === 0 || bulkPending}
            className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 active:bg-green-100 dark:active:bg-green-900/40 disabled:opacity-40 text-sm font-medium"
          >
            <Play className="w-4 h-4" /> Resume
          </button>
          <button
            onClick={handleBulkPause}
            disabled={selectedHashes.size === 0 || bulkPending}
            className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 active:bg-orange-100 dark:active:bg-orange-900/40 disabled:opacity-40 text-sm font-medium"
          >
            <Pause className="w-4 h-4" /> Pause
          </button>
          <button
            onClick={() => setShowBulkDeleteConfirm(true)}
            disabled={selectedHashes.size === 0 || bulkPending}
            className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 active:bg-red-100 dark:active:bg-red-900/40 disabled:opacity-40 text-sm font-medium"
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      ) : (
        <FloatingActionButton
          onClick={() => setShowAddTorrent(true)}
          icon={<Plus className="w-6 h-6" />}
          ariaLabel="Add torrent"
        />
      )}

      {showBulkDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm bulk delete"
          onClick={(e) => { if (e.target === e.currentTarget) setShowBulkDeleteConfirm(false); }}
        >
          <div className="w-full bg-white dark:bg-gray-850 rounded-t-3xl p-4 pb-safe space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Delete {selectedHashes.size} torrent{selectedHashes.size === 1 ? '' : 's'}?
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This cannot be undone.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => handleBulkDelete(false)}
                disabled={bulkPending}
                className="w-full ios-button-secondary disabled:opacity-50"
              >
                Delete torrents only
              </button>
              <button
                onClick={() => handleBulkDelete(true)}
                disabled={bulkPending}
                className="w-full bg-red-600 text-white rounded-xl py-3 px-6 font-medium active:bg-red-700 disabled:opacity-50"
              >
                Delete torrents and files
              </button>
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                disabled={bulkPending}
                className="w-full ios-button-secondary disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <AddTorrent
        isOpen={showAddTorrent}
        onClose={() => setShowAddTorrent(false)}
        onAddUrl={handleAddTorrentUrl}
        onAddFile={handleAddTorrentFile}
      />

      {selectedTorrent && (
        <TorrentDetail
          torrent={selectedTorrent}
          onClose={() => setSelectedHash(null)}
          onPause={(hash) => pauseTorrent.mutate(hash)}
          onResume={(hash) => resumeTorrent.mutate(hash)}
          onDelete={(hash, deleteFiles) => deleteTorrent.mutate({ hash, deleteFiles })}
        />
      )}
    </Layout>
  );
}
