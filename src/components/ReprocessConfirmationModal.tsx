import { X, AlertTriangle, FileText, Database, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface ReprocessConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  uploadId: string;
  filename: string;
  distributorId: string;
  organizationId: string;
}

export default function ReprocessConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  uploadId,
  filename,
  distributorId,
  organizationId,
}: ReprocessConfirmationModalProps) {
  const [recordCount, setRecordCount] = useState<number | null>(null);
  const [aiConfig, setAiConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, uploadId, distributorId]);

  const fetchData = async () => {
    setLoading(true);

    const { count } = await supabase
      .from('sales_data')
      .select('id', { count: 'exact', head: true })
      .eq('upload_id', uploadId);

    setRecordCount(count || 0);

    const { data: config } = await supabase
      .from('ai_training_configurations')
      .select('*')
      .eq('distributor_id', distributorId)
      .eq('is_active', true)
      .maybeSingle();

    setAiConfig(config);
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-lg w-full border border-gray-200 dark:border-white/10">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-white/10">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-500" />
            Reprocess Upload Data
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-yellow-900 dark:text-yellow-300 mb-1">
                Warning: Data Replacement
              </p>
              <p className="text-sm text-yellow-800 dark:text-yellow-400">
                This will delete existing data and reprocess the file with the current AI training configuration.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-white/5 rounded-lg">
              <FileText className="w-5 h-5 text-gray-400" />
              <div className="flex-1">
                <p className="text-xs text-gray-500 dark:text-zinc-400">File</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{filename}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-white/5 rounded-lg">
              <Database className="w-5 h-5 text-gray-400" />
              <div className="flex-1">
                <p className="text-xs text-gray-500 dark:text-zinc-400">Current Records</p>
                {loading ? (
                  <div className="h-5 w-16 bg-gray-200 dark:bg-zinc-700 animate-pulse rounded"></div>
                ) : (
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {recordCount} sales records
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-white/5 rounded-lg">
              <Sparkles className="w-5 h-5 text-gray-400" />
              <div className="flex-1">
                <p className="text-xs text-gray-500 dark:text-zinc-400">AI Configuration</p>
                {loading ? (
                  <div className="h-5 w-32 bg-gray-200 dark:bg-zinc-700 animate-pulse rounded"></div>
                ) : aiConfig ? (
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {aiConfig.configuration_name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                      {aiConfig.success_count || 0} successful extractions
                    </p>
                  </div>
                ) : (
                  <p className="text-sm font-medium text-gray-600 dark:text-zinc-400">
                    Generic extraction (no custom config)
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="pt-2">
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              The file will be reprocessed with the latest AI training configuration.
              {aiConfig ? ' This may result in improved data extraction accuracy.' : ' Consider creating an AI training configuration for better results.'}
            </p>
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-white/10">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-white/10 text-gray-700 dark:text-zinc-300 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-gradient-blue text-white rounded-lg hover:opacity-90 transition font-medium shadow-glow-blue disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Loading...' : 'Reprocess Data'}
          </button>
        </div>
      </div>
    </div>
  );
}
