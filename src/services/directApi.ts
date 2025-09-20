import axios from 'axios';
import type { Torrent, GlobalTransferInfo } from '../types/qbittorrent';

// Create axios instance that connects to our Express proxy server
// This server runs on the same machine and makes requests from the correct network
const proxyHost = import.meta.env.VITE_PROXY_HOST || window.location.hostname;
const proxyPort = import.meta.env.VITE_PROXY_PORT || window.location.port || '3000';
const api = axios.create({
  baseURL: `/api/v2`,
  timeout: 30000,
  withCredentials: false,
});

export async function getTorrents(): Promise<Torrent[]> {
  // Making torrents request
  try {
    const response = await api.get('/torrents/info');
    // Got torrents response
    return response.data || [];
  } catch (error) {
    // Failed to get torrents
    throw error; // Let React Query handle the error instead of returning empty array
  }
}

export async function getGlobalStats(): Promise<GlobalTransferInfo | null> {
  try {
    const response = await api.get('/transfer/info');
    return response.data;
  } catch (error) {
    // Failed to get stats
    return null;
  }
}

export async function pauseTorrent(hash: string): Promise<void> {
  await api.post('/torrents/pause', new URLSearchParams({ hashes: hash }));
}

export async function resumeTorrent(hash: string): Promise<void> {
  await api.post('/torrents/resume', new URLSearchParams({ hashes: hash }));
}

export async function deleteTorrent(hash: string, deleteFiles = false): Promise<void> {
  await api.post('/torrents/delete', new URLSearchParams({ 
    hashes: hash, 
    deleteFiles: deleteFiles.toString() 
  }));
}

export interface AddTorrentOptions {
  savepath?: string;
  category?: string;
  paused?: boolean;
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