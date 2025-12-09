import { useState, useEffect } from 'react';
import { X, Calendar, Save, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';
import { format } from 'date-fns';
import { parseDate } from '../lib/fileParser';

interface MissingDatesEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  uploadId?: string;
}

interface RecordWithMissingDate {
  id: string;
  account_name: string;
  product_name: string;
  quantity: number | null;
  revenue: number | null;
  distributor: string | null;
  representative: string | null;
  upload_id: string;
}

export default function MissingDatesEditor({ isOpen, onClose, onSuccess, uploadId }: MissingDatesEditorProps) {
  const { currentOrganization } = useOrganization();
  const [records, setRecords] = useState<RecordWithMissingDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dates, setDates] = useState<Record<string, string>>({});
  const [bulkDate, setBulkDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen && currentOrganization) {
      fetchRecordsWithMissingDates();
    }
  }, [isOpen, currentOrganization, uploadId]);

  const fetchRecordsWithMissingDates = async () => {
    if (!currentOrganization) return;
    setLoading(true);
    setError(null);

    let query = supabase
      .from('sales_data')
      .select('id, account_name, product_name, quantity, revenue, distributor, representative, upload_id')
      .eq('organization_id', currentOrganization.id)
      .is('order_date', null)
      .order('created_at', { ascending: false });

    if (uploadId) {
      query = query.eq('upload_id', uploadId);
    }

    const { data, error: fetchError } = await query.limit(100);

    if (fetchError) {
      setError(fetchError.message);
    } else if (data) {
      setRecords(data);
      const allRecordIds = new Set(data.map(r => r.id));
      setSelectedRecords(allRecordIds);
    }

    setLoading(false);
  };

  const handleDateChange = (recordId: string, date: string) => {
    setDates(prev => ({ ...prev, [recordId]: date }));
  };

  const handleApplyBulkDate = () => {
    const newDates: Record<string, string> = {};
    selectedRecords.forEach(recordId => {
      newDates[recordId] = bulkDate;
    });
    setDates(prev => ({ ...prev, ...newDates }));
  };

  const handleToggleRecord = (recordId: string) => {
    setSelectedRecords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(recordId)) {
        newSet.delete(recordId);
      } else {
        newSet.add(recordId);
      }
      return newSet;
    });
  };

  const handleToggleAll = () => {
    if (selectedRecords.size === records.length) {
      setSelectedRecords(new Set());
    } else {
      setSelectedRecords(new Set(records.map(r => r.id)));
    }
  };

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    const updates = records
      .filter(record => dates[record.id])
      .map(record => {
        // Parse the date and normalize to first day of month (month-only granularity)
        const parsedDate = parseDate(dates[record.id]);
        const normalizedDate = parsedDate ? parsedDate.toISOString().split('T')[0] : dates[record.id];

        return {
          id: record.id,
          order_date: normalizedDate,
        };
      });

    if (updates.length === 0) {
      setError('Please set dates for at least one record');
      setSaving(false);
      return;
    }

    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('sales_data')
        .update({ order_date: update.order_date })
        .eq('id', update.id);

      if (updateError) {
        setError(`Failed to update record: ${updateError.message}`);
        setSaving(false);
        return;
      }
    }

    if (uploadId) {
      const { data: remainingRecords } = await supabase
        .from('sales_data')
        .select('id')
        .eq('upload_id', uploadId)
        .is('order_date', null);

      if (!remainingRecords || remainingRecords.length === 0) {
        await supabase
          .from('uploads')
          .update({
            status: 'completed',
            error_message: null,
          })
          .eq('id', uploadId);
      }
    }

    setSaving(false);
    onSuccess();
    onClose();
  };

  const handleClose = () => {
    setDates({});
    setSelectedRecords(new Set());
    setBulkDate(format(new Date(), 'yyyy-MM-dd'));
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="relative glass-card rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="sticky top-0 glass-card rounded-t-2xl border-b border-gray-200 dark:border-white/10 p-6 flex justify-between items-center z-10">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-yellow-500" />
              Add Missing Dates
            </h2>
            <p className="text-sm text-gray-600 dark:text-zinc-400 mt-1">
              {records.length} record(s) need dates before appearing in analytics
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-zinc-400" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-12 text-gray-600 dark:text-zinc-400">
              No records with missing dates found.
            </div>
          ) : (
            <>
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Apply Date to Selected Records
                </h3>
                <div className="flex items-center gap-3">
                  <input
                    type="date"
                    value={bulkDate}
                    onChange={(e) => setBulkDate(e.target.value)}
                    className="px-4 py-2 glass rounded-xl text-gray-900 dark:text-white focus-ring"
                  />
                  <button
                    onClick={handleApplyBulkDate}
                    disabled={selectedRecords.size === 0}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Apply to {selectedRecords.size} Selected
                  </button>
                  <button
                    onClick={handleToggleAll}
                    className="px-4 py-2 glass hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition font-semibold text-gray-700 dark:text-zinc-300"
                  >
                    {selectedRecords.size === records.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {records.map((record) => (
                  <div
                    key={record.id}
                    className={`p-4 glass rounded-xl border transition ${
                      selectedRecords.has(record.id)
                        ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/10'
                        : 'border-gray-200 dark:border-white/10'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        checked={selectedRecords.has(record.id)}
                        onChange={() => handleToggleRecord(record.id)}
                        className="mt-1.5 w-4 h-4 rounded border-gray-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">
                            {record.account_name}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-zinc-400 mt-1">
                            Product: {record.product_name}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 dark:text-zinc-500">
                            {record.quantity && <span>Qty: {record.quantity}</span>}
                            {record.revenue && <span>Revenue: ${record.revenue.toFixed(2)}</span>}
                            {record.distributor && <span>{record.distributor}</span>}
                          </div>
                        </div>
                        <div className="flex items-center">
                          <input
                            type="date"
                            value={dates[record.id] || ''}
                            onChange={(e) => handleDateChange(record.id, e.target.value)}
                            className="w-full px-3 py-2 glass rounded-xl text-gray-900 dark:text-white focus-ring"
                            placeholder="Select date"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="sticky bottom-0 glass-card rounded-b-2xl border-t border-gray-200 dark:border-white/10 p-6 flex justify-between items-center z-10">
          <div className="text-sm text-gray-600 dark:text-zinc-400">
            {Object.keys(dates).length} of {records.length} records have dates set
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="px-6 py-2.5 glass rounded-xl text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/10 transition font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || Object.keys(dates).length === 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/50 transition-all duration-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Dates
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
