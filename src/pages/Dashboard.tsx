import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Plus, Settings, RefreshCw, Moon, Sun, CheckSquare, Play, Pause, Trash2, FolderInput, X, WifiOff } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { Layout, Header, FloatingActionButton } from '../components/Layout';
import { CompactTorrentList } from '../components/CompactTorrentList';
import { AddTorrent } from '../components/AddTorrent';
import { TorrentDetail } from '../components/TorrentDetail';
import { MoveLocationSheet } from '../components/MoveLocationSheet';
import { ConfirmDeleteSheet } from '../components/ConfirmDeleteSheet';
import { useDirectTorrents, useDirectGlobalStats, useDirectTorrentActions } from '../hooks/useDirectTorrents';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useTorrentFilters } from '../hooks/useTorrentFilters';
import { formatSpeed } from '../utils/formatters';
import {
  PAUSED_STATES_SET,
  DOWNLOADING_STATES_SET,
  SEEDING_STATES_SET,
} from '../types/qbittorrent';
import type { Torrent } from '../types/qbittorrent';
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
  const [showBulkMove, setShowBulkMove] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
  }, []);

  const scheduleSuccessDismiss = (msg: string) => {
    setAddSuccess(msg);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => setAddSuccess(null), 3000);
  };

  const flashErrorBanner = useCallback((msg: string) => {
    setErrorBanner(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setErrorBanner(null), 4000);
  }, []);

  const reportMutationError = useCallback(
    (error: unknown) => {
      flashErrorBanner(extractErrorMessage(error, 'Action failed'));
    },
    [flashErrorBanner],
  );

  const { toggleTheme, isDark } = useTheme();
  const online = useOnlineStatus();
  const { data: torrents = [], isLoading, isError, refetch } = useDirectTorrents();
  const { data: globalStats } = useDirectGlobalStats();
  const {
    pauseTorrent,
    resumeTorrent,
    deleteTorrent,
    pauseTorrents,
    resumeTorrents,
    deleteTorrents,
    setLocation,
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

  // Hoisted so "Select all" operates on the same list the user sees,
  // not the pre-search/tag/sort superset.
  const {
    searchQuery, setSearchQuery,
    sortBy, sortOrder, handleSort,
    selectedTag, setSelectedTag,
    filteredAndSortedTorrents: visibleTorrents,
  } = useTorrentFilters(filteredTorrents);

  // Drop selections that have fallen out of the visible list (filter/search/tag
  // changed, or the torrent was deleted upstream). Keeps the selection model
  // honest with what the user can see/select in the toolbar.
  useEffect(() => {
    setSelectedHashes((prev) => {
      if (prev.size === 0) return prev;
      const visible = new Set(visibleTorrents.map((t) => t.hash));
      let changed = false;
      const next = new Set<string>();
      for (const hash of prev) {
        if (visible.has(hash)) next.add(hash);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [visibleTorrents]);

  // Tag list is computed from the *raw* torrent set so the tag UI doesn't
  // disappear when the top-bar filter happens to exclude every tagged
  // torrent. A persisted selectedTag stays clearable even when no current
  // torrent carries it.
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const t of torrents) {
      if (!t.tags) continue;
      for (const raw of t.tags.split(',')) {
        const trimmed = raw.trim();
        if (trimmed) tagSet.add(trimmed);
      }
    }
    return Array.from(tagSet).sort();
  }, [torrents]);

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
    () => visibleTorrents.filter((t) => selectedHashes.has(t.hash)).map((t) => t.hash),
    [visibleTorrents, selectedHashes],
  );

  const handleBulkPause = () => {
    if (selectedHashes.size === 0) return;
    pauseTorrents.mutate(Array.from(selectedHashes), {
      onSuccess: exitSelectMode,
      onError: reportMutationError,
    });
  };
  const handleBulkResume = () => {
    if (selectedHashes.size === 0) return;
    resumeTorrents.mutate(Array.from(selectedHashes), {
      onSuccess: exitSelectMode,
      onError: reportMutationError,
    });
  };
  const handleBulkDelete = (deleteFiles: boolean) => {
    if (selectedHashes.size === 0) return;
    deleteTorrents.mutate(
      { hashes: Array.from(selectedHashes), deleteFiles },
      {
        onSuccess: () => { setShowBulkDeleteConfirm(false); exitSelectMode(); },
        onError: reportMutationError,
      },
    );
  };
  const handleBulkMove = async (location: string) => {
    if (selectedHashes.size === 0) return;
    try {
      await setLocation.mutateAsync({ hashes: Array.from(selectedHashes), location });
      setShowBulkMove(false);
      exitSelectMode();
    } catch (err) {
      reportMutationError(err);
      throw err; // let MoveLocationSheet keep the sheet open + show its own error
    }
  };

  // Stable callbacks so CompactTorrentRow's React.memo isn't defeated by the
  // Dashboard re-rendering on every search keystroke.
  const handleRowPause = useCallback(
    (hash: string) => {
      pauseTorrent.mutate(hash, { onError: reportMutationError });
    },
    [pauseTorrent, reportMutationError],
  );
  const handleRowResume = useCallback(
    (hash: string) => {
      resumeTorrent.mutate(hash, { onError: reportMutationError });
    },
    [resumeTorrent, reportMutationError],
  );
  const handleRowDelete = useCallback(
    (hash: string, deleteFiles?: boolean) => {
      deleteTorrent.mutate(
        { hash, deleteFiles },
        { onError: reportMutationError },
      );
    },
    [deleteTorrent, reportMutationError],
  );
  const handleRowSetLocation = useCallback(
    (hashes: string[], location: string) =>
      setLocation
        .mutateAsync({ hashes, location })
        .then(() => undefined)
        .catch((err: unknown) => {
          reportMutationError(err);
          throw err;
        }),
    [setLocation, reportMutationError],
  );
  const handleTorrentClick = useCallback((t: Torrent) => {
    setSelectedHash(t.hash);
  }, []);

  const selectAllVisible = () => {
    setSelectedHashes((prev) => {
      const next = new Set(prev);
      for (const t of visibleTorrents) next.add(t.hash);
      return next;
    });
  };
  const deselectAllVisible = () => {
    setSelectedHashes((prev) => {
      const next = new Set(prev);
      for (const t of visibleTorrents) next.delete(t.hash);
      return next;
    });
  };
  const allVisibleSelected =
    visibleTorrents.length > 0 && visibleSelectedHashes.length === visibleTorrents.length;

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
          titleSuffix={<span title={`Build ${__BUILD_ID__}`}>v{__APP_VERSION__}</span>}
          leftButton={
            !online ? (
              <span
                role="status"
                aria-label="Offline"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <WifiOff className="w-3 h-3" />
                Offline
              </span>
            ) : undefined
          }
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

      {errorBanner && (
        <div
          role="alert"
          className="mx-4 mt-2 mb-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center justify-between gap-3"
        >
          <p className="text-red-800 dark:text-red-300 text-sm font-medium flex-1 break-words">
            {errorBanner}
          </p>
          <button
            onClick={() => setErrorBanner(null)}
            aria-label="Dismiss error"
            className="text-red-800 dark:text-red-300 text-xs font-medium underline active:opacity-70 flex-shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {addSuccess && (
        <div className="mx-4 mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
          <p className="text-green-800 dark:text-green-300 text-sm font-medium">{addSuccess}</p>
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-0">
        <CompactTorrentList
          visibleTorrents={visibleTorrents}
          unfilteredCount={filteredTorrents.length}
          onPause={handleRowPause}
          onResume={handleRowResume}
          onDelete={handleRowDelete}
          onSetLocation={handleRowSetLocation}
          onTorrentClick={handleTorrentClick}
          selectMode={selectMode}
          selectedHashes={selectedHashes}
          onToggleSelect={toggleSelect}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          selectedTag={selectedTag}
          onSelectedTagChange={setSelectedTag}
          availableTags={availableTags}
        />
      </div>

      {selectMode ? (
        <div
          className="border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-2 pb-safe grid grid-cols-4 gap-2"
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
            onClick={() => setShowBulkMove(true)}
            disabled={selectedHashes.size === 0 || bulkPending}
            className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 active:bg-blue-100 dark:active:bg-blue-900/40 disabled:opacity-40 text-sm font-medium"
          >
            <FolderInput className="w-4 h-4" /> Move
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

      <ConfirmDeleteSheet
        isOpen={showBulkDeleteConfirm}
        onClose={() => setShowBulkDeleteConfirm(false)}
        subject={`${selectedHashes.size} torrent${selectedHashes.size === 1 ? '' : 's'}`}
        count={selectedHashes.size}
        pending={deleteTorrents.isPending}
        onConfirm={(deleteFiles) => handleBulkDelete(deleteFiles)}
      />

      <AddTorrent
        isOpen={showAddTorrent}
        onClose={() => setShowAddTorrent(false)}
        onAddUrl={handleAddTorrentUrl}
        onAddFile={handleAddTorrentFile}
      />

      <MoveLocationSheet
        isOpen={showBulkMove}
        onClose={() => setShowBulkMove(false)}
        subject={`${selectedHashes.size} torrent${selectedHashes.size === 1 ? '' : 's'}`}
        currentPath=""
        onSubmit={handleBulkMove}
      />

      {selectedTorrent && (
        <TorrentDetail
          torrent={selectedTorrent}
          onClose={() => setSelectedHash(null)}
          onPause={handleRowPause}
          onResume={handleRowResume}
          onDelete={(hash, deleteFiles) => handleRowDelete(hash, deleteFiles)}
          onSetLocation={(hash, location) => handleRowSetLocation([hash], location)}
        />
      )}
    </Layout>
  );
}
