import { useState } from 'react';
import { X, Package, Check } from 'lucide-react';
import {
  PackageType,
  PACKAGE_TYPE_LABELS,
  updateProductPackageTypes,
} from '../lib/fobPricingService';

interface ProductPackageManagerProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: string;
    product_name: string;
    available_package_types: PackageType[];
    default_package_type: PackageType;
  };
  organizationId: string;
  onSave: () => void;
}

export default function ProductPackageManager({
  isOpen,
  onClose,
  product,
  organizationId,
  onSave,
}: ProductPackageManagerProps) {
  const allPackageTypes: PackageType[] = ['case_6', 'case_12', 'single', 'barrel'];
  const [selectedTypes, setSelectedTypes] = useState<Set<PackageType>>(
    new Set(product.available_package_types)
  );
  const [defaultType, setDefaultType] = useState<PackageType>(product.default_package_type);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const togglePackageType = (type: PackageType) => {
    setError(null);
    const newSelection = new Set(selectedTypes);
    if (newSelection.has(type)) {
      if (newSelection.size > 1) {
        newSelection.delete(type);
        if (defaultType === type) {
          setDefaultType(Array.from(newSelection)[0]);
        }
      } else {
        setError('At least one package type must be selected');
        return;
      }
    } else {
      newSelection.add(type);
    }
    setSelectedTypes(newSelection);
  };

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const availableTypes = Array.from(selectedTypes);
      const result = await updateProductPackageTypes(
        organizationId,
        product.id,
        availableTypes,
        defaultType
      );

      if (result.success) {
        await onSave();
        onClose();
      } else {
        setError(result.error || 'Failed to update package types');
      }
    } catch (error) {
      console.error('Error saving package types:', error);
      setError('An unexpected error occurred while saving package types');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="glass-card rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 glass border-b border-gray-200 dark:border-white/10 p-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="rounded-xl p-2 bg-gradient-blue">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Package Types
              </h2>
              <p className="text-sm text-gray-600 dark:text-zinc-400 mt-1">
                {product.product_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-zinc-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-3">
              Available Package Types
            </h3>
            <p className="text-sm text-gray-600 dark:text-zinc-400 mb-4">
              Select which package types are available for this product. At least one must be selected.
            </p>
            <div className="space-y-3">
              {allPackageTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => togglePackageType(type)}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition ${
                    selectedTypes.has(type)
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center ${
                        selectedTypes.has(type)
                          ? 'bg-blue-500'
                          : 'border-2 border-gray-300 dark:border-zinc-600'
                      }`}
                    >
                      {selectedTypes.has(type) && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {PACKAGE_TYPE_LABELS[type]}
                    </span>
                  </div>
                  {selectedTypes.has(type) && defaultType === type && (
                    <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                      Default
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-3">
              Default Package Type
            </h3>
            <p className="text-sm text-gray-600 dark:text-zinc-400 mb-4">
              Select the default package type for new orders.
            </p>
            <select
              value={defaultType}
              onChange={(e) => setDefaultType(e.target.value as PackageType)}
              className="w-full px-4 py-3 glass rounded-xl text-gray-900 dark:text-white focus-ring"
            >
              {Array.from(selectedTypes).map((type) => (
                <option key={type} value={type}>
                  {PACKAGE_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="sticky bottom-0 glass border-t border-gray-200 dark:border-white/10 p-6 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary" disabled={saving}>
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
