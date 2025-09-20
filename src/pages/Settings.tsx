import { useState, useEffect } from 'react';
import { ArrowLeft, Download, Upload, Folder, Wifi } from 'lucide-react';
import { Layout, Header } from '../components/Layout';
import { qbApi } from '../services/api';
import { formatBytes, formatSpeed } from '../utils/formatters';
import type { Preferences } from '../types/qbittorrent';

interface SettingsProps {
  onBack: () => void;
}

export function Settings({ onBack }: SettingsProps) {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const prefs = await qbApi.getPreferences();
      setPreferences(prefs);
    } catch (error) {
      // Failed to load preferences
      setLoadError('Failed to load qBittorrent preferences. Make sure qBittorrent is running and accessible.');
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async (newPrefs: Partial<Preferences>) => {
    try {
      setSaving(true);
      await qbApi.setPreferences(newPrefs);
      setPreferences(prev => prev ? { ...prev, ...newPrefs } : null);
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      // Failed to save preferences
      setSaveMessage('Failed to save settings');
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const updateDownloadLimit = (limit: number) => {
    savePreferences({ dl_limit: limit * 1024 }); // Convert KB/s to B/s
  };

  const updateUploadLimit = (limit: number) => {
    savePreferences({ up_limit: limit * 1024 }); // Convert KB/s to B/s
  };

  const updateSavePath = (path: string) => {
    savePreferences({ save_path: path });
  };

  if (loading) {
    return (
      <Layout>
        <Header
          title="Settings"
          leftButton={
            <button onClick={onBack} className="p-1 text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-5 h-5" />
            </button>
          }
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading settings...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!preferences) {
    return (
      <Layout>
        <Header
          title="Settings"
          leftButton={
            <button onClick={onBack} className="p-1 text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-5 h-5" />
            </button>
          }
        />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-sm">
            <p className="text-red-600 mb-2 font-medium">Failed to load settings</p>
            {loadError && (
              <p className="text-gray-600 text-sm mb-4">{loadError}</p>
            )}
            <button onClick={loadPreferences} className="ios-button">
              Retry
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Header
        title="Settings"
        leftButton={
          <button onClick={onBack} className="p-1 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
          </button>
        }
      />

      {saveMessage && (
        <div className={`mx-4 mb-4 p-3 rounded-xl ${
          saveMessage.includes('success') 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          <p className={`text-sm font-medium ${
            saveMessage.includes('success') ? 'text-green-800' : 'text-red-800'
          }`}>
            {saveMessage}
          </p>
        </div>
      )}

      <div className="space-y-6">
        {/* Speed Limits */}
        <div className="bg-white dark:bg-gray-800 rounded-xl mx-4 p-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Speed Limits</h2>
          
          <div className="space-y-4">
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Download className="w-4 h-4 mr-2" />
                Download Limit
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={preferences.dl_limit ? Math.round(preferences.dl_limit / 1024) : 0}
                  onChange={(e) => updateDownloadLimit(parseInt(e.target.value) || 0)}
                  placeholder="0 = unlimited"
                  className="flex-1 ios-input"
                  disabled={saving}
                />
                <span className="text-sm text-gray-500">KB/s</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Current: {preferences.dl_limit ? formatSpeed(preferences.dl_limit) : 'Unlimited'}
              </p>
            </div>

            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Upload className="w-4 h-4 mr-2" />
                Upload Limit
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={preferences.up_limit ? Math.round(preferences.up_limit / 1024) : 0}
                  onChange={(e) => updateUploadLimit(parseInt(e.target.value) || 0)}
                  placeholder="0 = unlimited"
                  className="flex-1 ios-input"
                  disabled={saving}
                />
                <span className="text-sm text-gray-500">KB/s</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Current: {preferences.up_limit ? formatSpeed(preferences.up_limit) : 'Unlimited'}
              </p>
            </div>
          </div>
        </div>

        {/* Download Path */}
        <div className="bg-white dark:bg-gray-800 rounded-xl mx-4 p-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Download Path</h2>
          
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Folder className="w-4 h-4 mr-2" />
              Default Save Path
            </label>
            <input
              type="text"
              value={preferences.save_path || ''}
              onChange={(e) => updateSavePath(e.target.value)}
              placeholder="/path/to/downloads"
              className="w-full ios-input"
              disabled={saving}
            />
          </div>
        </div>

        {/* Connection */}
        <div className="bg-white dark:bg-gray-800 rounded-xl mx-4 p-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Connection</h2>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Wifi className="w-4 h-4 mr-2 text-gray-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Listening Port
                </span>
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {preferences.listen_port || 'Auto'}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Max Connections
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {preferences.max_connec || 'Unlimited'}
              </span>
            </div>
          </div>
        </div>

        {/* BitTorrent */}
        <div className="bg-white dark:bg-gray-800 rounded-xl mx-4 p-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">BitTorrent</h2>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                DHT Enabled
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {preferences.dht ? 'Yes' : 'No'}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                PeX Enabled
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {preferences.pex ? 'Yes' : 'No'}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                LSD Enabled
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {preferences.lsd ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        </div>

        {/* Spacing for FAB */}
        <div className="h-20" />
      </div>
    </Layout>
  );
}