import { useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, X, FolderInput } from 'lucide-react';
import { clsx } from 'clsx';
import { useLocationPresets, useUpdateLocationPresets } from '../hooks/useLocationPresets';
import type { LocationPreset } from '../services/directApi';

interface DraftRow {
  // Stable key so removing a row keeps the input focus on its sibling rather
  // than the React index hopping around.
  uid: number;
  name: string;
  path: string;
}

let uidCounter = 1;

function toDraft(list: LocationPreset[]): DraftRow[] {
  return list.map((p) => ({ uid: uidCounter++, name: p.name, path: p.path }));
}

function toServerPayload(draft: DraftRow[]): LocationPreset[] {
  return draft
    .map(({ name, path }) => ({ name: name.trim(), path: path.trim() }))
    .filter((p) => p.name !== '' || p.path !== '');
}

function shallowEqual(a: LocationPreset[], b: LocationPreset[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].name !== b[i].name || a[i].path !== b[i].path) return false;
  }
  return true;
}

export function LocationPresetsCard() {
  const presets = useLocationPresets();
  const update = useUpdateLocationPresets();
  const [draft, setDraft] = useState<DraftRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  // Seed the draft from the server response once it arrives, and keep it in
  // sync if the server data changes from outside (rare — only on the first
  // load or a manual refetch).
  useEffect(() => {
    if (presets.data && draft.length === 0 && !presets.isFetching) {
      setDraft(toDraft(presets.data));
    }
    // We intentionally only resync when draft is empty so live edits don't
    // get clobbered by a background refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presets.data]);

  const cleaned = toServerPayload(draft);
  const isDirty = !shallowEqual(cleaned, presets.data ?? []);
  const canSave = isDirty && !update.isPending;

  const addRow = () => {
    setDraft((prev) => [...prev, { uid: uidCounter++, name: '', path: '' }]);
    setError(null);
    setSavedNote(null);
  };

  const removeRow = (uid: number) => {
    setDraft((prev) => prev.filter((row) => row.uid !== uid));
    setError(null);
    setSavedNote(null);
  };

  const updateField = (uid: number, field: 'name' | 'path', value: string) => {
    setDraft((prev) =>
      prev.map((row) => (row.uid === uid ? { ...row, [field]: value } : row)),
    );
    setError(null);
    setSavedNote(null);
  };

  const handleSave = async () => {
    setError(null);
    setSavedNote(null);
    try {
      const saved = await update.mutateAsync(cleaned);
      setDraft(toDraft(saved));
      setSavedNote('Saved');
      setTimeout(() => setSavedNote(null), 2000);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const data = err.response?.data as { error?: string } | undefined;
        setError(data?.error || err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to save presets');
      }
    }
  };

  const handleReset = () => {
    if (presets.data) setDraft(toDraft(presets.data));
    setError(null);
    setSavedNote(null);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl mx-4 p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center">
          <FolderInput className="w-4 h-4 mr-2 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Move-to Presets
          </h2>
        </div>
        {savedNote && (
          <span className="text-xs font-medium text-green-600 dark:text-green-400 mt-1">
            {savedNote}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Named target paths shown in the Move sheet. Each row is one preset.
      </p>

      {presets.isLoading && (
        <p className="text-xs text-gray-500 dark:text-gray-400">Loading…</p>
      )}

      {presets.isError && (
        <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-800 dark:text-red-300">
          Couldn't load presets.
        </div>
      )}

      <ul className="space-y-2">
        {draft.map((row) => (
          <li
            key={row.uid}
            className="rounded-lg border border-gray-200 dark:border-gray-700 p-2 space-y-1"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={row.name}
                onChange={(e) => updateField(row.uid, 'name', e.target.value)}
                placeholder="Name"
                aria-label="Preset name"
                maxLength={64}
                className="flex-1 ios-input text-sm"
                disabled={update.isPending}
              />
              <button
                onClick={() => removeRow(row.uid)}
                aria-label="Remove preset"
                disabled={update.isPending}
                className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 active:bg-gray-100 dark:active:bg-gray-700 rounded disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              value={row.path}
              onChange={(e) => updateField(row.uid, 'path', e.target.value)}
              placeholder="/path/on/server"
              aria-label="Preset path"
              maxLength={512}
              className="w-full ios-input text-sm"
              disabled={update.isPending}
            />
          </li>
        ))}
      </ul>

      <button
        onClick={addRow}
        disabled={update.isPending}
        className="w-full mt-2 flex items-center justify-center gap-1 py-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 active:bg-gray-50 dark:active:bg-gray-700 disabled:opacity-50"
      >
        <Plus className="w-4 h-4" /> Add preset
      </button>

      {error && (
        <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-800 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={!canSave}
          className={clsx(
            'flex-1 rounded-xl py-2 px-4 text-sm font-medium transition-colors',
            canSave
              ? 'bg-primary-600 text-white active:bg-primary-700'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed',
          )}
        >
          {update.isPending ? 'Saving…' : 'Save presets'}
        </button>
        <button
          onClick={handleReset}
          disabled={!isDirty || update.isPending}
          className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 active:bg-gray-200 disabled:opacity-50"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
