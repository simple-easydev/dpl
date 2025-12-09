import { useEffect, useState } from 'react';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Search, Package, DollarSign, ShoppingCart, Info, CheckSquare, Square, GitMerge, Edit2, Settings, Tag } from 'lucide-react';
import { format } from 'date-fns';
import MergeProductsModal from '../components/MergeProductsModal';
import ProductPackageManager from '../components/ProductPackageManager';
import EditProductBrandModal from '../components/EditProductBrandModal';
import { updateAggregatedData } from '../lib/dataProcessor';
import { updateDefaultFOBPrice, calculateFOBRevenueFromBottles, PackageType } from '../lib/fobPricingService';

interface Product {
  id: string;
  product_name: string;
  brand: string | null;
  total_revenue: number;
  total_units: number;
  total_orders: number;
  average_price: number;
  first_sale_date: string;
  last_sale_date: string;
  default_fob_price: number | null;
  default_case_size: number | null;
  available_package_types: PackageType[];
  default_package_type: PackageType;
  fob_revenue?: number;
  organization_id?: string;
  organization_name?: string;
}

export default function ProductsPage() {
  const { currentOrganization, isViewingAllBrands } = useOrganization();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [editingFOBPrice, setEditingFOBPrice] = useState<string | null>(null);
  const [fobPriceInput, setFobPriceInput] = useState('');
  const [editingProductName, setEditingProductName] = useState<string | null>(null);
  const [productNameInput, setProductNameInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [packageManagerProduct, setPackageManagerProduct] = useState<Product | null>(null);
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [brandModalProducts, setBrandModalProducts] = useState<Product[]>([]);
  const [isBulkBrandAssignment, setIsBulkBrandAssignment] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      if (!currentOrganization && !isViewingAllBrands) return;

      setLoading(true);

      let query = supabase
        .from('products')
        .select('*, organizations(name)');

      if (currentOrganization) {
        query = query.eq('organization_id', currentOrganization.id);
      }

      const { data, error } = await query.order('total_revenue', { ascending: false });

      if (!error && data) {
        const productsWithFOB = await Promise.all(
          data.map(async (product: any) => {
            const orgId = product.organization_id;
            let fobRevenue = 0;

            if (product.default_fob_price !== null && orgId) {
              const bottlesPerCase = product.default_case_size || 6;
              fobRevenue = await calculateFOBRevenueFromBottles(
                orgId,
                product.id,
                Number(product.total_units),
                bottlesPerCase
              ) || 0;
            }

            return {
              ...product,
              fob_revenue: fobRevenue,
              organization_name: product.organizations?.name || 'Unknown',
            } as Product;
          })
        );
        setProducts(productsWithFOB);
        setFilteredProducts(productsWithFOB);
      }
      setLoading(false);
    };

    fetchProducts();
  }, [currentOrganization, isViewingAllBrands]);

  useEffect(() => {
    let filtered = products;

    if (searchTerm) {
      filtered = filtered.filter((product) =>
        product.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.brand && product.brand.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (selectedBrands.size > 0) {
      filtered = filtered.filter((product) =>
        product.brand && selectedBrands.has(product.brand)
      );
    }

    setFilteredProducts(filtered);
  }, [searchTerm, products, selectedBrands]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  const totalProducts = products.length;
  const totalRevenue = products.reduce((sum, p) => sum + Number(p.total_revenue), 0);
  const totalCases = products.reduce((sum, p) => {
    const caseSize = p.default_case_size || 6;
    return sum + (Number(p.total_units) / caseSize);
  }, 0);

  const toggleProductSelection = (productId: string) => {
    const newSelection = new Set(selectedProductIds);
    if (newSelection.has(productId)) {
      newSelection.delete(productId);
    } else {
      newSelection.add(productId);
    }
    setSelectedProductIds(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedProductIds.size === filteredProducts.length) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedProductIds(new Set());
  };

  const handleOpenMergeModal = () => {
    if (selectedProductIds.size < 2) {
      alert('Please select at least 2 products to merge');
      return;
    }
    if (selectedProductIds.size > 20) {
      alert('Cannot merge more than 20 products at once');
      return;
    }
    setIsMergeModalOpen(true);
  };

  const handleMergeComplete = async () => {
    if (!currentOrganization) return;

    console.log('🔄 Regenerating products aggregation after merge...');
    await updateAggregatedData(currentOrganization.id);
    console.log('✅ Products table updated successfully');

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('organization_id', currentOrganization.id)
      .order('total_revenue', { ascending: false });

    if (!error && data) {
      setProducts(data);
      setFilteredProducts(data);
    }

    setSelectedProductIds(new Set());
  };

  const selectedProducts = products.filter(p => selectedProductIds.has(p.id));
  const selectedRevenue = selectedProducts.reduce((sum, p) => sum + Number(p.total_revenue), 0);

  const handleEditFOBPrice = (productId: string, currentPrice: number | null) => {
    setEditingFOBPrice(productId);
    setFobPriceInput(currentPrice !== null ? currentPrice.toString() : '');
  };

  const handleSaveFOBPrice = async (productId: string) => {
    if (!currentOrganization) return;

    const price = fobPriceInput === '' ? null : parseFloat(fobPriceInput);
    if (price !== null && (isNaN(price) || price < 0)) {
      alert('Please enter a valid price');
      return;
    }

    const success = await updateDefaultFOBPrice(currentOrganization.id, productId, price);
    if (success) {
      setEditingFOBPrice(null);
      setFobPriceInput('');

      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('total_revenue', { ascending: false });

      if (data) {
        const productsWithFOB = await Promise.all(
          data.map(async (product: any) => {
            if (product.default_fob_price !== null) {
              const bottlesPerCase = product.default_case_size || 6;
              const fobRevenue = await calculateFOBRevenueFromBottles(
                currentOrganization.id,
                product.id,
                Number(product.total_units),
                bottlesPerCase
              );
              return { ...product, fob_revenue: fobRevenue || 0 } as Product;
            }
            return { ...product, fob_revenue: 0 } as Product;
          })
        );
        setProducts(productsWithFOB);
        setFilteredProducts(productsWithFOB);
      }
    } else {
      alert('Failed to update FOB price');
    }
  };

  const handleCancelFOBEdit = () => {
    setEditingFOBPrice(null);
    setFobPriceInput('');
  };

  const handleEditProductName = (productId: string, currentName: string) => {
    setEditingProductName(productId);
    setProductNameInput(currentName);
  };

  const handleSaveProductName = async (productId: string, oldProductName: string) => {
    if (!currentOrganization) return;

    const newName = productNameInput.trim();
    if (!newName) {
      alert('Product name cannot be empty');
      return;
    }

    if (newName === oldProductName) {
      setEditingProductName(null);
      setProductNameInput('');
      return;
    }

    const existingProduct = products.find(p => p.product_name.toLowerCase() === newName.toLowerCase() && p.id !== productId);
    if (existingProduct) {
      alert('A product with this name already exists. Please use the merge feature to combine products.');
      return;
    }

    setSaving(true);
    try {
      const { error: salesUpdateError } = await supabase
        .from('sales_data')
        .update({ product_name: newName })
        .eq('organization_id', currentOrganization.id)
        .eq('product_name', oldProductName);

      if (salesUpdateError) throw salesUpdateError;

      console.log('🔄 Regenerating products aggregation after name change...');
      await updateAggregatedData(currentOrganization.id);
      console.log('✅ Products table updated successfully');

      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .order('total_revenue', { ascending: false });

      if (data) {
        const productsWithFOB = await Promise.all(
          data.map(async (product: any) => {
            if (product.default_fob_price !== null) {
              const bottlesPerCase = product.default_case_size || 6;
              const fobRevenue = await calculateFOBRevenueFromBottles(
                currentOrganization.id,
                product.id,
                Number(product.total_units),
                bottlesPerCase
              );
              return { ...product, fob_revenue: fobRevenue || 0 } as Product;
            }
            return { ...product, fob_revenue: 0 } as Product;
          })
        );
        setProducts(productsWithFOB);
        setFilteredProducts(productsWithFOB);
      }

      setEditingProductName(null);
      setProductNameInput('');
    } catch (error) {
      console.error('Failed to update product name:', error);
      alert('Failed to update product name. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelProductNameEdit = () => {
    setEditingProductName(null);
    setProductNameInput('');
  };

  const handleEditBrand = (product: Product) => {
    setBrandModalProducts([product]);
    setIsBulkBrandAssignment(false);
    setIsBrandModalOpen(true);
  };

  const handleBulkBrandAssignment = () => {
    if (selectedProductIds.size === 0) {
      alert('Please select at least one product');
      return;
    }
    const selected = products.filter(p => selectedProductIds.has(p.id));
    setBrandModalProducts(selected);
    setIsBulkBrandAssignment(true);
    setIsBrandModalOpen(true);
  };

  const handleBrandUpdateSuccess = async () => {
    if (!currentOrganization) return;

    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('organization_id', currentOrganization.id)
      .order('total_revenue', { ascending: false });

    if (data) {
      const productsWithFOB = await Promise.all(
        data.map(async (product: any) => {
          if (product.default_fob_price !== null) {
            const bottlesPerCase = product.default_case_size || 6;
            const fobRevenue = await calculateFOBRevenueFromBottles(
              currentOrganization.id,
              product.id,
              Number(product.total_units),
              bottlesPerCase
            );
            return { ...product, fob_revenue: fobRevenue || 0 } as Product;
          }
          return { ...product, fob_revenue: 0 } as Product;
        })
      );
      setProducts(productsWithFOB);
      setFilteredProducts(productsWithFOB);
    }

    if (isBulkBrandAssignment) {
      setSelectedProductIds(new Set());
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-4">Product Performance</h1>

        <div className="space-y-3">
          {isViewingAllBrands && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
              <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Viewing All Brands</h3>
                <p className="text-sm text-gray-600 dark:text-zinc-400">
                  You are viewing products across all organizations. Product editing, merging, and package management are disabled in this view. Select a specific organization from the dropdown to enable editing features.
                </p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Understanding Your Metrics</h3>
              <p className="text-sm text-gray-600 dark:text-zinc-400">
                All quantities are displayed in cases. A standard case contains 6 bottles unless specified otherwise. The Case FOB price is the price per case, and FOB Revenue is calculated as: (Case FOB ÷ 6 bottles) × Bottles Sold.
              </p>
            </div>
          </div>
          {!isViewingAllBrands && (
            <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Manual Product Merging</h3>
                <p className="text-sm text-gray-600 dark:text-zinc-400">
                  Use the checkboxes to select products you want to merge together. Once you've selected 2 or more products, click the "Merge Products" button to combine them into a single product.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="glass-card rounded-2xl p-6 glow-hover-blue">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wide">Total Products</span>
            <div className="rounded-xl p-2 bg-gradient-blue shadow-glow-blue">
              <Package className="w-5 h-5 text-white" />
            </div>
          </div>
          <span className="text-3xl font-semibold text-gray-900 dark:text-white">{totalProducts}</span>
        </div>

        <div className="glass-card rounded-2xl p-6 glow-hover-teal">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wide">Total Revenue</span>
            <div className="rounded-xl p-2 bg-gradient-teal shadow-glow-teal">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
          </div>
          <span className="text-3xl font-semibold text-gray-900 dark:text-white">
            ${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>

        <div className="glass-card rounded-2xl p-6 glow-hover-purple">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wide">Cases Sold</span>
            <div className="rounded-xl p-2 bg-gradient-orange">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
          </div>
          <span className="text-3xl font-semibold text-gray-900 dark:text-white">
            {totalCases.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div className="glass-card rounded-2xl glow-hover-blue">
        <div className="p-6 border-b border-gray-200 dark:border-white/10 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-zinc-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search products by name or brand..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 glass rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-400 focus-ring"
            />
          </div>
          {(() => {
            const uniqueBrands = Array.from(new Set(products.map(p => p.brand).filter((b): b is string => b !== null))).sort();
            if (uniqueBrands.length > 0) {
              return (
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-sm font-semibold text-gray-600 dark:text-zinc-400">Filter by Brand:</span>
                  {uniqueBrands.map((brand) => (
                    <button
                      key={brand}
                      onClick={() => {
                        const newSelection = new Set(selectedBrands);
                        if (newSelection.has(brand)) {
                          newSelection.delete(brand);
                        } else {
                          newSelection.add(brand);
                        }
                        setSelectedBrands(newSelection);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                        selectedBrands.has(brand)
                          ? 'bg-accent-primary text-white'
                          : 'glass hover:bg-gray-100 dark:hover:bg-white/10 text-gray-700 dark:text-zinc-300'
                      }`}
                    >
                      {brand}
                    </button>
                  ))}
                  {selectedBrands.size > 0 && (
                    <button
                      onClick={() => setSelectedBrands(new Set())}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium glass hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition"
                    >
                      Clear Filters ({selectedBrands.size})
                    </button>
                  )}
                </div>
              );
            }
            return null;
          })()}
        </div>

        {filteredProducts.length === 0 ? (
          <div className="p-8 text-center text-gray-600 dark:text-zinc-400">
            {searchTerm ? 'No products found matching your search.' : 'No product data available.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 dark:border-white/10">
                <tr>
                  {!isViewingAllBrands && (
                    <th className="px-3 py-3 text-left">
                      <button
                        onClick={handleSelectAll}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded transition"
                        title={selectedProductIds.size === filteredProducts.length ? 'Deselect All' : 'Select All'}
                      >
                        {selectedProductIds.size === filteredProducts.length ? (
                          <CheckSquare className="w-5 h-5 text-accent-primary" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400 dark:text-zinc-400" />
                        )}
                      </button>
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
                    Product Name
                  </th>
                  {isViewingAllBrands && (
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
                      Organization
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
                    Brand
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
                    Case FOB (6 btl)
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
                    Sales Revenue
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
                    FOB Revenue
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
                    Cases Sold
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
                    Orders
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
                    Avg Price
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
                    Last Sale
                  </th>
                  {!isViewingAllBrands && (
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
                      Packages
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {filteredProducts.map((product) => (
                  <tr
                    key={product.id}
                    className={`transition ${
                      selectedProductIds.has(product.id)
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-white/5'
                    }`}
                  >
                    {!isViewingAllBrands && (
                      <td className="px-3 py-4">
                        <button
                          onClick={() => toggleProductSelection(product.id)}
                          className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded transition"
                        >
                          {selectedProductIds.has(product.id) ? (
                            <CheckSquare className="w-5 h-5 text-accent-primary" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-400 dark:text-zinc-400" />
                          )}
                        </button>
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {isViewingAllBrands ? (
                        <span className="font-semibold text-gray-900 dark:text-white">{product.product_name}</span>
                      ) : editingProductName === product.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={productNameInput}
                            onChange={(e) => setProductNameInput(e.target.value)}
                            className="w-64 px-2 py-1 border border-blue-500 rounded text-sm text-gray-900 dark:text-white glass"
                            autoFocus
                            disabled={saving}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveProductName(product.id, product.product_name);
                              if (e.key === 'Escape') handleCancelProductNameEdit();
                            }}
                          />
                          <button
                            onClick={() => handleSaveProductName(product.id, product.product_name)}
                            disabled={saving}
                            className="text-green-600 hover:text-green-700 text-xs disabled:opacity-50"
                          >
                            {saving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={handleCancelProductNameEdit}
                            disabled={saving}
                            className="text-gray-600 hover:text-gray-700 text-xs disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEditProductName(product.id, product.product_name)}
                          className="group flex items-center gap-2 hover:text-blue-600 transition"
                        >
                          <span className="font-semibold text-gray-900 dark:text-white">{product.product_name}</span>
                          <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                        </button>
                      )}
                    </td>
                    {isViewingAllBrands && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-gray-700 dark:text-zinc-300">{product.organization_name}</span>
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {isViewingAllBrands ? (
                        <span className="text-gray-700 dark:text-zinc-300">
                          {product.brand || '-'}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleEditBrand(product)}
                          className="group flex items-center gap-2 hover:text-blue-600 transition"
                        >
                          <span className="text-gray-700 dark:text-zinc-300">
                            {product.brand || '-'}
                          </span>
                          <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {isViewingAllBrands ? (
                        <span className="text-gray-900 dark:text-white font-semibold">
                          {product.default_fob_price !== null
                            ? `$${Number(product.default_fob_price).toFixed(2)}`
                            : '-'}
                        </span>
                      ) : editingFOBPrice === product.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={fobPriceInput}
                            onChange={(e) => setFobPriceInput(e.target.value)}
                            className="w-24 px-2 py-1 border border-blue-500 rounded text-sm text-right text-gray-900 dark:text-white glass"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveFOBPrice(product.id);
                              if (e.key === 'Escape') handleCancelFOBEdit();
                            }}
                          />
                          <button
                            onClick={() => handleSaveFOBPrice(product.id)}
                            className="text-green-600 hover:text-green-700 text-xs"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelFOBEdit}
                            className="text-gray-600 hover:text-gray-700 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEditFOBPrice(product.id, product.default_fob_price)}
                          className="group flex items-center justify-end gap-2 w-full hover:text-blue-600 transition"
                        >
                          <span className="text-gray-900 dark:text-white font-semibold">
                            {product.default_fob_price !== null
                              ? `$${Number(product.default_fob_price).toFixed(2)}`
                              : '-'}
                          </span>
                          <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-900 dark:text-white font-semibold">
                      ${Number(product.total_revenue).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700 dark:text-zinc-300 font-semibold">
                      {product.fob_revenue !== undefined && product.default_fob_price !== null
                        ? `$${product.fob_revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                        : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700 dark:text-zinc-300">
                      {(Number(product.total_units) / (product.default_case_size || 6)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700 dark:text-zinc-300">
                      {product.total_orders}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700 dark:text-zinc-300">
                      ${Number(product.average_price).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600 dark:text-zinc-400 text-sm">
                      {product.last_sale_date ? format(new Date(product.last_sale_date), 'MMM dd, yyyy') : '-'}
                    </td>
                    {!isViewingAllBrands && (
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => setPackageManagerProduct(product)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition"
                          title="Manage package types"
                        >
                          <Settings className="w-3.5 h-3.5" />
                          {product.available_package_types?.length || 1}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedProductIds.size > 0 && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-40">
          <div className="glass-card rounded-2xl shadow-2xl px-6 py-4 flex items-center gap-6">
            <div className="flex items-center gap-4">
              <div>
                <div className="text-sm text-gray-600 dark:text-zinc-400">Selected Products</div>
                <div className="text-2xl font-semibold text-gray-900 dark:text-white">{selectedProductIds.size}</div>
              </div>
              <div className="h-12 w-px bg-gray-200 dark:bg-white/10"></div>
              <div>
                <div className="text-sm text-gray-600 dark:text-zinc-400">Combined Revenue</div>
                <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                  ${selectedRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleClearSelection}
                className="btn-secondary"
              >
                Clear
              </button>
              <button
                onClick={handleBulkBrandAssignment}
                className="btn-secondary flex items-center gap-2"
              >
                <Tag className="w-4 h-4" />
                Assign Brand
              </button>
              <button
                onClick={handleOpenMergeModal}
                disabled={selectedProductIds.size < 2}
                className="btn-primary flex items-center gap-2"
              >
                <GitMerge className="w-4 h-4" />
                Merge Products
              </button>
            </div>
          </div>
        </div>
      )}

      {currentOrganization && (
        <>
          <MergeProductsModal
            isOpen={isMergeModalOpen}
            onClose={() => setIsMergeModalOpen(false)}
            selectedProducts={selectedProducts}
            organizationId={currentOrganization.id}
            onMergeComplete={handleMergeComplete}
          />
          <EditProductBrandModal
            isOpen={isBrandModalOpen}
            onClose={() => setIsBrandModalOpen(false)}
            products={brandModalProducts}
            organizationId={currentOrganization.id}
            onSuccess={handleBrandUpdateSuccess}
            isBulk={isBulkBrandAssignment}
          />
          {packageManagerProduct && (
            <ProductPackageManager
              isOpen={true}
              onClose={() => setPackageManagerProduct(null)}
              product={packageManagerProduct}
              organizationId={currentOrganization.id}
              onSave={async () => {
                console.log('🔄 Refreshing products after package type update...');
                const { data } = await supabase
                  .from('products')
                  .select('*')
                  .eq('organization_id', currentOrganization.id)
                  .order('total_revenue', { ascending: false });

                if (data) {
                  const productsWithFOB = await Promise.all(
                    data.map(async (product: any) => {
                      if (product.default_fob_price !== null) {
                        const bottlesPerCase = product.default_case_size || 6;
                        const fobRevenue = await calculateFOBRevenueFromBottles(
                          currentOrganization.id,
                          product.id,
                          Number(product.total_units),
                          bottlesPerCase
                        );
                        return { ...product, fob_revenue: fobRevenue || 0 } as Product;
                      }
                      return { ...product, fob_revenue: 0 } as Product;
                    })
                  );
                  console.log('✅ Products refreshed successfully');
                  setProducts(productsWithFOB);
                  setFilteredProducts(productsWithFOB);

                  const updatedProduct = productsWithFOB.find((p: Product) => p.id === packageManagerProduct.id);
                  if (updatedProduct) {
                    setPackageManagerProduct(updatedProduct);
                  }
                }
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
