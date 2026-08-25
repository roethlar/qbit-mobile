import { useEffect, useState } from 'react';
import { BottomSheet } from './Layout';
import { LocationPresetList } from './LocationPresetList';
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

        <LocationPresetList
          heading="Presets"
          selectedPath={selectedPreset}
          onSelect={(path) => {
            setSelectedPreset(path);
            setCustomPath('');
          }}
        />

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
