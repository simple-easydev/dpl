import { useState } from 'react';
import { X, AlertTriangle, Trash2 } from 'lucide-react';
import { softDeleteOrganization } from '../lib/platformAdminService';

interface DeleteBrandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  brandId: string;
  brandName: string;
  stats: {
    memberCount: number;
    totalRevenue: number;
    salesCount: number;
    uploadCount: number;
    accountCount: number;
    productCount: number;
  };
}

export default function DeleteBrandModal({
  isOpen,
  onClose,
  onSuccess,
  brandId,
  brandName,
  stats,
}: DeleteBrandModalProps) {
  const [confirmName, setConfirmName] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isConfirmValid = confirmName === brandName;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConfirmValid) {
      setError('Brand name does not match');
      return;
    }

    setLoading(true);
    setError(null);

    const { error: deleteError } = await softDeleteOrganization(brandId, reason || undefined);

    if (deleteError) {
      setError(deleteError.message || 'Failed to delete brand');
      setLoading(false);
    } else {
      setConfirmName('');
      setReason('');
      onSuccess();
    }
  };

  const handleClose = () => {
    if (!loading) {
      setConfirmName('');
      setReason('');
      setError(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b table-border flex items-center justify-between sticky top-0 glass-card z-10">
          <div className="flex items-center gap-3">
            <div className="rounded-xl p-2 bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-theme-text">Delete Brand</h2>
              <p className="text-sm text-theme-muted">This action will soft-delete the brand</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-theme-muted hover:text-theme-text transition p-2 hover:bg-white/5 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
          )}

          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                  You are about to soft-delete: <span className="font-bold">{brandName}</span>
                </p>
                <p className="text-sm text-red-700 dark:text-red-400">
                  This brand will be marked as deleted but all data will be preserved. You can restore it later if needed.
                </p>
              </div>
            </div>
          </div>

          <div className="glass rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-theme-text uppercase tracking-wide">
              Brand Statistics
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 glass rounded-lg">
                <span className="text-sm text-theme-muted">Team Members</span>
                <span className="text-lg font-semibold text-theme-text">{stats.memberCount}</span>
              </div>
              <div className="flex items-center justify-between p-3 glass rounded-lg">
                <span className="text-sm text-theme-muted">Total Revenue</span>
                <span className="text-lg font-semibold text-theme-text">
                  ${stats.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 glass rounded-lg">
                <span className="text-sm text-theme-muted">Sales Records</span>
                <span className="text-lg font-semibold text-theme-text">{stats.salesCount}</span>
              </div>
              <div className="flex items-center justify-between p-3 glass rounded-lg">
                <span className="text-sm text-theme-muted">Uploads</span>
                <span className="text-lg font-semibold text-theme-text">{stats.uploadCount}</span>
              </div>
              <div className="flex items-center justify-between p-3 glass rounded-lg">
                <span className="text-sm text-theme-muted">Accounts</span>
                <span className="text-lg font-semibold text-theme-text">{stats.accountCount}</span>
              </div>
              <div className="flex items-center justify-between p-3 glass rounded-lg">
                <span className="text-sm text-theme-muted">Products</span>
                <span className="text-lg font-semibold text-theme-text">{stats.productCount}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-text mb-2">
              Deletion Reason (Optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this brand being deleted?"
              rows={3}
              className="w-full px-4 py-2.5 glass rounded-xl text-theme-text placeholder:text-theme-muted/60 focus-ring resize-none"
              disabled={loading}
            />
            <p className="text-xs text-theme-muted mt-1.5">
              This will be recorded in the audit log
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-text mb-2">
              Type the brand name to confirm <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={brandName}
              className={`w-full px-4 py-2.5 glass rounded-xl text-theme-text placeholder:text-theme-muted/60 focus-ring ${
                confirmName && !isConfirmValid ? 'border-red-500' : ''
              }`}
              disabled={loading}
            />
            {confirmName && !isConfirmValid && (
              <p className="text-xs text-red-500 mt-1.5">Brand name does not match</p>
            )}
          </div>

          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Soft Delete:</strong> The brand will be hidden from normal views but all data remains in the database.
              You can restore this brand at any time from the deleted brands list.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 glass hover:bg-white/10 text-theme-text rounded-xl font-semibold transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !isConfirmValid}
              className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {loading ? 'Deleting...' : 'Delete Brand'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
