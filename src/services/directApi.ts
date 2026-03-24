import axios from 'axios';
import type { Torrent, GlobalTransferInfo } from '../types/qbittorrent';

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
