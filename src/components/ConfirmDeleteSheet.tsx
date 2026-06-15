import { BottomSheet } from './Layout';

interface ConfirmDeleteSheetProps {
  isOpen: boolean;
  onClose: () => void;
  // For single delete: the torrent's name. For bulk: "N torrents".
  subject: string;
  // 1 by default. >1 changes the copy to plural ("torrents") and uses a
  // generic warning rather than echoing the subject as a quoted name.
  count?: number;
  // While true the delete request is in flight: disable the confirm actions so
  // a double-tap can't issue duplicate deletes before the sheet closes.
  pending?: boolean;
  onConfirm: (deleteFiles: boolean) => void | Promise<void>;
}

export function ConfirmDeleteSheet({
  isOpen,
  onClose,
  subject,
  count = 1,
  pending = false,
  onConfirm,
}: ConfirmDeleteSheetProps) {
  const isBulk = count > 1;
  const noun = isBulk ? 'torrents' : 'torrent';
  const title = isBulk ? `Delete ${count} torrents?` : 'Delete Torrent';
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={title}>
      <div className="p-4 space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {isBulk ? 'This cannot be undone.' : `Are you sure you want to delete "${subject}"?`}
        </p>
        <div className="space-y-2">
          <button
            onClick={() => onConfirm(false)}
            disabled={pending}
            className="w-full ios-button-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete {noun} only
          </button>
          <button
            onClick={() => onConfirm(true)}
            disabled={pending}
            className="w-full bg-red-600 text-white rounded-xl py-3 px-6 font-medium active:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? 'Deleting…' : `Delete ${noun} and files`}
          </button>
          <button
            onClick={onClose}
            disabled={pending}
            className="w-full ios-button-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
