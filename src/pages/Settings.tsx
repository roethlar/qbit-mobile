import { useState, useEffect } from 'react';
import { ArrowLeft, Download, Upload, Folder, Wifi } from 'lucide-react';
import { Layout, Header } from '../components/Layout';
import { getPreferences, setPreferences as apiSetPreferences } from '../services/directApi';
import { formatSpeed } from '../utils/formatters';
import type { Preferences } from '../types/qbittorrent';

interface SettingsProps {
  onBack: () => void;
}

interface DraftPrefs {
  dl_limit_kbps: number;
  up_limit_kbps: number;
  save_path: string;
}

function toDraft(prefs: Preferences): DraftPrefs {
  return {
    dl_limit_kbps: prefs.dl_limit ? Math.round(prefs.dl_limit / 1024) : 0,
    up_limit_kbps: prefs.up_limit ? Math.round(prefs.up_limit / 1024) : 0,
    save_path: prefs.save_path || '',
  };
}

export function Settings({ onBack }: SettingsProps) {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [draft, setDraft] = useState<DraftPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const prefs = await getPreferences();
      setPreferences(prefs);
      setDraft(toDraft(prefs));
    } catch (error) {
      console.error('Failed to load preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  // Compute only the fields that actually changed so we don't clobber the
  // server's higher-precision byte values when the user only edited save_path.
  const buildChangeSet = (): Partial<Preferences> => {
    if (!draft || !preferences) return {};
    const changes: Partial<Preferences> = {};
    const currentDlKbps = Math.round((preferences.dl_limit || 0) / 1024);
    const currentUpKbps = Math.round((preferences.up_limit || 0) / 1024);
    if (draft.dl_limit_kbps !== currentDlKbps) changes.dl_limit = draft.dl_limit_kbps * 1024;
    if (draft.up_limit_kbps !== currentUpKbps) changes.up_limit = draft.up_limit_kbps * 1024;
    if (draft.save_path !== (preferences.save_path || '')) changes.save_path = draft.save_path;
    return changes;
  };

  const isDirty = Object.keys(buildChangeSet()).length > 0;

  const handleSave = async () => {
    const changes = buildChangeSet();
    if (Object.keys(changes).length === 0) return;
    try {
      setSaving(true);
      await apiSetPreferences(changes);
      setPreferences(prev => prev ? { ...prev, ...changes } : null);
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save preferences:', error);
      setSaveMessage('Failed to save settings');
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (preferences) setDraft(toDraft(preferences));
  };

  const updateDraft = <K extends keyof DraftPrefs>(key: K, value: DraftPrefs[K]) => {
    setDraft(prev => prev ? { ...prev, [key]: value } : prev);
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
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 mb-4">Failed to load settings</p>
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
                  min="0"
                  value={draft?.dl_limit_kbps ?? 0}
                  onChange={(e) => updateDraft('dl_limit_kbps', Math.max(0, parseInt(e.target.value, 10) || 0))}
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
                  min="0"
                  value={draft?.up_limit_kbps ?? 0}
                  onChange={(e) => updateDraft('up_limit_kbps', Math.max(0, parseInt(e.target.value, 10) || 0))}
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
              value={draft?.save_path ?? ''}
              onChange={(e) => updateDraft('save_path', e.target.value)}
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

        {/* Save / Reset actions */}
        <div className="mx-4 flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="flex-1 bg-primary-600 text-white rounded-xl py-3 px-6 font-medium active:bg-primary-700 transition-colors disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={handleReset}
            disabled={!isDirty || saving}
            className="px-6 py-3 rounded-xl font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 active:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reset
          </button>
        </div>

        {/* Spacing for FAB */}
        <div className="h-20" />
      </div>
    </Layout>
  );
}