import { useState } from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Package } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';

interface ColumnMappingPreviewProps {
  columns: string[];
  sampleRows: any[];
  detectedMapping: {
    date?: string;
    month?: string;
    year?: string;
    revenue?: string;
    amount?: string;
    account?: string;
    customer?: string;
    product?: string;
    sku?: string;
    quantity?: string;
    order_id?: string;
    category?: string;
    region?: string;
    representative?: string;
  };
  confidence: number;
  method: string;
  aiConfigName?: string;
  onConfirm: (mapping: any, unitType: 'cases' | 'bottles') => void;
  onCancel: () => void;
}

export default function ColumnMappingPreview({
  columns,
  sampleRows,
  detectedMapping,
  confidence,
  method,
  aiConfigName,
  onConfirm,
  onCancel,
}: ColumnMappingPreviewProps) {
  console.log('🗺️ ColumnMappingPreview mounted with:');
  console.log('  - columns:', columns);
  console.log('  - columns length:', columns?.length);
  console.log('  - sampleRows count:', sampleRows?.length);
  console.log('  - detectedMapping:', detectedMapping);

  const [mapping, setMapping] = useState(detectedMapping);
  const [unitType, setUnitType] = useState<'cases' | 'bottles'>('cases');

  if (!columns || columns.length === 0) {
    console.error('❌ No columns available for mapping!');
  }

  const requiredFields = [
    { key: 'account', label: 'Account/Customer', description: 'Customer or account name', altKey: 'customer' },
    { key: 'product', label: 'Product/SKU', description: 'Product name or SKU', altKey: 'sku' },
  ];

  const optionalFields = [
    { key: 'date', label: 'Date', description: 'Order or transaction date (optional for depletion reports)' },
    { key: 'month', label: 'Month', description: 'Month column (used with Year to create dates)' },
    { key: 'year', label: 'Year', description: 'Year column (used with Month to create dates)' },
    { key: 'revenue', label: 'Revenue/Amount', description: 'Sale amount or revenue (optional for depletion reports)', altKey: 'amount' },
    { key: 'quantity', label: 'Quantity', description: 'Units or quantity sold' },
    { key: 'order_id', label: 'Order ID', description: 'Order or transaction ID' },
    { key: 'category', label: 'Category', description: 'Product category' },
    { key: 'region', label: 'Region', description: 'Geographic region' },
    { key: 'representative', label: 'Representative', description: 'Sales representative' },
  ];

  const getFieldValue = (field: any) => {
    const value = mapping[field.key as keyof typeof mapping];
    if (value) return value;
    if (field.altKey) {
      return mapping[field.altKey as keyof typeof mapping];
    }
    return '';
  };

  const setFieldValue = (fieldKey: string, columnName: string) => {
    setMapping({ ...mapping, [fieldKey]: columnName || undefined });
  };

  const isRequiredFieldMapped = () => {
    return requiredFields.every(field => {
      const value = getFieldValue(field);
      return value && value.length > 0;
    });
  };

  const hasDateField = () => {
    return (mapping.date && mapping.date.length > 0) ||
           (mapping.month && mapping.month.length > 0 && mapping.year && mapping.year.length > 0);
  };

  const hasNoDateInfo = () => {
    return !mapping.date && !(mapping.month && mapping.year);
  };

  const confidenceColor = confidence >= 0.8 ? 'text-green-600 dark:text-accent-teal-400' :
                          confidence >= 0.5 ? 'text-yellow-600 dark:text-yellow-400' :
                          'text-orange-600 dark:text-accent-orange-400';

  if (!columns || columns.length === 0) {
    return (
      <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">Column Detection Error</DialogTitle>
          </DialogHeader>
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-900 dark:text-red-400 mb-2">
                  No Columns Detected
                </p>
                <p className="text-sm text-red-700 dark:text-red-300">
                  The file was uploaded but no column headers were found. This usually means:
                </p>
                <ul className="text-sm text-red-700 dark:text-red-300 mt-2 ml-4 list-disc space-y-1">
                  <li>The CSV file doesn't have a header row</li>
                  <li>The file format is not properly recognized</li>
                  <li>The file is corrupted or empty</li>
                </ul>
                <p className="text-sm text-red-700 dark:text-red-300 mt-3">
                  Please check your file and try again. If the problem persists, open your browser's console (F12) to see more details.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-200 dark:bg-zinc-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-zinc-600 transition"
            >
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">
              Column Mapping Preview
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-zinc-400">
              Review and adjust the detected column mappings before importing
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-500/30">
          <div className="flex items-center gap-4 text-sm flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-gray-700 dark:text-zinc-300">Detection Method:</span>
              <span className="font-medium text-gray-900 dark:text-white px-2 py-0.5 bg-white dark:bg-zinc-800 rounded">
                {method}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-700 dark:text-zinc-300">Confidence:</span>
              <span className={`font-semibold ${confidenceColor}`}>
                {(confidence * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-700 dark:text-zinc-300">Columns Detected:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {columns.length}
              </span>
            </div>
            {aiConfigName && (
              <div className="flex items-center gap-2">
                <span className="text-gray-700 dark:text-zinc-300">AI Config:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {aiConfigName}
                </span>
              </div>
            )}
          </div>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
            For depletion reports: Only Account and Product are required. Date and Revenue are optional.
          </p>
        </div>

        {hasNoDateInfo() && (
          <div className="mx-6 mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-yellow-900 dark:text-yellow-400 mb-1">
                  No Date Information Detected
                </h4>
                <p className="text-sm text-yellow-800 dark:text-yellow-500">
                  No date, month, or year columns were found in your file. After confirming the mapping,
                  you'll be prompted to assign a default month and year to all records. The system will
                  attempt to detect the period from your filename automatically.
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-600 mt-2">
                  <strong>Tip:</strong> If your file has date, month, or year columns, select them above to automatically assign dates.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-6">
            <div className="p-3 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-white/10 rounded-lg">
              <p className="text-xs font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                Debug Info: Detected Columns ({columns.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {columns.map((col, idx) => (
                  <span
                    key={idx}
                    className="text-xs px-2 py-1 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white border border-gray-300 dark:border-white/10 rounded"
                  >
                    {col}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <span className="text-red-500">*</span>
                Required Fields
              </h3>
              <div className="space-y-3">
                {requiredFields.map((field) => (
                  <div key={field.key} className="flex items-center gap-4">
                    <div className="w-48">
                      <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">
                        {field.label}
                      </label>
                      <p className="text-xs text-gray-500 dark:text-zinc-500">{field.description}</p>
                    </div>
                    <select
                      value={getFieldValue(field)}
                      onChange={(e) => setFieldValue(field.key, e.target.value)}
                      className="flex-1 px-3 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-white/10 rounded-lg text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-accent-primary focus:border-transparent outline-none"
                    >
                      <option value="">-- Select Column --</option>
                      {columns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                    {getFieldValue(field) ? (
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-accent-teal-400 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-orange-600 dark:text-accent-orange-400 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Package className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                    <span className="text-red-500">*</span>
                    Quantity Unit Type
                  </h3>
                  <p className="text-xs text-gray-700 dark:text-zinc-300 mb-3">
                    Specify how quantities are reported in this file. The system will convert all quantities to bottles for internal tracking.
                  </p>
                  <div className="flex gap-3">
                    <label className="flex-1 relative">
                      <input
                        type="radio"
                        name="unitType"
                        value="cases"
                        checked={unitType === 'cases'}
                        onChange={(e) => setUnitType(e.target.value as 'cases' | 'bottles')}
                        className="peer sr-only"
                      />
                      <div className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-zinc-800 border-2 border-gray-300 dark:border-white/10 rounded-lg cursor-pointer transition peer-checked:border-blue-600 dark:peer-checked:border-accent-primary peer-checked:bg-blue-50 dark:peer-checked:bg-blue-900/20">
                        <div className="w-4 h-4 rounded-full border-2 border-gray-400 dark:border-zinc-500 peer-checked:border-blue-600 dark:peer-checked:border-accent-primary peer-checked:bg-blue-600 dark:peer-checked:bg-accent-primary flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-white opacity-0 peer-checked:opacity-100"></div>
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">Cases</div>
                          <div className="text-xs text-gray-600 dark:text-zinc-400">Quantities represent cases (6 or 12-pack)</div>
                        </div>
                      </div>
                    </label>
                    <label className="flex-1 relative">
                      <input
                        type="radio"
                        name="unitType"
                        value="bottles"
                        checked={unitType === 'bottles'}
                        onChange={(e) => setUnitType(e.target.value as 'cases' | 'bottles')}
                        className="peer sr-only"
                      />
                      <div className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-zinc-800 border-2 border-gray-300 dark:border-white/10 rounded-lg cursor-pointer transition peer-checked:border-blue-600 dark:peer-checked:border-accent-primary peer-checked:bg-blue-50 dark:peer-checked:bg-blue-900/20">
                        <div className="w-4 h-4 rounded-full border-2 border-gray-400 dark:border-zinc-500 peer-checked:border-blue-600 dark:peer-checked:border-accent-primary peer-checked:bg-blue-600 dark:peer-checked:bg-accent-primary flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-white opacity-0 peer-checked:opacity-100"></div>
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">Bottles</div>
                          <div className="text-xs text-gray-600 dark:text-zinc-400">Quantities represent individual bottles</div>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Optional Fields
              </h3>
              <div className="space-y-3">
                {optionalFields.map((field) => (
                  <div key={field.key} className="flex items-center gap-4">
                    <div className="w-48">
                      <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">
                        {field.label}
                      </label>
                      <p className="text-xs text-gray-500 dark:text-zinc-500">{field.description}</p>
                    </div>
                    <select
                      value={mapping[field.key as keyof typeof mapping] || ''}
                      onChange={(e) => setFieldValue(field.key, e.target.value)}
                      className="flex-1 px-3 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-white/10 rounded-lg text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-accent-primary focus:border-transparent outline-none"
                    >
                      <option value="">-- None / Skip --</option>
                      {columns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Data Preview (First 5 Rows)
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-white/10 text-xs">
                  <thead className="bg-gray-50 dark:bg-zinc-800">
                    <tr>
                      {columns.map((col) => (
                        <th
                          key={col}
                          className="px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-zinc-300 uppercase tracking-wider"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-white/10">
                    {sampleRows.slice(0, 5).map((row, idx) => (
                      <tr key={idx}>
                        {columns.map((col) => (
                          <td
                            key={col}
                            className="px-3 py-2 text-gray-900 dark:text-white whitespace-nowrap"
                          >
                            {row[col]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-white/10 flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-zinc-400">
            {isRequiredFieldMapped() ? (
              <span className="flex items-center gap-2 text-green-600 dark:text-accent-teal-400">
                <CheckCircle className="w-4 h-4" />
                All required fields are mapped
              </span>
            ) : (
              <span className="flex items-center gap-2 text-orange-600 dark:text-accent-orange-400">
                <AlertCircle className="w-4 h-4" />
                Please map all required fields before proceeding
              </span>
            )}
          </p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(mapping, unitType)}
              disabled={!isRequiredFieldMapped()}
              className="px-6 py-2 bg-blue-600 dark:bg-accent-primary text-white rounded-lg hover:bg-blue-700 dark:hover:bg-accent-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirm & Import
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
