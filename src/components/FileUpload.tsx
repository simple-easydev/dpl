import { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';
import { parseFile, extractPeriodFromFilename } from '../lib/fileParser';
import { processAndStoreSalesData } from '../lib/dataProcessor';
import { detectColumnMappingEnhanced } from '../lib/columnDetection';
import { supabase } from '../lib/supabase';
import ColumnMappingPreview from './ColumnMappingPreview';
import DatePeriodSelector from './DatePeriodSelector';

interface Distributor {
  id: string;
  name: string;
  state: string | null;
  active: boolean | null;
}

interface FileUploadProps {
  onUploadComplete?: () => void;
}

export default function FileUpload({ onUploadComplete }: FileUploadProps) {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [selectedDistributor, setSelectedDistributor] = useState<string>('');
  const [loadingDistributors, setLoadingDistributors] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<{
    file: File;
    rows: any[];
    headers: string[];
    mapping: any;
    confidence: number;
    method: string;
    aiConfigName?: string;
    parsingWarnings?: any;
  } | null>(null);
  const [showDateSelector, setShowDateSelector] = useState(false);
  const [pendingData, setPendingData] = useState<{
    mapping: any;
    rows: any[];
    filename: string;
    fileSize: number;
    unitType?: 'cases' | 'bottles';
    suggestedPeriod?: string | null;
  } | null>(null);

  useEffect(() => {
    const fetchDistributors = async () => {
      if (!currentOrganization) return;

      // Fetch added global distributors via junction table
      const { data: addedGlobalData } = await supabase
        .from('organization_distributors')
        .select('distributor_id, state, distributors(id, name, state, active)')
        .eq('organization_id', currentOrganization.id);

      // Fetch organization-specific custom distributors
      const { data: customData } = await supabase
        .from('distributors')
        .select('id, name, state, active')
        .eq('organization_id', currentOrganization.id)
        .eq('is_global', false)
        .eq('active', true)
        .order('name', { ascending: true });

      const distributorMap = new Map<string, Distributor>();

      // Add custom distributors
      (customData || []).forEach(dist => {
        distributorMap.set(dist.id, dist);
      });

      // Add added global distributors with org-specific state if available
      (addedGlobalData || []).forEach(item => {
        if (item.distributors) {
          const dist = item.distributors as any;
          if (dist.active) {
            distributorMap.set(dist.id, {
              id: dist.id,
              name: dist.name,
              state: item.state || dist.state,
              active: dist.active,
            });
          }
        }
      });

      setDistributors(Array.from(distributorMap.values()).sort((a, b) => {
        const stateCompare = (a.state || '').localeCompare(b.state || '');
        if (stateCompare !== 0) return stateCompare;
        return a.name.localeCompare(b.name);
      }));
      setLoadingDistributors(false);
    };

    fetchDistributors();
  }, [currentOrganization]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!currentOrganization || !user) {
      setError('Please select an organization first');
      return;
    }

    if (!selectedDistributor) {
      setError('Please select a distributor before uploading');
      return;
    }

    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setUploading(true);
    setError(null);
    setSuccess(false);
    setProgress('Reading file...');

    try {
      const isPDF = file.name.toLowerCase().endsWith('.pdf');

      if (isPDF) {
        setProgress('Extracting data from PDF...');

        const result = await processAndStoreSalesData({
          organizationId: currentOrganization.id,
          userId: user.id,
          filename: file.name,
          fileSize: file.size,
          pdfFile: file,
          distributorId: selectedDistributor,
        });

        const successRate = ((result.successRate || 1) * 100).toFixed(1);
        const confidenceInfo = result.confidence ? ` • Confidence: ${(result.confidence * 100).toFixed(0)}%` : '';

        setProgress(`✓ Extracted ${result.rowsProcessed} records from PDF (${successRate}% success rate${confidenceInfo})`);
        setSuccess(true);
        setUploading(false);

        if (onUploadComplete) {
          setTimeout(() => {
            onUploadComplete();
          }, 1500);
        }
      } else {
        const parseResult = await parseFile(file);
        const { rows, headers, parsingWarnings } = parseResult;

        console.log('📄 File parsed successfully:');
        console.log('  - Rows:', rows.length);
        console.log('  - Headers:', headers);
        console.log('  - Headers length:', headers.length);

        if (!headers || headers.length === 0) {
          throw new Error(
            'No column headers found in file.\n\n' +
            'Please ensure your CSV file has a header row with column names.'
          );
        }

        if (rows.length === 0) {
          throw new Error('File contains no data');
        }

        if (parsingWarnings && parsingWarnings.skippedRows > 0) {
          console.warn(`⚠️ Parsing warnings: ${parsingWarnings.skippedRows} rows skipped`);
          setProgress(`File parsed with warnings: ${parsingWarnings.skippedRows} row(s) skipped`);
        }

        setProgress(`Detecting columns...`);

        // Fetch the active AI training configuration for this distributor (there's only one)
        const { data: aiConfig } = await supabase
          .from('ai_training_configurations')
          .select('*')
          .eq('distributor_id', selectedDistributor)
          .eq('is_active', true)
          .maybeSingle();

        const aiTrainingConfig = aiConfig ? {
          field_mappings: aiConfig.field_mappings as Record<string, any>,
          parsing_instructions: aiConfig.parsing_instructions || undefined,
          orientation: aiConfig.orientation || undefined,
        } : undefined;

        const detectionResult = await detectColumnMappingEnhanced(
          rows,
          currentOrganization.id,
          selectedDistributor,
          file.name,
          aiTrainingConfig
        );

        // Use the intelligently detected columns from the header detection module
        // instead of the parser's headers (which might be from wrong row or __EMPTY_ placeholders)
        const detectedColumns = detectionResult.columns || headers;
        
        console.log('🗒️ Detected columns from intelligent header detection:', detectedColumns);
        console.log('📊 Original parser headers:', headers);

        const previewDataToSet = {
          file,
          rows,
          headers: detectedColumns, // Use detected columns, not parser headers
          mapping: detectionResult.mapping,
          confidence: detectionResult.confidence,
          method: detectionResult.method,
          aiConfigName: aiConfig?.configuration_name,
          parsingWarnings,
        };

        console.log('👁️ Preview data prepared:', {
          headersCount: previewDataToSet.headers.length,
          rowsCount: previewDataToSet.rows.length,
          headers: previewDataToSet.headers,
        });

        setPreviewData(previewDataToSet);
        setShowPreview(true);
        setUploading(false);
      }
    } catch (err) {
      setError((err as Error).message);
      setUploading(false);
      setProgress('');
    }
  }, [currentOrganization, user, selectedDistributor, onUploadComplete]);

  const handleConfirmMapping = async (confirmedMapping: any, unitType: 'cases' | 'bottles') => {
    if (!previewData || !currentOrganization || !user) return;

    const hasDateMapping = confirmedMapping.date && confirmedMapping.date.length > 0;
    const hasMonthYearMapping = confirmedMapping.month && confirmedMapping.year;

    if (!hasDateMapping && !hasMonthYearMapping) {
      // Extract period from filename if possible
      const suggestedPeriod = extractPeriodFromFilename(previewData.file.name);

      if (suggestedPeriod) {
        console.log(`📅 Detected period from filename: ${suggestedPeriod}`);
      } else {
        console.log('⚠️ No date information found in file columns or filename');
      }

      setShowPreview(false);
      setPendingData({
        mapping: confirmedMapping,
        rows: previewData.rows,
        filename: previewData.file.name,
        fileSize: previewData.file.size,
        unitType,
        suggestedPeriod,
      });
      setShowDateSelector(true);
      return;
    }

    setShowPreview(false);
    setUploading(true);
    setProgress(`Processing ${previewData.rows.length} rows with confirmed mapping...`);

    try {
      const result = await processAndStoreSalesData({
        organizationId: currentOrganization.id,
        userId: user.id,
        filename: previewData.file.name,
        fileSize: previewData.file.size,
        rows: previewData.rows,
        distributorId: selectedDistributor,
        manualMapping: confirmedMapping,
        unitType,
        parsingWarnings: previewData.parsingWarnings,
        originalFile: previewData.file,
      });

      const successRate = ((result.successRate || 1) * 100).toFixed(1);
      const confidenceInfo = result.confidence ? ` • Confidence: ${(result.confidence * 100).toFixed(0)}%` : '';

      setProgress(`✓ Processed ${result.rowsProcessed} of ${previewData.rows.length} rows (${successRate}% success rate${confidenceInfo})`);
      setSuccess(true);
      setUploading(false);
      setPreviewData(null);

      if (onUploadComplete) {
        setTimeout(() => {
          onUploadComplete();
        }, 1500);
      }
    } catch (err) {
      setError((err as Error).message);
      setUploading(false);
      setProgress('');
      setPreviewData(null);
    }
  };

  const handleCancelPreview = () => {
    setShowPreview(false);
    setPreviewData(null);
    setProgress('');
  };

  const handleDatePeriodConfirm = async (period: string) => {
    if (!pendingData || !currentOrganization || !user) return;

    setShowDateSelector(false);
    setUploading(true);
    setProgress(`Processing ${pendingData.rows.length} rows for ${period}...`);

    try {
      const result = await processAndStoreSalesData({
        organizationId: currentOrganization.id,
        userId: user.id,
        filename: pendingData.filename,
        fileSize: pendingData.fileSize,
        rows: pendingData.rows,
        distributorId: selectedDistributor,
        manualMapping: pendingData.mapping,
        defaultPeriod: period,
        unitType: pendingData.unitType || 'cases',
        parsingWarnings: previewData?.parsingWarnings,
        originalFile: previewData?.file,
      });

      const successRate = ((result.successRate || 1) * 100).toFixed(1);
      const confidenceInfo = result.confidence ? ` • Confidence: ${(result.confidence * 100).toFixed(0)}%` : '';

      setProgress(`✓ Processed ${result.rowsProcessed} of ${pendingData.rows.length} rows for ${period} (${successRate}% success rate${confidenceInfo})`);
      setSuccess(true);
      setUploading(false);
      setPendingData(null);

      if (onUploadComplete) {
        setTimeout(() => {
          onUploadComplete();
        }, 1500);
      }
    } catch (err) {
      setError((err as Error).message);
      setUploading(false);
      setProgress('');
      setPendingData(null);
    }
  };

  const handleDatePeriodSkip = async () => {
    if (!pendingData || !currentOrganization || !user) return;

    setShowDateSelector(false);
    setUploading(true);
    setProgress(`Processing ${pendingData.rows.length} rows without default period...`);

    try {
      const result = await processAndStoreSalesData({
        organizationId: currentOrganization.id,
        userId: user.id,
        filename: pendingData.filename,
        fileSize: pendingData.fileSize,
        rows: pendingData.rows,
        distributorId: selectedDistributor,
        manualMapping: pendingData.mapping,
        defaultPeriod: null,
        unitType: pendingData.unitType || 'cases',
        parsingWarnings: previewData?.parsingWarnings,
        originalFile: previewData?.file,
      });

      const successRate = ((result.successRate || 1) * 100).toFixed(1);
      const confidenceInfo = result.confidence ? ` • Confidence: ${(result.confidence * 100).toFixed(0)}%` : '';

      setProgress(`✓ Processed ${result.rowsProcessed} of ${pendingData.rows.length} rows (${successRate}% success rate${confidenceInfo})`);
      setSuccess(true);
      setUploading(false);
      setPendingData(null);

      if (onUploadComplete) {
        setTimeout(() => {
          onUploadComplete();
        }, 1500);
      }
    } catch (err) {
      setError((err as Error).message);
      setUploading(false);
      setProgress('');
      setPendingData(null);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/pdf': ['.pdf'],
    },
    multiple: false,
    disabled: uploading || !selectedDistributor,
  });

  const groupedDistributors = distributors.reduce((acc, distributor) => {
    const state = distributor.state || 'Other';
    if (!acc[state]) {
      acc[state] = [];
    }
    acc[state].push(distributor);
    return acc;
  }, {} as Record<string, Distributor[]>);

  return (
    <div className="w-full">
      <div className="mb-6 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 p-6">
        <label className="block text-sm font-medium text-slate-700 dark:text-white mb-2">
          Select Distributor <span className="text-red-500 dark:text-red-400">*</span>
        </label>
        {loadingDistributors ? (
          <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-400">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 dark:border-accent-primary"></div>
            Loading distributors...
          </div>
        ) : distributors.length === 0 ? (
          <div className="text-sm text-slate-600 dark:text-zinc-400">
            No distributors found. Please add a distributor in the Distributors page first.
          </div>
        ) : (
          <select
            value={selectedDistributor}
            onChange={(e) => setSelectedDistributor(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white border border-slate-300 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-accent-primary focus:border-transparent outline-none"
          >
            <option value="">Choose a distributor...</option>
            {Object.entries(groupedDistributors).map(([state, stateDistributors]) => (
              <optgroup key={state} label={state}>
                {stateDistributors.map((distributor) => (
                  <option key={distributor.id} value={distributor.id}>
                    {distributor.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        )}
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2">
          All sales data from this upload will be associated with the selected distributor.
        </p>
      </div>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition cursor-pointer ${
          isDragActive
            ? 'border-blue-500 dark:border-accent-primary bg-blue-50 dark:bg-accent-primary/20'
            : 'border-slate-300 dark:border-white/10 bg-white dark:bg-zinc-900 hover:border-blue-400 dark:hover:border-accent-primary hover:bg-slate-50 dark:hover:bg-white/5'
        } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center gap-4">
          {uploading ? (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-accent-primary"></div>
              <p className="text-slate-700 dark:text-white font-medium">{progress}</p>
            </>
          ) : success ? (
            <>
              <div className="bg-green-100 dark:bg-accent-teal-400/20 rounded-full p-3">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-accent-teal-400" />
              </div>
              <p className="text-green-700 dark:text-accent-teal-400 font-medium">{progress}</p>
            </>
          ) : (
            <>
              <div className="bg-blue-100 dark:bg-accent-primary/20 rounded-full p-3">
                <Upload className="w-8 h-8 text-blue-600 dark:text-accent-primary" />
              </div>
              <div>
                <p className="text-lg font-medium text-slate-900 dark:text-white mb-1">
                  {isDragActive ? 'Drop your file here' : 'Upload Sales Data'}
                </p>
                <p className="text-sm text-slate-600 dark:text-zinc-400">
                  Drag and drop your file, or click to browse
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-zinc-400">
                  <div className="flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span>CSV / XLSX</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-red-600 dark:text-red-400" />
                    <span>PDF</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Extracts: Account, Product, Quantity (Date & Revenue optional for depletion reports)
                </p>
              </div>

              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                    <strong className="font-semibold">Caution:</strong> Only records with revenue will be read. If no revenue is reported, the system will assume it was a sample and not record it into the platform.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-900 dark:text-red-400">Upload Failed</p>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1 whitespace-pre-wrap">{error}</p>
          </div>
        </div>
      )}

      {previewData?.parsingWarnings && previewData.parsingWarnings.skippedRows > 0 && (
        <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-amber-900 dark:text-amber-400">Parsing Warnings</p>
              <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                {previewData.parsingWarnings.skippedRows} of {previewData.parsingWarnings.totalRowsInFile} rows were skipped due to formatting issues.
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-2">
                Successfully parsed: {previewData.parsingWarnings.successfullyParsed} rows
              </p>
              {previewData.parsingWarnings.repairAttempted && (
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">
                  {previewData.parsingWarnings.repairSuccessful
                    ? '✓ OpenAI successfully repaired the CSV formatting'
                    : 'Note: OpenAI repair was attempted but some issues remain'}
                </p>
              )}
              {previewData.parsingWarnings.errors && previewData.parsingWarnings.errors.length > 0 && (
                <details className="mt-3">
                  <summary className="text-xs font-medium text-amber-800 dark:text-amber-400 cursor-pointer hover:underline">
                    View error details ({previewData.parsingWarnings.errors.length} shown)
                  </summary>
                  <div className="mt-2 space-y-1 text-xs text-amber-700 dark:text-amber-500 max-h-40 overflow-y-auto">
                    {previewData.parsingWarnings.errors.map((err: any, idx: number) => (
                      <div key={idx} className="pl-3 border-l-2 border-amber-300 dark:border-amber-600">
                        Row {err.row}: {err.message}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      )}

      {showPreview && previewData && (
        <ColumnMappingPreview
          columns={previewData.headers}
          sampleRows={previewData.rows}
          detectedMapping={previewData.mapping}
          confidence={previewData.confidence}
          method={previewData.method}
          aiConfigName={previewData.aiConfigName}
          onConfirm={handleConfirmMapping}
          onCancel={handleCancelPreview}
        />
      )}

      {showDateSelector && pendingData && (
        <DatePeriodSelector
          recordCount={pendingData.rows.length}
          onConfirm={handleDatePeriodConfirm}
          onSkip={handleDatePeriodSkip}
          suggestedPeriod={pendingData.suggestedPeriod}
        />
      )}
    </div>
  );
}
