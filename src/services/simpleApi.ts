import axios from 'axios';
import type { Torrent, GlobalTransferInfo } from '../types/qbittorrent';

const api = axios.create({
  baseURL: '/api/v2',
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  }
});

let isInitialized = false;

async function ensureAuth() {
  if (isInitialized) return;
  
  try {
    // Just do a simple POST to login with no data
    const response = await api.post('/auth/login');
    console.log('Auth response:', response.data);
    isInitialized = true;
  } catch (error) {
    console.error('Auth failed, but continuing anyway:', error);
    isInitialized = true; // Continue anyway
  }
}

export async function getTorrents(): Promise<Torrent[]> {
  await ensureAuth();
  
  try {
    const response = await api.get('/torrents/info');
    console.log('Got torrents:', response.data?.length || 0);
    return response.data || [];
  } catch (error: any) {
    if (error?.response?.status === 401) {
      console.log('Got 401, retrying auth...');
      isInitialized = false;
      await ensureAuth();
      
      // Try again
      const response = await api.get('/torrents/info');
      return response.data || [];
    }
    console.error('Failed to get torrents:', error);
    return [];
  }
}

export async function getGlobalStats(): Promise<GlobalTransferInfo | null> {
  await ensureAuth();
  
  try {
    const response = await api.get('/transfer/info');
    return response.data;
  } catch (error) {
    console.error('Failed to get stats:', error);
    return null;
  }
}

export async function pauseTorrent(hash: string): Promise<void> {
  await ensureAuth();
  await api.post('/torrents/pause', `hashes=${hash}`);
}

export async function resumeTorrent(hash: string): Promise<void> {
  await ensureAuth();
  await api.post('/torrents/resume', `hashes=${hash}`);
}

export async function deleteTorrent(hash: string, deleteFiles = false): Promise<void> {
  await ensureAuth();
  await api.post('/torrents/delete', `hashes=${hash}&deleteFiles=${deleteFiles}`);
}

export async function addTorrentUrl(url: string): Promise<void> {
  await ensureAuth();
  const formData = new FormData();
  formData.append('urls', url);
  await api.post('/torrents/add', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
}

export async function addTorrentFile(file: File): Promise<void> {
  await ensureAuth();
  const formData = new FormData();
  formData.append('torrents', file);
  await api.post('/torrents/add', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
}