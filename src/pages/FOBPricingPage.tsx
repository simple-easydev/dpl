import { useEffect, useState } from 'react';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { DollarSign, Save, X, Info, Package } from 'lucide-react';
import {
  getFOBPricingMatrix,
  saveFOBPriceOverride,
  deleteFOBPriceOverride,
  type FOBPricingMatrix,
  type PackageType,
  PACKAGE_TYPE_LABELS,
} from '../lib/fobPricingService';

interface Distributor {
  id: string;
  name: string;
  is_global: boolean;
}

interface CellEdit {
  productId: string;
  distributorId: string;
  packageType: PackageType;
  value: string;
}

export default function FOBPricingPage() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [pricingMatrix, setPricingMatrix] = useState<FOBPricingMatrix[]>([]);
  const [editedCells, setEditedCells] = useState<Map<string, CellEdit>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentOrganization) {
      fetchData();
    }
  }, [currentOrganization]);

  const fetchData = async () => {
    if (!currentOrganization) return;

    setLoading(true);
    setError(null);

    try {
      const [matrixData, addedGlobalRes, customDistRes] = await Promise.all([
        getFOBPricingMatrix(currentOrganization.id),
        supabase
          .from('organization_distributors')
          .select('distributor_id, distributors(id, name, is_global)')
          .eq('organization_id', currentOrganization.id),
        supabase
          .from('distributors')
          .select('id, name, is_global')
          .eq('organization_id', currentOrganization.id)
          .eq('active', true)
          .order('name'),
      ]);

      const addedGlobalDistributors = (addedGlobalRes.data || [])
        .map((item: any) => item.distributors)
        .filter((dist: any): dist is Distributor => dist !== null && typeof dist === 'object');

      const allDistributors = [
        ...addedGlobalDistributors,
        ...(customDistRes.data || []),
      ].sort((a, b) => a.name.localeCompare(b.name));

      setDistributors(allDistributors);
      setPricingMatrix(matrixData);
    } catch (err) {
      setError('Failed to load FOB pricing data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCellEdit = (productId: string, distributorId: string, packageType: PackageType, value: string) => {
    const key = `${productId}_${distributorId}_${packageType}`;
    const newEdits = new Map(editedCells);

    if (value === '') {
      newEdits.set(key, { productId, distributorId, packageType, value });
    } else {
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && numValue >= 0) {
        newEdits.set(key, { productId, distributorId, packageType, value });
      }
    }

    setEditedCells(newEdits);
  };

  const handleSaveChanges = async () => {
    if (!currentOrganization || !user) return;

    setSaving(true);
    setError(null);

    try {
      let successCount = 0;
      let failCount = 0;

      for (const [, edit] of editedCells) {
        if (edit.value === '') {
          const success = await deleteFOBPriceOverride(
            currentOrganization.id,
            edit.productId,
            edit.distributorId,
            edit.packageType
          );
          if (success) successCount++;
          else failCount++;
        } else {
          const fobPrice = parseFloat(edit.value);
          const success = await saveFOBPriceOverride(
            currentOrganization.id,
            edit.productId,
            edit.distributorId,
            fobPrice,
            user.id,
            edit.packageType
          );
          if (success) successCount++;
          else failCount++;
        }
      }

      if (failCount > 0) {
        setError(`Saved ${successCount} changes, but ${failCount} failed`);
      }

      setEditedCells(new Map());
      await fetchData();
    } catch (err) {
      setError('Failed to save changes');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelChanges = () => {
    setEditedCells(new Map());
  };

  const getCellValue = (productId: string, distributorId: string, packageType: PackageType): string => {
    const key = `${productId}_${distributorId}_${packageType}`;
    if (editedCells.has(key)) {
      return editedCells.get(key)!.value;
    }

    const product = pricingMatrix.find(p => p.productId === productId);
    if (product) {
      const distributorPricesByPackage = product.distributorPrices[distributorId];
      if (distributorPricesByPackage && distributorPricesByPackage[packageType] !== undefined && distributorPricesByPackage[packageType] !== null) {
        return distributorPricesByPackage[packageType]!.toString();
      }
    }

    return '';
  };

  const getCellPlaceholder = (productId: string, packageType: PackageType): string => {
    const product = pricingMatrix.find(p => p.productId === productId);
    if (product && product.defaultFobPrice !== null && packageType === 'case_6') {
      return `$${product.defaultFobPrice.toFixed(2)}`;
    }
    return '-';
  };

  const isCellEdited = (productId: string, distributorId: string, packageType: PackageType): boolean => {
    const key = `${productId}_${distributorId}_${packageType}`;
    return editedCells.has(key);
  };

  const hasOverride = (productId: string, distributorId: string, packageType: PackageType): boolean => {
    const product = pricingMatrix.find(p => p.productId === productId);
    if (!product) return false;
    const distributorPricesByPackage = product.distributorPrices[distributorId];
    return distributorPricesByPackage !== undefined &&
           distributorPricesByPackage !== null &&
           distributorPricesByPackage[packageType] !== undefined &&
           distributorPricesByPackage[packageType] !== null;
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-4">
          FOB Pricing Matrix
        </h1>

        <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl mb-6">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
              How FOB Pricing Works
            </h3>
            <p className="text-sm text-gray-600 dark:text-zinc-400">
              Set distributor-specific FOB prices to override default product prices. Empty cells
              use the default price shown in the placeholder. Revenue is calculated as cases sold ×
              FOB price.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl mb-6">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {editedCells.size > 0 && (
          <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-40">
            <div className="glass-card rounded-2xl shadow-2xl px-6 py-4 flex items-center gap-6">
              <div>
                <div className="text-sm text-gray-600 dark:text-zinc-400">Unsaved Changes</div>
                <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {editedCells.size}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handleCancelChanges} className="btn-secondary flex items-center gap-2">
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  onClick={handleSaveChanges}
                  disabled={saving}
                  className="btn-primary flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {distributors.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center">
          <DollarSign className="w-12 h-12 text-gray-400 dark:text-zinc-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-zinc-400">
            No distributors found. Add distributors from the Distributors page to set FOB pricing.
          </p>
        </div>
      ) : pricingMatrix.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center">
          <Package className="w-12 h-12 text-gray-400 dark:text-zinc-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-zinc-400">
            No products available.
          </p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl glow-hover-blue overflow-hidden border-2 dark:border-white/20">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full">
              <thead className="border-b-2 border-gray-200 dark:border-white/20 sticky top-0 bg-gray-50 dark:bg-white/10 backdrop-blur-xl z-10">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-white/10 backdrop-blur-xl border-r-2 border-gray-200 dark:border-white/20 z-20 shadow-lg dark:shadow-black/40">
                    Distributor
                  </th>
                  {pricingMatrix.map((product) =>
                    product.availablePackageTypes.map((packageType) => (
                      <th
                        key={`${product.productId}_${packageType}`}
                        className="px-6 py-4 text-center text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider min-w-[180px]"
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-semibold">{product.productName}</span>
                          <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">
                            {PACKAGE_TYPE_LABELS[packageType]}
                          </span>
                        </div>
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/20">
                <tr className="bg-gray-100 dark:bg-white/8">
                  <td className="px-6 py-4 whitespace-nowrap sticky left-0 bg-gray-100 dark:bg-white/8 backdrop-blur-xl border-r-2 border-gray-200 dark:border-white/20 shadow-lg dark:shadow-black/40">
                    <span className="font-bold text-gray-900 dark:text-white">
                      Default FOB
                    </span>
                  </td>
                  {pricingMatrix.map((product) =>
                    product.availablePackageTypes.map((packageType) => (
                      <td key={`${product.productId}_${packageType}`} className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="text-gray-900 dark:text-gray-100 font-bold text-sm">
                          {product.defaultFobPrice !== null && packageType === 'case_6'
                            ? `$${product.defaultFobPrice.toFixed(2)}`
                            : '-'}
                        </span>
                      </td>
                    ))
                  )}
                </tr>
                {distributors.map((distributor) => (
                  <tr
                    key={distributor.id}
                    className="group hover:bg-gray-50 dark:hover:bg-white/8 transition-colors duration-150"
                  >
                    <td className="px-6 py-4 whitespace-nowrap sticky left-0 bg-white dark:bg-[rgba(255,255,255,0.06)] group-hover:bg-gray-50 dark:group-hover:bg-white/8 backdrop-blur-xl border-r-2 border-gray-200 dark:border-white/20 shadow-lg dark:shadow-black/40 transition-colors duration-150">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {distributor.name}
                      </span>
                    </td>
                    {pricingMatrix.map((product) =>
                      product.availablePackageTypes.map((packageType) => (
                        <td key={`${product.productId}_${packageType}`} className="px-6 py-4 whitespace-nowrap">
                          <div className="relative">
                            <DollarSign className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${
                              isCellEdited(product.productId, distributor.id, packageType)
                                ? 'text-blue-600 dark:text-blue-400'
                                : hasOverride(product.productId, distributor.id, packageType)
                                ? 'text-teal-600 dark:text-teal-400'
                                : 'text-gray-500 dark:text-gray-400'
                            }`} />
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={getCellValue(product.productId, distributor.id, packageType)}
                              onChange={(e) =>
                                handleCellEdit(product.productId, distributor.id, packageType, e.target.value)
                              }
                              placeholder={getCellPlaceholder(product.productId, packageType)}
                              className={`w-full pl-8 pr-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all duration-200 ${
                                isCellEdited(product.productId, distributor.id, packageType)
                                  ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-gray-900 dark:text-white placeholder-blue-400 dark:placeholder-blue-500'
                                  : hasOverride(product.productId, distributor.id, packageType)
                                  ? 'border-teal-500 dark:border-teal-400 bg-teal-50 dark:bg-teal-900/30 text-gray-900 dark:text-white placeholder-teal-400 dark:placeholder-teal-500'
                                  : 'border-gray-300 dark:border-white/25 bg-white dark:bg-white/10 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400'
                              } focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 outline-none hover:border-gray-400 dark:hover:border-white/35`}
                            />
                          </div>
                        </td>
                      ))
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center gap-6 text-sm font-medium text-gray-700 dark:text-gray-300">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded border-2 border-teal-500 dark:border-teal-400 bg-teal-50 dark:bg-teal-900/30"></div>
          <span>Distributor Override</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded border-2 border-gray-300 dark:border-white/25 bg-white dark:bg-white/10"></div>
          <span>Using Default</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded border-2 border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30"></div>
          <span>Edited (Unsaved)</span>
        </div>
      </div>
    </div>
  );
}
