import { useState } from 'react';
import { X, AlertTriangle, CheckCircle, GitMerge, Package, DollarSign, ShoppingCart } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { mergeProductInventories } from '../lib/inventoryService';

interface Product {
  id: string;
  product_name: string;
  total_revenue: number;
  total_units: number;
  total_orders: number;
  average_price: number;
  first_sale_date: string;
  last_sale_date: string;
}

interface MergeProductsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProducts: Product[];
  organizationId: string;
  onMergeComplete: () => void;
}

export default function MergeProductsModal({
  isOpen,
  onClose,
  selectedProducts,
  organizationId,
  onMergeComplete
}: MergeProductsModalProps) {
  const { user } = useAuth();
  const [selectedCanonicalId, setSelectedCanonicalId] = useState<string>('');
  const [customName, setCustomName] = useState('');
  const [useCustomName, setUseCustomName] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  if (!isOpen) return null;

  const totalRevenue = selectedProducts.reduce((sum, p) => sum + Number(p.total_revenue), 0);
  const totalUnits = selectedProducts.reduce((sum, p) => sum + Number(p.total_units), 0);
  const totalOrders = selectedProducts.reduce((sum, p) => sum + p.total_orders, 0);

  const selectedCanonicalProduct = selectedProducts.find(p => p.id === selectedCanonicalId);
  const canonicalName = useCustomName ? customName : (selectedCanonicalProduct?.product_name || '');

  const handleMerge = async () => {
    if (!user || !canonicalName.trim()) {
      setError('Please select or enter a product name to keep');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      const productIds = selectedProducts.map(p => p.id);

      const { data, error: rpcError } = await supabase.rpc('manual_bulk_merge_products', {
        p_organization_id: organizationId,
        p_product_ids: productIds,
        p_canonical_name: canonicalName.trim(),
        p_user_id: user.id
      });

      if (rpcError) {
        throw rpcError;
      }

      console.log('✅ Products merged:', data);

      const { data: canonicalProduct } = await supabase
        .from('products')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('product_name', canonicalName.trim())
        .maybeSingle();

      if (canonicalProduct) {
        console.log('🔄 Merging inventory for products...');
        const inventoryMerged = await mergeProductInventories(
          organizationId,
          productIds,
          canonicalProduct.id
        );
        if (inventoryMerged) {
          console.log('✅ Inventory merged successfully');
        }
      }

      console.log('✅ Merge completed:', data);

      onMergeComplete();
      onClose();
    } catch (err: any) {
      console.error('Merge error:', err);
      setError(err.message || 'Failed to merge products. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleProceedToConfirmation = () => {
    if (!canonicalName.trim()) {
      setError('Please select or enter a product name to keep');
      return;
    }
    setError('');
    setShowConfirmation(true);
  };

  if (showConfirmation) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="glass-card rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Confirm Product Merge</h2>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl mb-6">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Important: This action cannot be easily undone</h3>
                <p className="text-sm text-gray-600 dark:text-zinc-400">
                  All sales records from the products below will be updated to use the canonical name.
                  This will affect historical data and reports.
                </p>
              </div>
            </div>

            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide mb-3">
                Canonical Product Name (Keep This)
              </h4>
              <div className="glass-card rounded-xl p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{canonicalName}</p>
              </div>
            </div>

            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide mb-3">
                Products to Merge ({selectedProducts.length})
              </h4>
              <div className="space-y-2">
                {selectedProducts.map((product) => (
                  <div key={product.id} className="glass-card rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 dark:text-white text-sm">
                          {product.product_name}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-600 dark:text-zinc-400">
                          <span>${Number(product.total_revenue).toLocaleString()}</span>
                          <span>{product.total_orders} orders</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card rounded-xl p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">After Merge:</h4>
              <ul className="text-sm text-gray-600 dark:text-zinc-400 space-y-1">
                <li>• All sales records will be updated to use: <span className="font-semibold text-gray-900 dark:text-white">{canonicalName}</span></li>
                <li>• Total combined revenue: <span className="font-semibold text-gray-900 dark:text-white">${totalRevenue.toLocaleString()}</span></li>
                <li>• Total combined units: <span className="font-semibold text-gray-900 dark:text-white">{totalUnits.toLocaleString()}</span></li>
                <li>• Total combined orders: <span className="font-semibold text-gray-900 dark:text-white">{totalOrders}</span></li>
              </ul>
            </div>
          </div>

          {error && (
            <div className="px-6 pb-4">
              <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            </div>
          )}

          <div className="px-6 py-4 border-t border-gray-200 dark:border-white/10 flex items-center justify-between gap-3">
            <button
              onClick={() => setShowConfirmation(false)}
              disabled={processing}
              className="btn-secondary"
            >
              Back
            </button>
            <button
              onClick={handleMerge}
              disabled={processing}
              className="btn-primary flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              {processing ? 'Merging...' : 'Confirm Merge'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Merge Products</h2>
            <p className="text-sm text-gray-600 dark:text-zinc-400 mt-1">
              Select which product name to keep after merging
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-zinc-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass-card rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-accent-teal-400" />
                  <span className="text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wide">
                    Combined Revenue
                  </span>
                </div>
                <span className="text-2xl font-semibold text-gray-900 dark:text-white">
                  ${totalRevenue.toLocaleString()}
                </span>
              </div>
              <div className="glass-card rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wide">
                    Total Units
                  </span>
                </div>
                <span className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {totalUnits.toLocaleString()}
                </span>
              </div>
              <div className="glass-card rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingCart className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wide">
                    Total Orders
                  </span>
                </div>
                <span className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {totalOrders}
                </span>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide mb-3">
              Selected Products ({selectedProducts.length})
            </h3>
            <div className="space-y-3">
              {selectedProducts.map((product) => (
                <label
                  key={product.id}
                  className={`glass-card rounded-xl p-4 cursor-pointer transition ${
                    selectedCanonicalId === product.id && !useCustomName
                      ? 'ring-2 ring-accent-primary bg-blue-50 dark:bg-blue-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="canonical"
                      value={product.id}
                      checked={selectedCanonicalId === product.id && !useCustomName}
                      onChange={(e) => {
                        setSelectedCanonicalId(e.target.value);
                        setUseCustomName(false);
                        setError('');
                      }}
                      className="mt-1 w-4 h-4 cursor-pointer accent-blue-600 dark:accent-blue-500 flex-shrink-0"
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 dark:text-white mb-2">
                        {product.product_name}
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-gray-600 dark:text-zinc-400 mb-1">Revenue:</div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            ${Number(product.total_revenue).toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-600 dark:text-zinc-400 mb-1">Units:</div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {Number(product.total_units).toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-600 dark:text-zinc-400 mb-1">Orders:</div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {product.total_orders}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-600 dark:text-zinc-400 mb-1">Last Sale:</div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {product.last_sale_date ? format(new Date(product.last_sale_date), 'MMM dd, yyyy') : '-'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
                Or Use Custom Name
              </h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCustomName}
                  onChange={(e) => {
                    setUseCustomName(e.target.checked);
                    if (e.target.checked) {
                      setSelectedCanonicalId('');
                    }
                    setError('');
                  }}
                  className="rounded w-4 h-4 cursor-pointer accent-blue-600 dark:accent-blue-500"
                />
                <span className="text-sm text-gray-600 dark:text-zinc-400">Use custom name</span>
              </label>
            </div>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              disabled={!useCustomName}
              placeholder="Enter a custom product name..."
              className={`w-full px-4 py-2.5 glass rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus-ring ${
                !useCustomName ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-white/10 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            disabled={processing}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleProceedToConfirmation}
            disabled={processing || (!selectedCanonicalId && !useCustomName) || (useCustomName && !customName.trim())}
            className="btn-primary flex items-center gap-2"
          >
            <GitMerge className="w-4 h-4" />
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
