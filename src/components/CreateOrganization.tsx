import { useState } from 'react';
import { Building2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface CreateOrganizationProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function CreateOrganization({ onSuccess, onCancel }: CreateOrganizationProps) {
  const { user } = useAuth();
  const [organizationName, setOrganizationName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError('You must be logged in to create an organization');
      return;
    }

    if (!organizationName.trim()) {
      setError('Organization name is required');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const { data, error } = await supabase
        .rpc('create_organization_with_owner', {
          org_name: organizationName.trim()
        });

      if (error) {
        console.error('Organization creation error:', error);
        setError(`Failed to create organization: ${error.message}`);
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setError('Failed to create organization');
        setLoading(false);
        return;
      }

      onSuccess();
    } catch (err) {
      console.error('Unexpected error creating organization:', err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 max-w-md w-full">
        <div className="flex items-center justify-center mb-6">
          <div className="bg-blue-100 rounded-lg p-3">
            <Building2 className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-slate-900 mb-2 text-center">
          Create Organization
        </h2>
        <p className="text-slate-600 mb-6 text-center">
          Set up your organization to get started with sales analytics
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="orgName" className="block text-sm font-medium text-slate-700 mb-1.5">
              Organization Name
            </label>
            <input
              id="orgName"
              type="text"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              required
              placeholder="Acme Inc."
              disabled={loading}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Organization'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
