import { useState, useEffect } from 'react';
import { X, Calendar, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';

interface BulkDateAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BulkDateAssignmentModal({ isOpen, onClose, onSuccess }: BulkDateAssignmentModalProps) {
  const { currentOrganization } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [missingDatesCount, setMissingDatesCount] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen && currentOrganization) {
      fetchMissingDatesCount();
      setDefaultMonth();
    }
  }, [isOpen, currentOrganization]);

  const setDefaultMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${year}-${month}`);
  };

  const fetchMissingDatesCount = async () => {
    if (!currentOrganization) return;

    const { count, error } = await supabase
      .from('sales_data')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', currentOrganization.id)
      .is('order_date', null)
      .is('default_period', null);

    if (error) {
      console.error('Error fetching missing dates count:', error);
      setMissingDatesCount(0);
    } else {
      setMissingDatesCount(count || 0);
    }
  };

  const handleAssignDates = async () => {
    if (!currentOrganization || !selectedMonth) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Update all records without dates to use the selected month as default_period
      const { error: updateError } = await supabase
        .from('sales_data')
        .update({ default_period: selectedMonth })
        .eq('organization_id', currentOrganization.id)
        .is('order_date', null)
        .is('default_period', null);

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Error assigning dates:', err);
      setError(err instanceof Error ? err.message : 'Failed to assign dates');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-2">
              <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Assign Dates to Records
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800 dark:text-yellow-300">
                <p className="font-semibold mb-1">Records without dates won't appear in analytics</p>
                <p>
                  Found <strong>{missingDatesCount}</strong> records missing dates.
                  These records will not appear in your Dashboard or reports until they have a date assigned.
                </p>
              </div>
            </div>
          </div>

          {missingDatesCount > 0 ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Assign Default Period
                </label>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                  All records without dates will be assigned to this month for analytics purposes.
                </p>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3">
                  <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                </div>
              )}

              {success && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-green-800 dark:text-green-300">
                    <CheckCircle className="w-4 h-4" />
                    <p className="text-sm font-semibold">Successfully assigned dates to {missingDatesCount} records!</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignDates}
                  disabled={loading || !selectedMonth || success}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition disabled:opacity-50"
                >
                  {loading ? 'Assigning...' : `Assign to ${missingDatesCount} Records`}
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                All Records Have Dates!
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                No action needed. All your records are properly dated.
              </p>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
