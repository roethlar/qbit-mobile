import { Folder, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { useLocationPresets } from '../hooks/useLocationPresets';

interface LocationPresetListProps {
  // The path currently chosen (tapped preset or typed); the matching preset
  // is highlighted.
  selectedPath: string | null;
  onSelect: (path: string) => void;
  heading?: string;
  className?: string;
}

// Shared preset picker for anywhere a save path is chosen — the move sheet
// and the add-torrent sheet. Renders nothing when there are no presets and
// nothing to report, so callers can drop it in without disturbing the
// empty layout.
export function LocationPresetList({
  selectedPath,
  onSelect,
  heading,
  className,
}: LocationPresetListProps) {
  const presets = useLocationPresets();

  if (presets.isLoading) {
    return (
      <p className={clsx('text-xs text-gray-500 dark:text-gray-400', className)}>
        Loading presets…
      </p>
    );
  }

  if (presets.isError) {
    return (
      <p className={clsx('text-xs text-red-600 dark:text-red-400', className)}>
        Couldn't load preset list — type a path below to continue.
      </p>
    );
  }

  if (!presets.data || presets.data.length === 0) return null;

  return (
    <div className={className}>
      {heading && (
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
          {heading}
        </p>
      )}
      <ul className="space-y-1">
        {presets.data.map((p) => {
          const selected = selectedPath === p.path;
          return (
            <li key={`${p.name}=${p.path}`}>
              <button
                type="button"
                onClick={() => onSelect(p.path)}
                className={clsx(
                  'w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors',
                  selected
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 active:bg-gray-100 dark:active:bg-gray-600',
                )}
              >
                <Folder className="w-4 h-4 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{p.path}</p>
                </div>
                {selected && <Check className="w-4 h-4 flex-shrink-0" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
