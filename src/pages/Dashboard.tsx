import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Plus, Settings, RefreshCw, Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { Layout, Header, FloatingActionButton } from '../components/Layout';
import { CompactTorrentList } from '../components/CompactTorrentList';
import { AddTorrent } from '../components/AddTorrent';
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
    addTorrentUrl,
    addTorrentFile,
  } = useDirectTorrentActions();

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

  return (
    <Layout padding={false}>
      <Header
        title="qBit Mobile"
        rightButton={
          <div className="flex items-center space-x-1">
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
        />
      </div>

      <FloatingActionButton
        onClick={() => setShowAddTorrent(true)}
        icon={<Plus className="w-6 h-6" />}
        ariaLabel="Add torrent"
      />

      <AddTorrent
        isOpen={showAddTorrent}
        onClose={() => setShowAddTorrent(false)}
        onAddUrl={handleAddTorrentUrl}
        onAddFile={handleAddTorrentFile}
      />
    </Layout>
  );
}
