import { useState, useEffect } from 'react';
import { X, Plus, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { updateImporterInventory } from '../lib/inventoryService';

interface AddImporterInventoryModalProps {
  organizationId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface Product {
  id: string;
  product_name: string;
}

export default function AddImporterInventoryModal({
  organizationId,
  onClose,
  onSuccess,
}: AddImporterInventoryModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingProducts, setFetchingProducts] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAvailableProducts();
  }, [organizationId]);

  const fetchAvailableProducts = async () => {
    setFetchingProducts(true);
    setError('');

    const { data: allProducts, error: productsError } = await supabase
      .from('products')
      .select('id, product_name')
      .eq('organization_id', organizationId)
      .order('product_name');

    if (productsError) {
      setError('Failed to load products');
      setFetchingProducts(false);
      return;
    }

    const { data: existingInventory } = await supabase
      .from('inventory_importer')
      .select('product_id')
      .eq('organization_id', organizationId);

    const existingProductIds = new Set(
      existingInventory?.map((inv) => inv.product_id) || []
    );

    const availableProducts = (allProducts || []).filter(
      (product) => !existingProductIds.has(product.id)
    );

    setProducts(availableProducts);
    setFetchingProducts(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedProductId) {
      setError('Please select a product');
      return;
    }

    const quantityNum = parseFloat(quantity);
    if (isNaN(quantityNum) || quantityNum < 0) {
      setError('Please enter a valid quantity (must be 0 or greater)');
      return;
    }

    setLoading(true);

    const success = await updateImporterInventory(
      organizationId,
      selectedProductId,
      quantityNum,
      notes || undefined
    );

    setLoading(false);

    if (success) {
      onSuccess();
    } else {
      setError('Failed to add inventory. This product may already have inventory tracked.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card rounded-2xl p-6 w-full max-w-md shadow-glow-blue max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl p-2 bg-gradient-blue shadow-glow-blue">
              <Package className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Add Importer Inventory
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {fetchingProducts ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary"></div>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-8 text-gray-600 dark:text-zinc-400">
            <p className="mb-2">No products available to add.</p>
            <p className="text-sm">All products already have inventory tracked.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                Product
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full px-4 py-2.5 glass rounded-xl text-gray-900 dark:text-white focus-ring"
                required
                autoFocus
              >
                <option value="">Select a product...</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.product_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                Initial Quantity
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="0"
                step="0.01"
                placeholder="Enter quantity"
                className="w-full px-4 py-2.5 glass rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-400 focus-ring"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this inventory entry..."
                rows={3}
                className="w-full px-4 py-2.5 glass rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-400 focus-ring resize-none"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 glass rounded-xl font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 btn-primary flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Add Inventory
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
