import { useState } from 'react';
import { X, Building2, Mail, Lock, AlertCircle } from 'lucide-react';
import { createBrandWithAdmin } from '../lib/platformAdminService';

interface CreateBrandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (organizationId: string) => void;
}

export default function CreateBrandModal({ isOpen, onClose, onSuccess }: CreateBrandModalProps) {
  const [brandName, setBrandName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (adminPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    const { data, error: createError } = await createBrandWithAdmin({
      brandName,
      adminEmail,
      adminPassword,
    });

    if (createError) {
      setError(createError.message || 'Failed to create brand');
      setLoading(false);
    } else if (data) {
      setBrandName('');
      setAdminEmail('');
      setAdminPassword('');
      onSuccess(data.organizationId);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setBrandName('');
      setAdminEmail('');
      setAdminPassword('');
      setError(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b table-border flex items-center justify-between sticky top-0 glass-card z-10">
          <div className="flex items-center gap-3">
            <div className="rounded-xl p-2 bg-gradient-blue shadow-glow-blue">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-theme-text">Create New Brand</h2>
              <p className="text-sm text-theme-muted">Manually create a brand with admin user</p>
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
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-theme-text mb-2">
                Brand Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                required
                placeholder="Acme Corporation"
                className="w-full px-4 py-2.5 glass rounded-xl text-theme-text placeholder:text-theme-muted/60 focus-ring"
                disabled={loading}
              />
              <p className="text-xs text-theme-muted mt-1.5">
                The official name of the brand or company
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-theme-text mb-2">
                Admin Email <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-theme-muted w-5 h-5" />
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  required
                  placeholder="admin@company.com"
                  className="w-full pl-10 pr-4 py-2.5 glass rounded-xl text-theme-text placeholder:text-theme-muted/60 focus-ring"
                  disabled={loading}
                />
              </div>
              <p className="text-xs text-theme-muted mt-1.5">
                This person will be the organization admin
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-theme-text mb-2">
                Admin Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-theme-muted w-5 h-5" />
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required
                  placeholder="Minimum 6 characters"
                  minLength={6}
                  className="w-full pl-10 pr-4 py-2.5 glass rounded-xl text-theme-text placeholder:text-theme-muted/60 focus-ring"
                  disabled={loading}
                />
              </div>
              <p className="text-xs text-theme-muted mt-1.5">
                Initial password for the admin user (minimum 6 characters)
              </p>
            </div>
          </div>

          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Note:</strong> The admin user will be created automatically and will have full
              access to manage the brand. Make sure to provide them with their credentials securely.
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
              disabled={loading || !brandName || !adminEmail || !adminPassword}
              className="flex-1 btn-primary disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Brand'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
