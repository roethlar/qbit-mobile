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
  console.log('getTorrents called, making request to:', api.defaults.baseURL + '/torrents/info');
  try {
    const response = await api.get('/torrents/info');
    console.log('Got torrents response:', response);
    console.log('Got torrents data:', response.data?.length || 0);
    return response.data || [];
  } catch (error) {
    console.error('Failed to get torrents - full error:', error);
    console.error('Error response:', error.response);
    return [];
  }
}

export async function getGlobalStats(): Promise<GlobalTransferInfo | null> {
  try {
    const response = await api.get('/transfer/info');
    return response.data;
  } catch (error) {
    console.error('Failed to get stats:', error);
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

export async function addTorrentUrl(url: string): Promise<void> {
  const formData = new FormData();
  formData.append('urls', url);
  await api.post('/torrents/add', formData);
}

export async function addTorrentFile(file: File): Promise<void> {
  const formData = new FormData();
  formData.append('torrents', file);
  await api.post('/torrents/add', formData);
}