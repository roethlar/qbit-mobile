import axios from 'axios';
import type { Torrent, GlobalTransferInfo, TorrentInfo, Preferences } from '../types/qbittorrent';

const api = axios.create({
  baseURL: '/api/v2',
  timeout: 30000, // Increase timeout for large torrent lists
  withCredentials: false, // Server handles auth
});

export interface LoginResponse {
  success: boolean;
  message?: string;
}

export class QBittorrentAPI {
  private static instance: QBittorrentAPI;
  private isAuthenticated = false;
  private initPromise: Promise<void> | null = null;

  static getInstance(): QBittorrentAPI {
    if (!QBittorrentAPI.instance) {
      QBittorrentAPI.instance = new QBittorrentAPI();
      // Auto-initialize with empty credentials
      QBittorrentAPI.instance.initialize();
    }
    return QBittorrentAPI.instance;
  }

  private async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = (async () => {
      try {
        // Try empty login for local bypass
        const response = await api.post('/auth/login', new URLSearchParams({
          username: '',
          password: '',
        }), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
        
        if (response.status === 200 && response.data === 'Ok.') {
          this.isAuthenticated = true;
          console.log('Successfully authenticated with empty credentials');
        } else {
          console.error('Unexpected auth response:', response.data);
        }
      } catch (error) {
        console.error('Initial auth failed:', error);
        // Try again without credentials at all
        try {
          const response2 = await api.post('/auth/login', '', {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          });
          if (response2.status === 200 && response2.data === 'Ok.') {
            this.isAuthenticated = true;
            console.log('Successfully authenticated without credentials');
          }
        } catch (error2) {
          console.error('Second auth attempt failed:', error2);
        }
      }
    })();
    
    return this.initPromise;
  }

  async ensureInitialized(): Promise<void> {
    if (!this.initPromise) {
      await this.initialize();
    }
    return this.initPromise;
  }

  async login(username: string, password: string): Promise<LoginResponse> {
    try {
      const response = await api.post('/auth/login', new URLSearchParams({
        username,
        password,
      }));

      if (response.status === 200 && response.data === 'Ok.') {
        this.isAuthenticated = true;
        return { success: true };
      } else {
        return { success: false, message: 'Invalid credentials' };
      }
    } catch (error) {
      console.error('Login failed:', error);
      return { success: false, message: 'Connection failed' };
    }
  }

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
      this.isAuthenticated = false;
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  async checkAuth(): Promise<boolean> {
    try {
      const response = await api.get('/app/version');
      this.isAuthenticated = response.status === 200;
      return this.isAuthenticated;
    } catch {
      // Try to access preferences to check if auth is bypassed
      try {
        const prefResponse = await api.get('/app/preferences');
        this.isAuthenticated = prefResponse.status === 200;
        return this.isAuthenticated;
      } catch {
        this.isAuthenticated = false;
        return false;
      }
    }
  }

  async getVersion(): Promise<string> {
    const response = await api.get('/app/version');
    return response.data;
  }

  async getTorrents(filter?: string, category?: string, tag?: string, sort?: string, reverse?: boolean, limit?: number, offset?: number): Promise<Torrent[]> {
    await this.ensureInitialized(); // Ensure we're authenticated first
    
    const params: Record<string, string | number> = {};
    
    if (filter) params.filter = filter;
    if (category) params.category = category;
    if (tag) params.tag = tag;
    if (sort) params.sort = sort;
    if (reverse !== undefined) params.reverse = reverse.toString();
    if (limit !== undefined) params.limit = limit;
    if (offset !== undefined) params.offset = offset;

    try {
      const response = await api.get('/torrents/info', { params });
      console.log('API getTorrents response:', response.data?.length || 0, 'torrents');
      return response.data || [];
    } catch (error: any) {
      // If 401, try to re-authenticate once
      if (error?.response?.status === 401) {
        console.log('Got 401, trying to re-authenticate...');
        this.initPromise = null; // Reset init promise
        await this.initialize();
        
        // Try the request again
        try {
          const response = await api.get('/torrents/info', { params });
          console.log('API getTorrents response after re-auth:', response.data?.length || 0, 'torrents');
          return response.data || [];
        } catch (retryError) {
          console.error('Failed after re-auth:', retryError);
          throw retryError;
        }
      }
      
      console.error('Failed to fetch torrents - full error:', error);
      throw error;
    }
  }

  async getGlobalTransferInfo(): Promise<GlobalTransferInfo> {
    await this.ensureInitialized(); // Ensure we're authenticated first
    const response = await api.get('/transfer/info');
    return response.data;
  }

  async getTorrentInfo(hash: string): Promise<TorrentInfo> {
    const response = await api.get('/torrents/properties', {
      params: { hash }
    });
    return response.data;
  }

  async pauseTorrent(hash: string): Promise<void> {
    await api.post('/torrents/pause', new URLSearchParams({ hashes: hash }));
  }

  async resumeTorrent(hash: string): Promise<void> {
    await api.post('/torrents/resume', new URLSearchParams({ hashes: hash }));
  }

  async deleteTorrent(hash: string, deleteFiles = false): Promise<void> {
    await api.post('/torrents/delete', new URLSearchParams({
      hashes: hash,
      deleteFiles: deleteFiles.toString()
    }));
  }

  async addTorrent(torrentData: string | File, options?: {
    savepath?: string;
    cookie?: string;
    category?: string;
    tags?: string;
    skip_checking?: boolean;
    paused?: boolean;
    root_folder?: boolean;
    rename?: string;
    upLimit?: number;
    dlLimit?: number;
    ratioLimit?: number;
    seedingTimeLimit?: number;
    autoTMM?: boolean;
    sequentialDownload?: boolean;
    firstLastPiecePrio?: boolean;
  }): Promise<void> {
    const formData = new FormData();
    
    if (typeof torrentData === 'string') {
      formData.append('urls', torrentData);
    } else {
      formData.append('torrents', torrentData);
    }

    if (options) {
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined) {
          formData.append(key, value.toString());
        }
      });
    }

    await api.post('/torrents/add', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  async setTorrentPriority(hash: string, priority: 'increase' | 'decrease' | 'maxPrio' | 'minPrio'): Promise<void> {
    await api.post(`/torrents/${priority}Prio`, new URLSearchParams({ hashes: hash }));
  }

  async setGlobalDownloadLimit(limit: number): Promise<void> {
    await api.post('/transfer/setDownloadLimit', new URLSearchParams({
      limit: limit.toString()
    }));
  }

  async setGlobalUploadLimit(limit: number): Promise<void> {
    await api.post('/transfer/setUploadLimit', new URLSearchParams({
      limit: limit.toString()
    }));
  }

  async getPreferences(): Promise<Preferences> {
    const response = await api.get('/app/preferences');
    return response.data;
  }

  async setPreferences(prefs: Partial<Preferences>): Promise<void> {
    await api.post('/app/setPreferences', {
      json: JSON.stringify(prefs)
    });
  }

  get authenticated(): boolean {
    return this.isAuthenticated;
  }
}

export const qbApi = QBittorrentAPI.getInstance();