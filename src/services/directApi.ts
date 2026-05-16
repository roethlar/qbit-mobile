import axios from 'axios';
import type {
  Torrent,
  GlobalTransferInfo,
  Preferences,
  TorrentProperties,
  TorrentFile,
  TorrentTracker,
} from '../types/qbittorrent';

const api = axios.create({
  baseURL: `/api/v2`,
  timeout: 30000,
  withCredentials: false,
});

export async function getTorrents(): Promise<Torrent[]> {
  const response = await api.get('/torrents/info');
  return response.data || [];
}

export async function getGlobalStats(): Promise<GlobalTransferInfo> {
  const response = await api.get('/transfer/info');
  return response.data;
}

export async function pauseTorrent(hash: string): Promise<void> {
  await api.post('/torrents/stop', new URLSearchParams({ hashes: hash }));
}

export async function resumeTorrent(hash: string): Promise<void> {
  await api.post('/torrents/start', new URLSearchParams({ hashes: hash }));
}

export async function deleteTorrent(hash: string, deleteFiles = false): Promise<void> {
  await api.post('/torrents/delete', new URLSearchParams({
    hashes: hash,
    deleteFiles: deleteFiles.toString(),
  }));
}

// The proxy caps each request at 200 hashes as a safety net. We chunk well
// below that so a "select all" against a 2000-torrent install fans out into
// ~20 sequential requests instead of one rejected mega-POST. Sequential so
// a failure mid-way doesn't continue racing — the user sees the error and
// the next refetch reconciles partial progress.
const BULK_CHUNK_SIZE = 100;

async function chunked<T>(items: T[], size: number, fn: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < items.length; i += size) {
    await fn(items.slice(i, i + size));
  }
}

export async function pauseTorrents(hashes: string[]): Promise<void> {
  await chunked(hashes, BULK_CHUNK_SIZE, (chunk) =>
    api.post('/torrents/stop', new URLSearchParams({ hashes: chunk.join('|') })),
  );
}

export async function resumeTorrents(hashes: string[]): Promise<void> {
  await chunked(hashes, BULK_CHUNK_SIZE, (chunk) =>
    api.post('/torrents/start', new URLSearchParams({ hashes: chunk.join('|') })),
  );
}

export async function deleteTorrents(hashes: string[], deleteFiles = false): Promise<void> {
  await chunked(hashes, BULK_CHUNK_SIZE, (chunk) =>
    api.post('/torrents/delete', new URLSearchParams({
      hashes: chunk.join('|'),
      deleteFiles: deleteFiles.toString(),
    })),
  );
}

export interface AddTorrentOptions {
  savepath?: string;
  category?: string;
  stopped?: boolean;
  skip_checking?: boolean;
  sequentialDownload?: boolean;
  firstLastPiecePrio?: boolean;
}

export async function addTorrentUrl(url: string, options?: AddTorrentOptions): Promise<void> {
  const formData = new FormData();
  formData.append('urls', url);
  
  if (options) {
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        formData.append(key, value.toString());
      }
    });
  }
  
  await api.post('/torrents/add', formData);
}

export async function addTorrentFile(file: File, options?: AddTorrentOptions): Promise<void> {
  const formData = new FormData();
  formData.append('torrents', file);

  if (options) {
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        formData.append(key, value.toString());
      }
    });
  }

  await api.post('/torrents/add', formData);
}

export async function getPreferences(): Promise<Preferences> {
  const response = await api.get('/app/preferences');
  return response.data;
}

export async function setPreferences(prefs: Partial<Preferences>): Promise<void> {
  await api.post(
    '/app/setPreferences',
    new URLSearchParams({ json: JSON.stringify(prefs) })
  );
}

export async function getTorrentProperties(hash: string): Promise<TorrentProperties> {
  const response = await api.get('/torrents/properties', { params: { hash } });
  return response.data;
}

export async function getTorrentFiles(hash: string): Promise<TorrentFile[]> {
  const response = await api.get('/torrents/files', { params: { hash } });
  return response.data || [];
}

export async function getTorrentTrackers(hash: string): Promise<TorrentTracker[]> {
  const response = await api.get('/torrents/trackers', { params: { hash } });
  return response.data || [];
}

export async function recheckTorrent(hash: string): Promise<void> {
  await api.post('/torrents/recheck', new URLSearchParams({ hashes: hash }));
}

export async function reannounceTorrent(hash: string): Promise<void> {
  await api.post('/torrents/reannounce', new URLSearchParams({ hashes: hash }));
}
