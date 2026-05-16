import { useEffect, useRef, useState } from 'react';
import { X, Play, Pause, Trash2, RefreshCw, Radio, FileText, Server } from 'lucide-react';
import { clsx } from 'clsx';
import type { Torrent, TorrentFile, TorrentTracker } from '../types/qbittorrent';
import { PAUSED_STATES_SET } from '../types/qbittorrent';
import {
  formatBytes,
  formatSpeed,
  formatTime,
  formatProgress,
  formatRatio,
  formatDate,
  getStateColor,
  getStateText,
} from '../utils/formatters';
import { useTorrentDetail, useTorrentDetailActions } from '../hooks/useTorrentDetail';

interface TorrentDetailProps {
  torrent: Torrent;
  onClose: () => void;
  onPause: (hash: string) => void;
  onResume: (hash: string) => void;
  onDelete: (hash: string, deleteFiles: boolean) => void;
}

type Tab = 'general' | 'files' | 'trackers';

export function TorrentDetail({ torrent, onClose, onPause, onResume, onDelete }: TorrentDetailProps) {
  const [tab, setTab] = useState<Tab>('general');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { properties, files, trackers } = useTorrentDetail(torrent.hash);
  const { recheck, reannounce } = useTorrentDetailActions();

  const isPaused = PAUSED_STATES_SET.has(torrent.state);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // Toast feedback for action mutations. Cleared after a short window.
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);
  const flashToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  };

  const handleRecheck = () => {
    recheck.mutate(torrent.hash, {
      onSuccess: () => flashToast('Recheck queued'),
      onError: (e) => flashToast(e.message),
    });
  };
  const handleReannounce = () => {
    reannounce.mutate(torrent.hash, {
      onSuccess: () => flashToast('Reannounced'),
      onError: (e) => flashToast(e.message),
    });
  };
  const handlePauseResume = () => {
    if (isPaused) onResume(torrent.hash);
    else onPause(torrent.hash);
  };
  const handleDelete = (deleteFiles: boolean) => {
    onDelete(torrent.hash, deleteFiles);
    setShowDeleteConfirm(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-gray-50 dark:bg-gray-950 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={`Torrent details: ${torrent.name}`}
    >
      <header className="sticky top-0 z-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-700 px-2 py-2 flex items-center gap-2">
        <button
          onClick={onClose}
          aria-label="Close"
          className="p-2 -ml-1 text-gray-600 dark:text-gray-300 active:bg-gray-100 dark:active:bg-gray-700 rounded"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate selectable">
            {torrent.name}
          </h1>
          <p className={clsx('text-xs', getStateColor(torrent.state))}>
            {getStateText(torrent.state)} {formatProgress(torrent.progress)} · {formatBytes(torrent.size)}
          </p>
        </div>
        {(properties.isError || files.isError || trackers.isError) && (
          <span
            role="status"
            className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
          >
            Stale
          </span>
        )}
      </header>

      <nav className="flex border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900" role="tablist">
        {([
          { key: 'general', label: 'General', icon: <Radio className="w-4 h-4" /> },
          { key: 'files', label: 'Files', icon: <FileText className="w-4 h-4" /> },
          { key: 'trackers', label: 'Trackers', icon: <Server className="w-4 h-4" /> },
        ] as const).map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              'flex-1 py-2 px-2 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5',
              tab === t.key
                ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 active:bg-gray-50 dark:active:bg-gray-800',
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-y-auto">
        {tab === 'general' && (
          <GeneralPane torrent={torrent} properties={properties.data} loading={properties.isLoading} />
        )}
        {tab === 'files' && (
          <FilesPane files={files.data ?? []} loading={files.isLoading} />
        )}
        {tab === 'trackers' && (
          <TrackersPane trackers={trackers.data ?? []} loading={trackers.isLoading} />
        )}
      </main>

      {toast && (
        <div
          role="status"
          className="absolute left-1/2 -translate-x-1/2 bottom-24 px-3 py-2 rounded-xl bg-gray-900/90 text-white text-sm shadow-lg"
        >
          {toast}
        </div>
      )}

      <footer className="border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-2 pb-safe">
        <div className="grid grid-cols-4 gap-1">
          <ActionButton
            label={isPaused ? 'Resume' : 'Pause'}
            icon={isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            onClick={handlePauseResume}
            tone={isPaused ? 'positive' : 'neutral'}
          />
          <ActionButton
            label="Recheck"
            icon={<RefreshCw className={clsx('w-4 h-4', recheck.isPending && 'animate-spin')} />}
            onClick={handleRecheck}
            disabled={recheck.isPending}
          />
          <ActionButton
            label="Reannounce"
            icon={<Radio className={clsx('w-4 h-4', reannounce.isPending && 'animate-pulse')} />}
            onClick={handleReannounce}
            disabled={reannounce.isPending}
          />
          <ActionButton
            label="Delete"
            icon={<Trash2 className="w-4 h-4" />}
            onClick={() => setShowDeleteConfirm(true)}
            tone="danger"
          />
        </div>
      </footer>

      {showDeleteConfirm && (
        <div
          className="absolute inset-0 z-20 bg-black/40 flex items-end"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm delete"
          onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteConfirm(false); }}
        >
          <div className="w-full bg-white dark:bg-gray-850 rounded-t-3xl p-4 pb-safe space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Delete torrent</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to delete "{torrent.name}"?
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
                className="w-full bg-red-600 text-white rounded-xl py-3 px-6 font-medium active:bg-red-700"
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
        </div>
      )}
    </div>
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
        'flex flex-col items-center justify-center py-2 rounded-xl transition-colors disabled:opacity-50 min-h-[3rem]',
        toneClasses,
      )}
    >
      {icon}
      <span className="text-[10px] mt-0.5">{label}</span>
    </button>
  );
}

