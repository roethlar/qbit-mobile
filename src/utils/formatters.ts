const INFINITE_SECONDS = 8640000;

export function formatBytes(bytes: number, decimals = 2): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatSpeed(bytesPerSecond: number): string {
  return formatBytes(bytesPerSecond) + '/s';
}

export function formatTime(seconds: number): string {
  if (seconds === INFINITE_SECONDS || seconds < 0) return '∞';
  if (seconds === 0) return '0s';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

export function formatProgress(progress: number): string {
  return (progress * 100).toFixed(1) + '%';
}

export function formatRatio(ratio: number): string {
  if (ratio === -1 || !isFinite(ratio)) return '∞';
  return ratio.toFixed(2);
}

export function formatDate(timestamp: number): string {
  if (timestamp === 0) return 'Never';
  
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

import type { TorrentState } from '../types/qbittorrent';

// Single source of truth for per-state display + sort ordering. Keeping glyph,
// color, and priority in one record prevents the three tables from drifting
// when a new state is added.
interface StateMeta {
  glyph: string;
  color: string;
  priority: number;
}

const DEFAULT_META: StateMeta = { glyph: '●', color: 'text-gray-600', priority: 99 };

export const STATE_META: Record<TorrentState, StateMeta> = {
  downloading: { glyph: '↓', color: 'text-blue-600', priority: 1 },
  forcedDL: { glyph: '⬇️', color: 'text-blue-600', priority: 1 },
  metaDL: { glyph: '📥', color: 'text-blue-600', priority: 1 },
  forcedMetaDL: { glyph: '📥', color: 'text-blue-600', priority: 1 },
  uploading: { glyph: '↑', color: 'text-green-600', priority: 2 },
  forcedUP: { glyph: '⬆️', color: 'text-green-600', priority: 2 },
  queuedDL: { glyph: '⏳', color: 'text-yellow-600', priority: 3 },
  queuedUP: { glyph: '⏳', color: 'text-yellow-600', priority: 3 },
  stalledDL: { glyph: '⚠', color: 'text-orange-600', priority: 4 },
  stalledUP: { glyph: '⚠', color: 'text-orange-600', priority: 4 },
  // moving and checking are both I/O-bound transitional states; group them.
  checkingDL: { glyph: '🔍', color: 'text-purple-600', priority: 5 },
  checkingUP: { glyph: '🔍', color: 'text-purple-600', priority: 5 },
  checkingResumeData: { glyph: '🔍', color: 'text-purple-600', priority: 5 },
  moving: { glyph: '↔', color: 'text-gray-600', priority: 5 },
  pausedDL: { glyph: '⏸', color: 'text-gray-500', priority: 6 },
  pausedUP: { glyph: '⏸', color: 'text-gray-500', priority: 6 },
  stoppedDL: { glyph: '⏸', color: 'text-gray-500', priority: 6 },
  stoppedUP: { glyph: '⏸', color: 'text-gray-500', priority: 6 },
  error: { glyph: '❌', color: 'text-red-600', priority: 7 },
  missingFiles: { glyph: '❓', color: 'text-red-600', priority: 7 },
  allocating: { glyph: '💾', color: 'text-indigo-600', priority: 5 },
  unknown: DEFAULT_META,
};

function metaFor(state: string): StateMeta {
  return STATE_META[state as TorrentState] ?? DEFAULT_META;
}

export function getStateColor(state: string): string {
  return metaFor(state).color;
}

export function getStateText(state: string): string {
  return metaFor(state).glyph;
}

export function getStatePriority(state: string): number {
  return metaFor(state).priority;
}

// Back-compat proxy for existing call sites (and the test suite) that read
// STATE_PRIORITY[state]. Reads return the priority from STATE_META; unknown
// states fall through to the default 99.
export const STATE_PRIORITY: Record<string, number> = new Proxy(
  {} as Record<string, number>,
  {
    get(_target, prop) {
      if (typeof prop !== 'string') return undefined;
      return metaFor(prop).priority;
    },
    has(_target, prop) {
      return typeof prop === 'string' && prop in STATE_META;
    },
  },
);