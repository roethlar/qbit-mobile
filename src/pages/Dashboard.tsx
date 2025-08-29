import { useState, useEffect, useRef } from 'react';
import { Plus, Settings, RefreshCw, Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { Layout, Header, FloatingActionButton, Card } from '../components/Layout';
import { CompactTorrentList } from '../components/CompactTorrentList';
import { AddTorrent } from '../components/AddTorrent';
import { useDirectTorrents, useDirectGlobalStats, useDirectTorrentActions } from '../hooks/useDirectTorrents';
import { formatBytes, formatSpeed } from '../utils/formatters';
import type { AddTorrentOptions } from '../components/AddTorrent';

interface DashboardProps {
  onLogout: () => void;
  onShowSettings: () => void;
}

export function Dashboard({ onLogout, onShowSettings }: DashboardProps) {
  const [showAddTorrent, setShowAddTorrent] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [showStats, setShowStats] = useState(true);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);
  const [isPullingToRefresh, setIsPullingToRefresh] = useState(false);
  const scrollableRef = useRef<HTMLDivElement>(null);
  
  const { toggleTheme, isDark } = useTheme();
  const { data: torrents = [], isLoading, refetch, error } = useDirectTorrents();
  
  // Debug logging
  console.log('Dashboard rendered');
  console.log('Dashboard - Torrents data:', torrents?.length, 'Loading:', isLoading, 'Error:', error);
  console.log('Dashboard - Torrents:', torrents);
  const { data: globalStats } = useDirectGlobalStats();
  const {
    pauseTorrent,
    resumeTorrent,
    deleteTorrent,
    addTorrentUrl,
    addTorrentFile,
  } = useDirectTorrentActions();

  const filteredTorrents = torrents.filter(torrent => {
    switch (filter) {
      case 'downloading':
        return ['downloading', 'stalledDL', 'queuedDL', 'metaDL'].includes(torrent.state);
      case 'seeding':
        return ['uploading', 'stalledUP', 'queuedUP'].includes(torrent.state);
      case 'paused':
        return ['pausedDL', 'pausedUP'].includes(torrent.state);
      case 'completed':
        return torrent.progress >= 1;
      default:
        return true;
    }
  });

  const handleLogout = async () => {
    // No logout needed for local access
    onLogout();
  };

  const handleRefresh = async () => {
    setIsPullingToRefresh(true);
    await refetch();
    setTimeout(() => setIsPullingToRefresh(false), 300);
  };

  const handleAddTorrentUrl = async (url: string, options?: AddTorrentOptions) => {
    try {
      setAddError(null);
      setAddSuccess(null);
      await addTorrentUrl.mutateAsync({ url, options });
      setAddSuccess('Torrent added successfully!');
      setTimeout(() => setAddSuccess(null), 3000);
    } catch (error: any) {
      console.error('Failed to add torrent:', error);
      const errorMsg = error?.response?.data?.error || error?.message || 'Failed to add torrent';
      setAddError(errorMsg);
      setTimeout(() => setAddError(null), 5000);
    }
  };

  const handleAddTorrentFile = async (file: File, options?: AddTorrentOptions) => {
    try {
      setAddError(null);
      setAddSuccess(null);
      await addTorrentFile.mutateAsync({ file, options });
      setAddSuccess('Torrent file added successfully!');
      setTimeout(() => setAddSuccess(null), 3000);
    } catch (error: any) {
      console.error('Failed to add torrent:', error);
      const errorMsg = error?.response?.data?.error || error?.message || 'Failed to add torrent file';
      setAddError(errorMsg);
      setTimeout(() => setAddError(null), 5000);
    }
  };

  const filters = [
    { key: 'all', label: '●', count: torrents?.length || 0 },
    { key: 'downloading', label: '↓', count: torrents?.filter(t => ['downloading', 'stalledDL', 'queuedDL', 'metaDL'].includes(t.state)).length || 0 },
    { key: 'seeding', label: '↑', count: torrents?.filter(t => ['uploading', 'stalledUP', 'queuedUP'].includes(t.state)).length || 0 },
    { key: 'paused', label: '⏸', count: torrents?.filter(t => ['pausedDL', 'pausedUP'].includes(t.state)).length || 0 },
    { key: 'completed', label: '✓', count: torrents?.filter(t => t.progress >= 1).length || 0 },
  ];

  // Auto-hide stats on scroll for more space
  useEffect(() => {
    const handleScroll = () => {
      const shouldShowStats = window.scrollY < 100;
      if (shouldShowStats !== showStats) {
        setShowStats(shouldShowStats);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [showStats]);

  return (
    <Layout padding={false}>
      <Header
        title="qBit Mobile"
        rightButton={
          <div className="flex items-center space-x-1">
            <button
              onClick={onShowSettings}
              className="p-1 text-gray-600 hover:text-gray-900 active:bg-gray-100 dark:text-gray-300 dark:hover:text-gray-100 dark:active:bg-gray-700 rounded transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={toggleTheme}
              className="p-1 text-gray-600 hover:text-gray-900 active:bg-gray-100 dark:text-gray-300 dark:hover:text-gray-100 dark:active:bg-gray-700 rounded transition-colors"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={handleRefresh}
              className="p-1 text-gray-600 hover:text-gray-900 active:bg-gray-100 dark:text-gray-300 dark:hover:text-gray-100 dark:active:bg-gray-700 rounded transition-colors"
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
                  : 'bg-gray-100 text-gray-600 active:bg-gray-200'
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

      {addError && (
        <div className="mx-4 mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-red-800 text-sm font-medium">{addError}</p>
        </div>
      )}

      {addSuccess && (
        <div className="mx-4 mb-4 p-3 bg-green-50 border border-green-200 rounded-xl">
          <p className="text-green-800 text-sm font-medium">{addSuccess}</p>
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