interface GeneralPaneProps {
  torrent: Torrent;
  properties: import('../types/qbittorrent').TorrentProperties | undefined;
  loading: boolean;
}

function GeneralPane({ torrent, properties, loading }: GeneralPaneProps) {
  return (
    <div className="p-4 space-y-4">
      <Card title="Transfer">
        <Row label="Progress" value={formatProgress(torrent.progress)} />
        <Row label="State" value={`${getStateText(torrent.state)} ${torrent.state}`} />
        <Row label="ETA" value={formatTime(torrent.eta)} />
        <Row label="Ratio" value={formatRatio(torrent.ratio)} />
        <Row label="Size" value={formatBytes(torrent.size)} />
        <Row label="Downloaded" value={formatBytes(torrent.downloaded)} />
        <Row label="Uploaded" value={formatBytes(torrent.uploaded)} />
        <Row label="Download speed" value={formatSpeed(torrent.dlspeed)} />
        <Row label="Upload speed" value={formatSpeed(torrent.upspeed)} />
      </Card>

      <Card title="Peers & Seeds">
        <Row
          label="Seeds"
          value={
            properties
              ? `${properties.seeds} / ${properties.seeds_total}`
              : `${torrent.num_seeds} / ${torrent.num_complete}`
          }
        />
        <Row
          label="Peers"
          value={
            properties
              ? `${properties.peers} / ${properties.peers_total}`
              : `${torrent.num_leechs} / ${torrent.num_incomplete}`
          }
        />
        {properties && (
          <Row label="Connections" value={`${properties.nb_connections} / ${properties.nb_connections_limit || '∞'}`} />
        )}
      </Card>

      <Card title="Storage">
        <Row label="Save path" value={torrent.save_path} multiline />
        <Row label="Category" value={torrent.category || '—'} />
        <Row label="Tags" value={torrent.tags || '—'} />
      </Card>

      <Card title="Timing">
        <Row label="Added" value={formatDate(torrent.added_on)} />
        <Row label="Completed" value={torrent.completion_on > 0 ? formatDate(torrent.completion_on) : '—'} />
        <Row label="Time active" value={formatTime(torrent.time_active)} />
        <Row label="Seeding time" value={formatTime(torrent.seeding_time)} />
        {properties && properties.reannounce > 0 && (
          <Row label="Next announce" value={formatTime(properties.reannounce)} />
        )}
      </Card>

      {loading && !properties && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Loading additional properties…
        </p>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white dark:bg-gray-850 rounded-xl border border-gray-100 dark:border-gray-700 p-3">
      <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
        {title}
      </h3>
      <dl className="space-y-1">{children}</dl>
    </section>
  );
}

function Row({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className={clsx('flex text-sm gap-3', multiline ? 'flex-col' : 'justify-between items-baseline')}>
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className={clsx('text-gray-900 dark:text-gray-100 selectable', !multiline && 'text-right')}>
        {value}
      </dd>
    </div>
  );
}

function priorityLabel(p: number): string {
  switch (p) {
    case 0: return 'Skip';
    case 1: return 'Normal';
    case 6: return 'High';
    case 7: return 'Max';
    default: return `P${p}`;
  }
}

function priorityClass(p: number): string {
  switch (p) {
    case 0: return 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
    case 6: return 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300';
    case 7: return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300';
    default: return 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300';
  }
}

function FilesPane({ files, loading }: { files: TorrentFile[]; loading: boolean }) {
  if (loading && files.length === 0) {
    return <p className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">Loading files…</p>;
  }
  if (files.length === 0) {
    return <p className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">No files</p>;
  }
  return (
    <ul className="divide-y divide-gray-100 dark:divide-gray-700">
      {files.map((file, i) => (
        <li key={file.index ?? i} className="px-3 py-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-900 dark:text-gray-100 break-all selectable">
                {file.name}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                {formatBytes(file.size)} · {formatProgress(file.progress)}
              </p>
            </div>
            <span
              className={clsx(
                'text-[10px] font-medium rounded px-1.5 py-0.5 flex-shrink-0 mt-0.5',
                priorityClass(file.priority),
              )}
            >
              {priorityLabel(file.priority)}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 mt-1">
            <div
              className={clsx(
                'h-1 rounded-full',
                file.progress >= 1 ? 'bg-green-500' : 'bg-blue-500',
              )}
              style={{ width: `${file.progress * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function trackerStatusLabel(s: number): string {
  switch (s) {
    case 0: return 'Disabled';
    case 1: return 'Not contacted';
    case 2: return 'Working';
    case 3: return 'Updating';
    case 4: return 'Not working';
    default: return `Status ${s}`;
  }
}

function trackerStatusColor(s: number): string {
  if (s === 2) return 'text-green-600 dark:text-green-400';
  if (s === 4) return 'text-red-600 dark:text-red-400';
  if (s === 3) return 'text-blue-600 dark:text-blue-400';
  return 'text-gray-500 dark:text-gray-400';
}

function TrackersPane({ trackers, loading }: { trackers: TorrentTracker[]; loading: boolean }) {
  if (loading && trackers.length === 0) {
    return <p className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">Loading trackers…</p>;
  }
  if (trackers.length === 0) {
    return <p className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">No trackers</p>;
  }
  return (
    <ul className="divide-y divide-gray-100 dark:divide-gray-700">
      {trackers.map((tracker, i) => (
        <li key={i} className="px-3 py-2">
          <p className="text-xs font-medium text-gray-900 dark:text-gray-100 break-all selectable">
            {tracker.url}
          </p>
          <div className="flex items-center justify-between mt-1 text-[11px]">
            <span className={clsx('font-medium', trackerStatusColor(tracker.status))}>
              {trackerStatusLabel(tracker.status)}
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              tier {tracker.tier} · {tracker.num_seeds}↑ {tracker.num_leeches}↓
            </span>
          </div>
          {tracker.msg && (
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 break-all">
              {tracker.msg}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
