import { X, AlertTriangle } from 'lucide-react';

interface DeleteUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  filename: string;
  rowCount: number | null;
  isDeleting: boolean;
}

export default function DeleteUploadModal({
  isOpen,
  onClose,
  onConfirm,
  filename,
  rowCount,
  isDeleting,
}: DeleteUploadModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card rounded-2xl max-w-lg w-full p-6 shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-red-500 rounded-lg p-2 shadow-lg">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Delete Upload
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6 space-y-4">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-800 dark:text-red-300 font-semibold mb-2">
              Warning: This action cannot be undone!
            </p>
            <p className="text-sm text-red-700 dark:text-red-400">
              Deleting this upload will permanently remove:
            </p>
            <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-400 mt-2 space-y-1 ml-2">
              <li>The upload record</li>
              <li>All {rowCount !== null ? rowCount : 'associated'} sales records from this upload</li>
              <li>The stored file</li>
            </ul>
          </div>

          <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-zinc-400 mb-1">
              File to delete:
            </p>
            <p className="text-base font-semibold text-gray-900 dark:text-white break-all">
              {filename}
            </p>
          </div>

          <p className="text-sm text-gray-600 dark:text-zinc-400">
            Your dashboard analytics will be updated automatically after deletion.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-gray-900 dark:text-white rounded-lg font-semibold transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg font-semibold transition disabled:cursor-not-allowed"
          >
            {isDeleting ? 'Deleting...' : 'Delete Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}
