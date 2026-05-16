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

export function getStateColor(state: string): string {
  switch (state) {
    case 'downloading':
    case 'metaDL':
    case 'forcedDL':
      return 'text-blue-600';
    case 'uploading':
    case 'forcedUP':
      return 'text-green-600';
    case 'pausedDL':
    case 'pausedUP':
    case 'stoppedDL':
    case 'stoppedUP':
      return 'text-gray-500';
    case 'error':
    case 'missingFiles':
      return 'text-red-600';
    case 'queuedDL':
    case 'queuedUP':
      return 'text-yellow-600';
    case 'stalledDL':
    case 'stalledUP':
      return 'text-orange-600';
    case 'checkingDL':
    case 'checkingUP':
    case 'checkingResumeData':
      return 'text-purple-600';
    case 'allocating':
      return 'text-indigo-600';
    default:
      return 'text-gray-600';
  }
}

export const STATE_PRIORITY: Record<string, number> = {
  downloading: 1,
  forcedDL: 1,
  metaDL: 1,
  forcedMetaDL: 1,
  uploading: 2,
  forcedUP: 2,
  queuedDL: 3,
  queuedUP: 3,
  stalledDL: 4,
  stalledUP: 4,
  checkingDL: 5,
  checkingUP: 5,
  checkingResumeData: 5,
  pausedDL: 6,
  pausedUP: 6,
  stoppedDL: 6,
  stoppedUP: 6,
  error: 7,
  missingFiles: 7,
};

export function getStateText(state: string): string {
  switch (state) {
    case 'downloading':
      return '↓';
    case 'uploading':
      return '↑';
    case 'pausedDL':
    case 'pausedUP':
    case 'stoppedDL':
    case 'stoppedUP':
      return '⏸';
    case 'queuedDL':
    case 'queuedUP':
      return '⏳';
    case 'stalledDL':
    case 'stalledUP':
      return '⚠';
    case 'moving':
      return '↔';
    case 'checkingDL':
    case 'checkingUP':
    case 'checkingResumeData':
      return '🔍';
    case 'error':
      return '❌';
    case 'missingFiles':
      return '❓';
    case 'allocating':
      return '💾';
    case 'metaDL':
      return '📥';
    case 'forcedDL':
      return '⬇️';
    case 'forcedUP':
      return '⬆️';
    default:
      return '●';
  }
}