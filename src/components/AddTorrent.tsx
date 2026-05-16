import { useState, useRef } from 'react';
import { Upload, Link, X } from 'lucide-react';
import { BottomSheet } from './Layout';

interface AddTorrentProps {
  isOpen: boolean;
  onClose: () => void;
  onAddUrl: (url: string, options?: AddTorrentOptions) => Promise<void>;
  onAddFile: (file: File, options?: AddTorrentOptions) => Promise<void>;
}

export interface AddTorrentOptions {
  savepath?: string;
  category?: string;
  stopped?: boolean;
  skip_checking?: boolean;
  sequentialDownload?: boolean;
  firstLastPiecePrio?: boolean;
}

export function AddTorrent({ isOpen, onClose, onAddUrl, onAddFile }: AddTorrentProps) {
  const [activeTab, setActiveTab] = useState<'url' | 'file'>('url');
  const [url, setUrl] = useState('');
  const [options, setOptions] = useState<AddTorrentOptions>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [urlError, setUrlError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    const isValid =
      /^magnet:\?/i.test(trimmed) ||
      /^https?:\/\//i.test(trimmed) ||
      /^[a-f0-9]{40}$/i.test(trimmed) ||
      /^[a-f0-9]{64}$/i.test(trimmed);

    if (!isValid) {
      setUrlError('Enter a magnet link, URL, or info hash');
      return;
    }

    setUrlError('');
    setSubmitError('');
    setSubmitting(true);
    try {
      await onAddUrl(trimmed, options);
      setUrl('');
      setOptions({});
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to add torrent');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSubmitError('');
    setSubmitting(true);
    try {
      await onAddFile(file, options);
      setOptions({});
      onClose();
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to add torrent file');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setUrl('');
    setOptions({});
    setActiveTab('url');
    setSubmitError('');
    setUrlError('');
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Add Torrent</h2>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="p-2 -mr-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex mb-6">
          <button
            onClick={() => setActiveTab('url')}
            className={`flex-1 py-2 px-4 text-center font-medium rounded-l-xl border-2 transition-colors ${
              activeTab === 'url'
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600'
            }`}
          >
            <Link className="w-4 h-4 inline-block mr-2" />
            URL/Magnet
          </button>
          <button
            onClick={() => setActiveTab('file')}
            className={`flex-1 py-2 px-4 text-center font-medium rounded-r-xl border-2 border-l-0 transition-colors ${
              activeTab === 'file'
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600'
            }`}
          >
            <Upload className="w-4 h-4 inline-block mr-2" />
            File
          </button>
        </div>

        {submitError && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <p className="text-red-800 dark:text-red-300 text-sm font-medium">{submitError}</p>
          </div>
        )}

        {activeTab === 'url' ? (
          <form onSubmit={handleSubmitUrl} className="space-y-4">
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Torrent URL or Magnet Link
              </label>
              <textarea
                id="url"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setUrlError(''); }}
                placeholder="magnet:?xt=urn:btih:... or https://..."
                className={`w-full p-3 border rounded-xl resize-none text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 ${urlError ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}`}
                rows={3}
                required
                disabled={submitting}
              />
              {urlError && <p className="text-xs text-red-500 mt-1">{urlError}</p>}
            </div>
            <TorrentOptions options={options} onChange={setOptions} />
            <button type="submit" className="w-full ios-button" disabled={submitting}>
              {submitting ? 'Adding…' : 'Add Torrent'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".torrent"
              onChange={handleFileChange}
              className="hidden"
              disabled={submitting}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting}
              className="w-full p-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-center hover:border-primary-400 transition-colors disabled:opacity-50"
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
              <p className="text-gray-600 dark:text-gray-300 font-medium">
                {submitting ? 'Adding…' : 'Choose .torrent file'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Tap to browse files</p>
            </button>
            <TorrentOptions options={options} onChange={setOptions} />
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

interface TorrentOptionsProps {
  options: AddTorrentOptions;
  onChange: (options: AddTorrentOptions) => void;
}

function TorrentOptions({ options, onChange }: TorrentOptionsProps) {
  const updateOption = <K extends keyof AddTorrentOptions>(key: K, value: AddTorrentOptions[K]) => {
    onChange({ ...options, [key]: value });
  };

  return (
    <div className="space-y-4">
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Options</h3>

        <div className="space-y-3">
          <div>
            <label htmlFor="savepath" className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Save Path (optional)
            </label>
            <input
              id="savepath"
              type="text"
              value={options.savepath || ''}
              onChange={(e) => updateOption('savepath', e.target.value)}
              placeholder="/downloads"
              className="w-full ios-input text-sm"
            />
          </div>

          <div>
            <label htmlFor="category" className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Category (optional)
            </label>
            <input
              id="category"
              type="text"
              value={options.category || ''}
              onChange={(e) => updateOption('category', e.target.value)}
              placeholder="Movies, TV Shows, etc."
              className="w-full ios-input text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={options.stopped || false}
                onChange={(e) => updateOption('stopped', e.target.checked)}
                className="mr-3 w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Start stopped</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={options.skip_checking || false}
                onChange={(e) => updateOption('skip_checking', e.target.checked)}
                className="mr-3 w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Skip hash checking</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={options.sequentialDownload || false}
                onChange={(e) => updateOption('sequentialDownload', e.target.checked)}
                className="mr-3 w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Sequential download</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={options.firstLastPiecePrio || false}
                onChange={(e) => updateOption('firstLastPiecePrio', e.target.checked)}
                className="mr-3 w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">First/last piece priority</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
