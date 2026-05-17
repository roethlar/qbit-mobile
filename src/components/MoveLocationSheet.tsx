import { useEffect, useState } from 'react';
import { Folder, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { BottomSheet } from './Layout';
import { useLocationPresets } from '../hooks/useLocationPresets';

interface MoveLocationSheetProps {
  isOpen: boolean;
  onClose: () => void;
  // Description of what's being moved: a single torrent name, or a
  // count like "5 torrents" for bulk operations.
  subject: string;
  // Empty when bulk-moving torrents that may have different paths.
  currentPath: string;
  onSubmit: (location: string) => Promise<void>;
}

export function MoveLocationSheet({
  isOpen,
  onClose,
  subject,
  currentPath,
  onSubmit,
}: MoveLocationSheetProps) {
  const presets = useLocationPresets();
  const [customPath, setCustomPath] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form whenever the sheet opens.
  useEffect(() => {
    if (isOpen) {
      setCustomPath('');
      setSelectedPreset(null);
      setSubmitting(false);
      setError(null);
    }
  }, [isOpen]);

  const target = selectedPreset ?? customPath.trim();
  const canSubmit = !!target && target !== currentPath && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(target);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move torrent');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Move torrent">
      <div className="p-4 space-y-4">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Move</p>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate selectable">
            {subject}
          </p>
        </div>
        {currentPath && (
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Currently</p>
            <p className="text-sm text-gray-900 dark:text-gray-100 break-all selectable">
              {currentPath}
            </p>
          </div>
        )}

        {presets.data && presets.data.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
              Presets
            </p>
            <ul className="space-y-1">
              {presets.data.map((p) => (
                <li key={`${p.name}=${p.path}`}>
                  <button
                    onClick={() => {
                      setSelectedPreset(p.path);
                      setCustomPath('');
                    }}
                    className={clsx(
                      'w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors',
                      selectedPreset === p.path
                        ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 active:bg-gray-100 dark:active:bg-gray-600',
                    )}
                  >
                    <Folder className="w-4 h-4 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                        {p.path}
                      </p>
                    </div>
                    {selectedPreset === p.path && (
                      <Check className="w-4 h-4 flex-shrink-0" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {presets.isLoading && (
          <p className="text-xs text-gray-500 dark:text-gray-400">Loading presets…</p>
        )}

        {presets.isError && (
          <p className="text-xs text-red-600 dark:text-red-400">
            Couldn't load preset list — type a path below to continue.
          </p>
        )}

        <div>
          <label
            htmlFor="custom-path"
            className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1"
          >
            Custom path
          </label>
          <input
            id="custom-path"
            type="text"
            value={customPath}
            onChange={(e) => {
              setCustomPath(e.target.value);
              setSelectedPreset(null);
            }}
            placeholder={currentPath || '/path/to/new/location'}
            className="w-full ios-input text-sm"
            disabled={submitting}
          />
          {!presets.data?.length && !presets.isLoading && !presets.isError && (
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              No presets configured. Set <code className="font-mono">DOWNLOAD_LOCATIONS</code> in
              .env to populate this menu.
            </p>
          )}
        </div>

        {error && (
          <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
            <p className="text-xs text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        <div className="space-y-2">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full ios-button disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Moving…' : target && target !== currentPath ? `Move to ${target}` : 'Move'}
          </button>
          <button
            onClick={onClose}
            disabled={submitting}
            className="w-full ios-button-secondary disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
