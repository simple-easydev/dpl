import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { initializeDistributorInventory } from '../lib/inventoryService';
import { X, Plus, Trash2 } from 'lucide-react';

interface Product {
  id: string;
  product_name: string;
}

interface Distributor {
  id: string;
  name: string;
}

interface InventoryEntry {
  productId: string;
  quantity: number;
}

interface InitializeDistributorInventoryModalProps {
  organizationId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function InitializeDistributorInventoryModal({
  organizationId,
  onClose,
  onSuccess,
}: InitializeDistributorInventoryModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [selectedDistributor, setSelectedDistributor] = useState('');
  const [entries, setEntries] = useState<InventoryEntry[]>([{ productId: '', quantity: 0 }]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [organizationId]);

  const fetchData = async () => {
    setLoadingData(true);
    try {
      const [productsResult, addedGlobalResult, customResult] = await Promise.all([
        supabase
          .from('products')
          .select('id, product_name')
          .eq('organization_id', organizationId)
          .order('product_name', { ascending: true }),
        supabase
          .from('organization_distributors')
          .select('distributor_id, state, distributors(id, name, state, active)')
          .eq('organization_id', organizationId),
        supabase
          .from('distributors')
          .select('id, name, state, active')
          .eq('organization_id', organizationId)
          .eq('is_global', false)
          .eq('active', true)
          .order('name', { ascending: true }),
      ]);

      if (productsResult.data) {
        setProducts(productsResult.data);
      }

      const distributorMap = new Map<string, Distributor>();

      if (customResult.data) {
        customResult.data.forEach(dist => {
          distributorMap.set(dist.id, {
            id: dist.id,
            name: dist.name,
          });
        });
      }

      if (addedGlobalResult.data) {
        addedGlobalResult.data.forEach((item: any) => {
          if (item.distributors && item.distributors.active) {
            const dist = item.distributors;
            distributorMap.set(dist.id, {
              id: dist.id,
              name: dist.name,
            });
          }
        });
      }

      const distributorsList = Array.from(distributorMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      );

      setDistributors(distributorsList);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load distributors and products. Please try again.');
    } finally {
      setLoadingData(false);
    }
  };

  const handleAddEntry = () => {
    setEntries([...entries, { productId: '', quantity: 0 }]);
  };

  const handleRemoveEntry = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index));
  };

  const handleEntryChange = (index: number, field: 'productId' | 'quantity', value: string | number) => {
    const newEntries = [...entries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setEntries(newEntries);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedDistributor) {
      setError('Please select a distributor');
      return;
    }

    const validEntries = entries.filter(entry => entry.productId && entry.quantity > 0);

    if (validEntries.length === 0) {
      setError('Please add at least one product with a valid quantity');
      return;
    }

    setLoading(true);

    try {
      const results = await Promise.all(
        validEntries.map((entry) =>
          initializeDistributorInventory(
            organizationId,
            entry.productId,
            selectedDistributor,
            entry.quantity
          )
        )
      );

      const successCount = results.filter(Boolean).length;

      if (successCount === validEntries.length) {
        onSuccess();
      } else {
        setError(`Initialized ${successCount} of ${validEntries.length} products. Some may already have inventory set.`);
      }
    } catch (err) {
      setError('Failed to initialize inventory. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="glass-card rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Initialize Distributor Inventory
            </h2>
            <p className="text-sm text-gray-600 dark:text-zinc-400 mt-1">
              Set initial stock levels for products at a distributor
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-zinc-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
                Select Distributor <span className="text-red-500">*</span>
              </label>
              {loadingData ? (
                <div className="w-full px-4 py-2 glass rounded-xl text-gray-600 dark:text-zinc-400 flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  Loading distributors...
                </div>
              ) : distributors.length === 0 ? (
                <div className="w-full px-4 py-3 glass rounded-xl">
                  <p className="text-sm text-gray-600 dark:text-zinc-400">
                    No distributors found. Please add distributors from the Distributors page first.
                  </p>
                </div>
              ) : (
                <select
                  value={selectedDistributor}
                  onChange={(e) => setSelectedDistributor(e.target.value)}
                  required
                  className="w-full px-4 py-2 glass rounded-xl text-gray-900 dark:text-white focus-ring"
                >
                  <option value="">Choose a distributor...</option>
                  {distributors.map((dist) => (
                    <option key={dist.id} value={dist.id}>
                      {dist.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300">
                  Products and Quantities
                </label>
                <button
                  type="button"
                  onClick={handleAddEntry}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 transition"
                >
                  <Plus className="w-4 h-4" />
                  Add Product
                </button>
              </div>

              <div className="space-y-3">
                {entries.map((entry, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <select
                      value={entry.productId}
                      onChange={(e) => handleEntryChange(index, 'productId', e.target.value)}
                      className="flex-1 px-3 py-2 glass rounded-lg text-gray-900 dark:text-white focus-ring text-sm"
                    >
                      <option value="">Select product...</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.product_name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={entry.quantity}
                      onChange={(e) => handleEntryChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                      placeholder="Quantity"
                      className="w-32 px-3 py-2 glass rounded-lg text-gray-900 dark:text-white focus-ring text-sm"
                    />
                    {entries.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveEntry(index)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
              <p className="text-sm text-gray-700 dark:text-zinc-300">
                <strong>Note:</strong> Initial inventory can only be set once per product-distributor combination.
                After initialization, the inventory will automatically decrease as depletion data is uploaded.
              </p>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 dark:border-white/10 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || loadingData || distributors.length === 0}
            >
              {loading ? 'Initializing...' : 'Initialize Inventory'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
