import { useState, useEffect } from 'react';
import { X, Tag } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Product {
  id: string;
  product_name: string;
  brand: string | null;
}

interface EditProductBrandModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  organizationId: string;
  onSuccess: () => void;
  isBulk?: boolean;
}

export default function EditProductBrandModal({
  isOpen,
  onClose,
  products,
  organizationId,
  onSuccess,
  isBulk = false,
}: EditProductBrandModalProps) {
  const [brandName, setBrandName] = useState('');
  const [existingBrands, setExistingBrands] = useState<string[]>([]);
  const [filteredBrands, setFilteredBrands] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchExistingBrands();
      if (!isBulk && products.length === 1) {
        setBrandName(products[0].brand || '');
      } else {
        setBrandName('');
      }
      setError(null);
    }
  }, [isOpen, products, isBulk]);

  useEffect(() => {
    if (brandName) {
      const filtered = existingBrands.filter(brand =>
        brand.toLowerCase().includes(brandName.toLowerCase())
      );
      setFilteredBrands(filtered);
    } else {
      setFilteredBrands(existingBrands);
    }
  }, [brandName, existingBrands]);

  const fetchExistingBrands = async () => {
    const { data: brandsData } = await supabase
      .from('products')
      .select('brand')
      .eq('organization_id', organizationId)
      .not('brand', 'is', null);

    if (brandsData) {
      const uniqueBrands = Array.from(
        new Set(brandsData.map(item => item.brand).filter((b): b is string => b !== null))
      ).sort();
      setExistingBrands(uniqueBrands);
      setFilteredBrands(uniqueBrands);
    }
  };

  const handleSave = async () => {
    if (!brandName.trim() && !isBulk) {
      setError('Please enter a brand name or leave empty to clear');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const finalBrandName = brandName.trim() || null;

      for (const product of products) {
        const { error: productError } = await supabase
          .from('products')
          .update({
            brand: finalBrandName,
            manual_brand: true,
          })
          .eq('id', product.id);

        if (productError) throw productError;

        const { error: salesError } = await supabase
          .from('sales_data')
          .update({ brand: finalBrandName })
          .eq('organization_id', organizationId)
          .eq('product_name', product.product_name);

        if (salesError) throw salesError;
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error updating brand:', err);
      setError('Failed to update brand. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectBrand = (brand: string) => {
    setBrandName(brand);
    setShowSuggestions(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="glass-card rounded-2xl max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl p-2 bg-gradient-blue">
              <Tag className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {isBulk ? 'Assign Brand to Products' : 'Edit Product Brand'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition"
            disabled={saving}
          >
            <X className="w-5 h-5 text-gray-600 dark:text-zinc-400" />
          </button>
        </div>

        <div className="space-y-4">
          {isBulk && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
              <p className="text-sm text-gray-700 dark:text-zinc-300">
                You are assigning a brand to <strong>{products.length}</strong> selected product{products.length > 1 ? 's' : ''}.
              </p>
            </div>
          )}

          {!isBulk && products.length === 1 && (
            <div className="p-4 glass rounded-xl">
              <p className="text-sm text-gray-600 dark:text-zinc-400 mb-1">Product</p>
              <p className="font-semibold text-gray-900 dark:text-white">{products[0].product_name}</p>
            </div>
          )}

          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
              Brand Name
            </label>
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="Enter or select brand name"
              className="w-full px-4 py-2.5 glass rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-400 focus-ring"
              disabled={saving}
            />

            {showSuggestions && filteredBrands.length > 0 && (
              <div className="absolute z-10 w-full mt-2 glass rounded-xl shadow-xl max-h-60 overflow-y-auto">
                {filteredBrands.map((brand, index) => (
                  <button
                    key={index}
                    onClick={() => handleSelectBrand(brand)}
                    className="w-full px-4 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-white/10 transition text-gray-900 dark:text-white first:rounded-t-xl last:rounded-b-xl"
                  >
                    {brand}
                  </button>
                ))}
              </div>
            )}
          </div>

          {!isBulk && (
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              Leave empty to clear the brand assignment
            </p>
          )}

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="flex items-center gap-3 pt-4">
            <button
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="btn-primary flex-1"
              disabled={saving}
            >
              {saving ? 'Saving...' : isBulk ? 'Assign Brand' : 'Save Brand'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
