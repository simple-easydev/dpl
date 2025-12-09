import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { X, Upload, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { parseFile } from '../lib/fileParser';
import { extractTextFromPDF, cleanPDFText } from '../lib/pdfParser';
import { extractStructuredData, type AITrainingConfiguration } from '../lib/openai';
import { detectColumnMappingEnhanced } from '../lib/columnDetection';

interface TestConfigurationModalProps {
  distributorName: string;
  aiConfig: {
    configuration_name: string;
    parsing_instructions: string;
    field_mappings: Record<string, any>;
    orientation: string;
  };
  organizationId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TestConfigurationModal({
  distributorName,
  aiConfig,
  organizationId,
  onClose,
  onSuccess,
}: TestConfigurationModalProps) {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<{
    success: boolean;
    itemsExtracted: number;
    confidence: number;
    sampleData: any[];
    errors: string[];
    warnings: string[];
  } | null>(null);

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setTesting(true);
    setResults(null);

    try {
      const isPDF = file.name.toLowerCase().endsWith('.pdf');
      const aiTrainingConfig: AITrainingConfiguration = {
        field_mappings: aiConfig.field_mappings,
        parsing_instructions: aiConfig.parsing_instructions,
        orientation: aiConfig.orientation,
      };

      let extractedData: any[] = [];
      let confidence = 0;
      let errors: string[] = [];
      let warnings: string[] = [];

      if (isPDF) {
        const pdfResult = await extractTextFromPDF(file);
        const cleanedText = cleanPDFText(pdfResult.text);

        const extractionResult = await extractStructuredData(
          cleanedText,
          organizationId,
          'pdf',
          aiTrainingConfig
        );

        extractedData = extractionResult.data;
        confidence = extractionResult.confidence_score;

        if (extractedData.length === 0) {
          errors.push('No data was extracted from the PDF. The AI training instructions may need adjustment.');
        }

        const missingAccounts = extractedData.filter(item => !item.account_name || item.account_name.trim() === '').length;
        const missingProducts = extractedData.filter(item => !item.product_name || item.product_name.trim() === '').length;

        if (missingAccounts > 0) {
          warnings.push(`${missingAccounts} of ${extractedData.length} items are missing account names`);
        }
        if (missingProducts > 0) {
          warnings.push(`${missingProducts} of ${extractedData.length} items are missing product names`);
        }

        if (missingAccounts === extractedData.length || missingProducts === extractedData.length) {
          errors.push('All extracted items are missing required fields (account or product). Update the AI training instructions to specify how to extract these fields.');
        }
      } else {
        const { rows } = await parseFile(file);

        if (rows.length === 0) {
          errors.push('File contains no data');
        } else {
          const detectionResult = await detectColumnMappingEnhanced(
            rows.slice(0, 10),
            organizationId,
            undefined,
            file.name,
            aiTrainingConfig
          );

          confidence = detectionResult.confidence;

          const requiredMappings = ['account', 'customer', 'product', 'sku'];
          const hasAccount = detectionResult.mapping.account || detectionResult.mapping.customer;
          const hasProduct = detectionResult.mapping.product || detectionResult.mapping.sku;

          if (!hasAccount) {
            errors.push('Failed to detect account/customer column. Update field mappings or parsing instructions to help identify the account column.');
          }
          if (!hasProduct) {
            errors.push('Failed to detect product/SKU column. Update field mappings or parsing instructions to help identify the product column.');
          }

          if (confidence < 0.5) {
            warnings.push(`Low confidence (${(confidence * 100).toFixed(0)}%). The AI training may need more specific instructions.`);
          }

          extractedData = rows.slice(0, 5).map(row => ({
            account_name: hasAccount ? row[detectionResult.mapping.account || detectionResult.mapping.customer!] : '',
            product_name: hasProduct ? row[detectionResult.mapping.product || detectionResult.mapping.sku!] : '',
            quantity: detectionResult.mapping.quantity ? row[detectionResult.mapping.quantity] : '',
            date: detectionResult.mapping.date ? row[detectionResult.mapping.date] : '',
          }));
        }
      }

      setResults({
        success: errors.length === 0,
        itemsExtracted: extractedData.length,
        confidence,
        sampleData: extractedData.slice(0, 5),
        errors,
        warnings,
      });
    } catch (error) {
      setResults({
        success: false,
        itemsExtracted: 0,
        confidence: 0,
        sampleData: [],
        errors: [(error as Error).message],
        warnings: [],
      });
    } finally {
      setTesting(false);
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
    disabled: testing,
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="glass-card rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between sticky top-0 glass-card">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Test AI Training Configuration
            </h2>
            <p className="text-sm text-gray-600 dark:text-zinc-400 mt-1">
              {aiConfig.configuration_name} • {distributorName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition cursor-pointer ${
              isDragActive
                ? 'border-blue-500 dark:border-accent-primary bg-blue-50 dark:bg-accent-primary/20'
                : 'border-slate-300 dark:border-white/10 bg-white dark:bg-zinc-900 hover:border-blue-400 dark:hover:border-accent-primary hover:bg-slate-50 dark:hover:bg-white/5'
            } ${testing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <input {...getInputProps()} />

            <div className="flex flex-col items-center gap-3">
              {testing ? (
                <>
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 dark:border-accent-primary"></div>
                  <p className="text-gray-700 dark:text-white font-medium">Testing configuration...</p>
                </>
              ) : (
                <>
                  <div className="bg-blue-100 dark:bg-accent-primary/20 rounded-full p-3">
                    <Upload className="w-6 h-6 text-blue-600 dark:text-accent-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white mb-1">
                      {isDragActive ? 'Drop sample file here' : 'Upload Sample File'}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-zinc-400">
                      CSV, Excel, or PDF from {distributorName}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {results && (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg border ${
                results.success
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-500/30'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-500/30'
              }`}>
                <div className="flex items-start gap-3">
                  {results.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className={`font-medium ${
                      results.success
                        ? 'text-green-900 dark:text-green-400'
                        : 'text-red-900 dark:text-red-400'
                    }`}>
                      {results.success ? 'Test Passed' : 'Test Failed'}
                    </p>
                    <p className={`text-sm mt-1 ${
                      results.success
                        ? 'text-green-700 dark:text-green-300'
                        : 'text-red-700 dark:text-red-300'
                    }`}>
                      Extracted {results.itemsExtracted} items • {(results.confidence * 100).toFixed(0)}% confidence
                    </p>
                  </div>
                </div>
              </div>

              {results.errors.length > 0 && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-900 dark:text-red-400">Errors</p>
                      <ul className="text-sm text-red-700 dark:text-red-300 mt-2 space-y-1 list-disc list-inside">
                        {results.errors.map((error, i) => (
                          <li key={i}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {results.warnings.length > 0 && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-500/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-900 dark:text-yellow-400">Warnings</p>
                      <ul className="text-sm text-yellow-700 dark:text-yellow-300 mt-2 space-y-1 list-disc list-inside">
                        {results.warnings.map((warning, i) => (
                          <li key={i}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {results.sampleData.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white mb-3">Sample Extracted Data</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="glass-card border-b border-gray-200 dark:border-white/10">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-zinc-400 uppercase">Account</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-zinc-400 uppercase">Product</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-zinc-400 uppercase">Quantity</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-zinc-400 uppercase">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                        {results.sampleData.map((item, i) => (
                          <tr key={i} className="hover:bg-gray-50 dark:hover:bg-white/5">
                            <td className="px-4 py-2 text-gray-900 dark:text-white">{item.account_name || '-'}</td>
                            <td className="px-4 py-2 text-gray-900 dark:text-white">{item.product_name || '-'}</td>
                            <td className="px-4 py-2 text-gray-700 dark:text-zinc-300">{item.quantity || '-'}</td>
                            <td className="px-4 py-2 text-gray-700 dark:text-zinc-300">{item.date || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {results.success && (
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="flex-1 px-4 py-2 border border-slate-300 dark:border-white/10 text-gray-700 dark:text-zinc-300 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition"
                  >
                    Close
                  </button>
                  <button
                    onClick={onSuccess}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                  >
                    Activate Configuration
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
