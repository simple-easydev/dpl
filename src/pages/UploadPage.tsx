import { useEffect, useState } from 'react';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import FileUpload from '../components/FileUpload';
import MissingDatesEditor from '../components/MissingDatesEditor';
import ProductDuplicateReviewModal from '../components/ProductDuplicateReviewModal';
import BulkDateAssignmentModal from '../components/BulkDateAssignmentModal';
import ReprocessConfirmationModal from '../components/ReprocessConfirmationModal';
import { Clock, CheckCircle, XCircle, FileText, AlertTriangle, Edit, GitMerge, Calendar, RefreshCw, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { reprocessUpload } from '../lib/reprocessingService';
import { deleteUpload } from '../lib/uploadDeletionService';
import DeleteUploadModal from '../components/DeleteUploadModal';

interface Upload {
  id: string;
  filename: string;
  file_size: number;
  status: 'processing' | 'completed' | 'failed' | 'needs_review' | 'needs_product_review';
  row_count: number | null;
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
  distributor_id: string | null;
  file_path: string | null;
  is_reprocessable: boolean;
  reprocessed_count: number;
  column_mapping: {
    _confidence?: number;
    _method?: string;
    _details?: any;
    _missing_dates?: boolean;
    _records_missing_dates?: number;
    _duplicate_detection?: {
      auto_merged: number;
      needs_review: number;
      previously_mapped: number;
    };
    _parsing_warnings?: {
      totalRowsInFile: number;
      successfullyParsed: number;
      skippedRows: number;
      errors: Array<{ row: number; message: string; data?: any }>;
      repairAttempted?: boolean;
      repairSuccessful?: boolean;
    };
    [key: string]: any;
  } | null;
}

function getConfidence(upload: Upload): number | null {
  return upload.column_mapping?._confidence ?? null;
}

function getMethod(upload: Upload): string | null {
  return upload.column_mapping?._method ?? null;
}

function hasMissingDates(upload: Upload): boolean {
  return upload.column_mapping?._missing_dates === true;
}

function getMissingDatesCount(upload: Upload): number {
  return upload.column_mapping?._records_missing_dates ?? 0;
}

function getParsingWarnings(upload: Upload) {
  return upload.column_mapping?._parsing_warnings;
}

interface Distributor {
  id: string;
  name: string;
  state: string | null;
}

export default function UploadPage() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [distributors, setDistributors] = useState<Record<string, Distributor>>({});
  const [loading, setLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isDuplicateReviewOpen, setIsDuplicateReviewOpen] = useState(false);
  const [isBulkDateModalOpen, setIsBulkDateModalOpen] = useState(false);
  const [isReprocessModalOpen, setIsReprocessModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedUploadId, setSelectedUploadId] = useState<string | undefined>();
  const [selectedUpload, setSelectedUpload] = useState<Upload | null>(null);
  const [reprocessing, setReprocessing] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<string | null>(null);
  const [totalMissingDates, setTotalMissingDates] = useState(0);

  const fetchUploads = async () => {
    if (!currentOrganization) return;

    const { data, error } = await supabase
      .from('uploads')
      .select('*')
      .eq('organization_id', currentOrganization.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setUploads(data);

      const uniqueDistributorIds = [...new Set(data.map(u => u.distributor_id).filter(Boolean))];
      if (uniqueDistributorIds.length > 0) {
        const { data: distributorData } = await supabase
          .from('distributors')
          .select('id, name, state')
          .in('id', uniqueDistributorIds);

        if (distributorData) {
          const distributorMap: Record<string, Distributor> = {};
          distributorData.forEach(d => {
            distributorMap[d.id] = d;
          });
          setDistributors(distributorMap);
        }
      }
    }

    // Check for total records missing dates
    const { count: missingCount } = await supabase
      .from('sales_data')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', currentOrganization.id)
      .is('order_date', null)
      .is('default_period', null);

    setTotalMissingDates(missingCount || 0);
    setLoading(false);
  };

  useEffect(() => {
    fetchUploads();
  }, [currentOrganization]);

  const handleOpenEditor = (uploadId?: string) => {
    setSelectedUploadId(uploadId);
    setIsEditorOpen(true);
  };

  const handleOpenDuplicateReview = (uploadId: string) => {
    setSelectedUploadId(uploadId);
    setIsDuplicateReviewOpen(true);
  };

  const handleEditorSuccess = () => {
    fetchUploads();
  };

  const handleDuplicateReviewComplete = () => {
    fetchUploads();
  };

  const handleOpenReprocessModal = (upload: Upload) => {
    setSelectedUpload(upload);
    setIsReprocessModalOpen(true);
  };

  const handleConfirmReprocess = async () => {
    if (!selectedUpload || !currentOrganization || !user) return;

    setIsReprocessModalOpen(false);
    setReprocessing(prev => new Set(prev).add(selectedUpload.id));

    try {
      const result = await reprocessUpload(
        selectedUpload.id,
        currentOrganization.id,
        user.id
      );

      if (result.success) {
        await fetchUploads();
      } else {
        console.error('Reprocessing failed:', result.error);
      }
    } catch (error) {
      console.error('Error reprocessing upload:', error);
    } finally {
      setReprocessing(prev => {
        const newSet = new Set(prev);
        newSet.delete(selectedUpload.id);
        return newSet;
      });
      setSelectedUpload(null);
    }
  };

  const handleOpenDeleteModal = (upload: Upload) => {
    setSelectedUpload(upload);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedUpload || !currentOrganization) return;

    setDeleting(selectedUpload.id);

    try {
      const result = await deleteUpload(
        selectedUpload.id,
        currentOrganization.id
      );

      if (result.success) {
        await fetchUploads();
        setIsDeleteModalOpen(false);
        setSelectedUpload(null);
      } else {
        console.error('Delete failed:', result.error);
        alert(result.error || 'Failed to delete upload');
      }
    } catch (error) {
      console.error('Error deleting upload:', error);
      alert('An unexpected error occurred while deleting the upload');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-2">Upload Data</h1>
      <p className="text-gray-600 dark:text-zinc-400 mb-6">
        Upload your sales data files (CSV, Excel) to import transactions.
      </p>

      <div className="mb-8">
        <FileUpload onUploadComplete={fetchUploads} />
      </div>

      {totalMissingDates > 0 && (
        <div className="mb-6 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-2 border-red-200 dark:border-red-700 rounded-xl p-4 shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="bg-red-500 rounded-lg p-2 shadow-lg">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-red-900 dark:text-red-300 mb-1">
                  Data Not Appearing in Dashboard
                </h3>
                <p className="text-sm text-red-800 dark:text-red-400 mb-2">
                  <strong>{totalMissingDates} records</strong> are missing dates and won't appear in your analytics, charts, or reports.
                </p>
                <p className="text-xs text-red-700 dark:text-red-500">
                  Records without dates cannot be placed in monthly reports or timeline views.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsBulkDateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition shadow-lg whitespace-nowrap"
            >
              <Calendar className="w-4 h-4" />
              Assign Dates
            </button>
          </div>
        </div>
      )}

      <div className="glass-card rounded-2xl glow-hover-blue">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Upload History</h2>
        </div>

        {loading ? (
          <div className="p-8 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
          </div>
        ) : uploads.length === 0 ? (
          <div className="p-8 text-center text-gray-600 dark:text-zinc-400">
            No uploads yet. Upload your first file to get started.
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-white/10">
            {uploads.map((upload) => (
              <div key={upload.id} className="p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 transition">
                <div className="flex items-center gap-4">
                  <div className={`rounded-xl p-2.5 ${
                    upload.status === 'completed' ? 'bg-gradient-teal shadow-glow-teal' :
                    upload.status === 'needs_product_review' ? 'bg-gradient-to-br from-purple-500 to-indigo-600' :
                    upload.status === 'needs_review' ? 'bg-gradient-to-br from-yellow-500 to-amber-600' :
                    upload.status === 'failed' ? 'bg-gradient-orange' :
                    'bg-gradient-blue shadow-glow-blue'
                  }`}>
                    {upload.status === 'completed' ? (
                      <CheckCircle className="w-5 h-5 text-white" />
                    ) : upload.status === 'needs_product_review' ? (
                      <GitMerge className="w-5 h-5 text-white" />
                    ) : upload.status === 'needs_review' ? (
                      <AlertTriangle className="w-5 h-5 text-white" />
                    ) : upload.status === 'failed' ? (
                      <XCircle className="w-5 h-5 text-white" />
                    ) : (
                      <Clock className="w-5 h-5 text-white" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400 dark:text-zinc-400" />
                      <span className="font-semibold text-gray-900 dark:text-white">{upload.filename}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-600 dark:text-zinc-400">
                      <span>{(upload.file_size / 1024).toFixed(1)} KB</span>
                      {upload.row_count !== null && (
                        <span>{upload.row_count} rows processed</span>
                      )}
                      <span>{format(new Date(upload.created_at), 'MMM dd, yyyy HH:mm')}</span>
                      {(() => {
                        const confidence = getConfidence(upload);
                        return confidence !== null && (
                          <span className={`font-medium ${confidence >= 0.8 ? 'text-green-600 dark:text-accent-teal-400' : confidence >= 0.5 ? 'text-yellow-600 dark:text-yellow-400' : 'text-orange-600 dark:text-accent-orange-400'}`}>
                            {(confidence * 100).toFixed(0)}% confidence
                          </span>
                        );
                      })()}
                      {(() => {
                        const method = getMethod(upload);
                        return method && (
                          <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded">
                            {method}
                          </span>
                        );
                      })()}
                    </div>
                    {upload.distributor_id && distributors[upload.distributor_id] && (
                      <div className="mt-1 text-sm text-gray-600 dark:text-zinc-400">
                        Distributor: <span className="font-medium text-gray-900 dark:text-white">{distributors[upload.distributor_id].name}</span>
                        {distributors[upload.distributor_id].state && (
                          <span className="text-gray-500 dark:text-zinc-500"> ({distributors[upload.distributor_id].state})</span>
                        )}
                      </div>
                    )}
                    {upload.status === 'needs_product_review' && (
                      <div className="mt-2 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm text-purple-800 dark:text-purple-400">
                              <span className="font-semibold">Action Required:</span> Potential duplicate products detected.
                            </p>
                            {upload.column_mapping?._duplicate_detection && (
                              <p className="text-xs text-purple-700 dark:text-purple-500 mt-1">
                                {upload.column_mapping._duplicate_detection.auto_merged > 0 &&
                                  `${upload.column_mapping._duplicate_detection.auto_merged} auto-merged, `}
                                {upload.column_mapping._duplicate_detection.needs_review} need review
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleOpenDuplicateReview(upload.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition whitespace-nowrap"
                          >
                            <GitMerge className="w-3.5 h-3.5" />
                            Review Products
                          </button>
                        </div>
                      </div>
                    )}
                    {upload.status === 'needs_review' && hasMissingDates(upload) && (
                      <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm text-yellow-800 dark:text-yellow-400">
                            <span className="font-semibold">Action Required:</span> {getMissingDatesCount(upload)} record(s) missing dates.
                            Data will not appear in analytics until dates are added.
                          </p>
                          <button
                            onClick={() => handleOpenEditor(upload.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-semibold transition whitespace-nowrap"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            Add Dates
                          </button>
                        </div>
                      </div>
                    )}
                    {upload.error_message && upload.status !== 'needs_review' && upload.status !== 'needs_product_review' && (
                      <p className="text-sm text-accent-orange-400 mt-1">{upload.error_message}</p>
                    )}
                    {(() => {
                      const warnings = getParsingWarnings(upload);
                      return warnings && warnings.skippedRows > 0 && (
                        <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                          <p className="text-sm text-amber-800 dark:text-amber-400">
                            <span className="font-semibold">Parsing Warning:</span> {warnings.skippedRows} of {warnings.totalRowsInFile} rows were skipped due to formatting issues. Successfully parsed: {warnings.successfullyParsed} rows.
                          </p>
                          {warnings.repairAttempted && (
                            <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">
                              {warnings.repairSuccessful
                                ? '✓ OpenAI successfully repaired CSV formatting'
                                : 'OpenAI repair was attempted'}
                            </p>
                          )}
                          {warnings.errors && warnings.errors.length > 0 && (
                            <details className="mt-2">
                              <summary className="text-xs font-medium text-amber-800 dark:text-amber-400 cursor-pointer hover:underline">
                                View {warnings.errors.length} error(s)
                              </summary>
                              <div className="mt-1 space-y-0.5 text-xs text-amber-700 dark:text-amber-500 max-h-32 overflow-y-auto">
                                {warnings.errors.map((err: any, idx: number) => (
                                  <div key={idx} className="pl-2 border-l-2 border-amber-300 dark:border-amber-600">
                                    Row {err.row}: {err.message}
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {upload.is_reprocessable && upload.status !== 'processing' && (
                    <button
                      onClick={() => handleOpenReprocessModal(upload)}
                      disabled={reprocessing.has(upload.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition"
                      title="Reprocess this upload with current AI configuration"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${reprocessing.has(upload.id) ? 'animate-spin' : ''}`} />
                      {reprocessing.has(upload.id) ? 'Processing...' : 'Read Data'}
                    </button>
                  )}
                  {upload.status !== 'processing' && (
                    <button
                      onClick={() => handleOpenDeleteModal(upload)}
                      disabled={deleting === upload.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition"
                      title="Delete this upload and all associated data"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                    upload.status === 'completed' ? 'bg-accent-teal-400/20 text-accent-teal-400' :
                    upload.status === 'needs_product_review' ? 'bg-purple-400/20 text-purple-600 dark:text-purple-400' :
                    upload.status === 'needs_review' ? 'bg-yellow-400/20 text-yellow-600 dark:text-yellow-400' :
                    upload.status === 'failed' ? 'bg-accent-orange-400/20 text-accent-orange-400' :
                    'bg-accent-blue-400/20 text-accent-blue-400'
                  }`}>
                    {upload.status === 'needs_product_review' ? 'Needs Product Review' :
                     upload.status === 'needs_review' ? 'Needs Review' :
                     upload.status.charAt(0).toUpperCase() + upload.status.slice(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <MissingDatesEditor
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSuccess={handleEditorSuccess}
        uploadId={selectedUploadId}
      />

      {selectedUploadId && currentOrganization && (
        <ProductDuplicateReviewModal
          isOpen={isDuplicateReviewOpen}
          onClose={() => setIsDuplicateReviewOpen(false)}
          uploadId={selectedUploadId}
          organizationId={currentOrganization.id}
          onReviewComplete={handleDuplicateReviewComplete}
        />
      )}

      <BulkDateAssignmentModal
        isOpen={isBulkDateModalOpen}
        onClose={() => setIsBulkDateModalOpen(false)}
        onSuccess={fetchUploads}
      />

      {selectedUpload && currentOrganization && (
        <ReprocessConfirmationModal
          isOpen={isReprocessModalOpen}
          onClose={() => setIsReprocessModalOpen(false)}
          onConfirm={handleConfirmReprocess}
          uploadId={selectedUpload.id}
          filename={selectedUpload.filename}
          distributorId={selectedUpload.distributor_id || ''}
          organizationId={currentOrganization.id}
        />
      )}

      {selectedUpload && (
        <DeleteUploadModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setSelectedUpload(null);
          }}
          onConfirm={handleConfirmDelete}
          filename={selectedUpload.filename}
          rowCount={selectedUpload.row_count}
          isDeleting={deleting === selectedUpload.id}
        />
      )}
    </div>
  );
}
