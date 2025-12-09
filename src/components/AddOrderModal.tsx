import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useOrganization } from '../contexts/OrganizationContext';
import { format } from 'date-fns';
import { PackageType, PACKAGE_TYPE_LABELS, BOTTLES_PER_PACKAGE } from '../lib/fobPricingService';
import { classifyAccountPremiseType } from '../lib/premiseClassificationService';

interface AddOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface DropdownOption {
  value: string;
  label: string;
}

interface Distributor {
  id: string;
  name: string;
  active: boolean;
  state?: string;
}

interface Product {
  id: string;
  product_name: string;
  default_case_size: number;
  available_package_types: PackageType[];
  default_package_type: PackageType;
}

interface ProductLineItem {
  id: string;
  productName: string;
  quantity: string;
  packageType: PackageType;
  revenue: string;
  unitPrice: string;
  brand: string;
}

export default function AddOrderModal({ isOpen, onClose, onSuccess }: AddOrderModalProps) {
  const { currentOrganization } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [distributorStateMap, setDistributorStateMap] = useState<Map<string, string>>(new Map());
  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<DropdownOption[]>([]);
  const [representatives, setRepresentatives] = useState<DropdownOption[]>([]);
  const [brands, setBrands] = useState<DropdownOption[]>([]);

  const [orderData, setOrderData] = useState({
    orderId: '',
    orderDate: format(new Date(), 'yyyy-MM-dd'),
    dateOfSale: format(new Date(), 'yyyy-MM-dd'),
    accountName: '',
    distributorName: '',
    representative: '',
  });

  const [productLineItems, setProductLineItems] = useState<ProductLineItem[]>([
    {
      id: crypto.randomUUID(),
      productName: '',
      quantity: '',
      packageType: 'case_6',
      revenue: '',
      unitPrice: '',
      brand: '',
    },
  ]);

  const [showNewAccount, setShowNewAccount] = useState(false);
  const [showNewRepresentative, setShowNewRepresentative] = useState(false);

  useEffect(() => {
    if (isOpen && currentOrganization) {
      fetchDropdownData();
    }
  }, [isOpen, currentOrganization]);

  const fetchDropdownData = async () => {
    if (!currentOrganization) return;

    // Fetch added distributors (via junction table) and organization-specific distributors
    const [addedGlobalDistributorsRes, customDistributorsRes, productsRes, accountsRes, repsRes, brandsRes] = await Promise.all([
      supabase
        .from('organization_distributors')
        .select('distributor_id, state, distributors(id, name, active, state)')
        .eq('organization_id', currentOrganization.id),
      supabase
        .from('distributors')
        .select('id, name, active, state')
        .eq('organization_id', currentOrganization.id)
        .eq('active', true)
        .order('name'),
      supabase
        .from('products')
        .select('id, product_name, default_case_size')
        .eq('organization_id', currentOrganization.id)
        .order('product_name'),
      supabase
        .from('accounts')
        .select('account_name')
        .eq('organization_id', currentOrganization.id)
        .order('account_name'),
      supabase
        .from('sales_data')
        .select('representative')
        .eq('organization_id', currentOrganization.id)
        .not('representative', 'is', null)
        .order('representative'),
      supabase
        .from('products')
        .select('brand')
        .eq('organization_id', currentOrganization.id)
        .not('brand', 'is', null),
    ]);

    // Build distributor-to-state mapping
    const stateMap = new Map<string, string>();

    // Extract distributor objects from junction table response and filter active ones
    const addedGlobalDistributors = (addedGlobalDistributorsRes.data || [])
      .map((item: any) => {
        if (item.distributors && typeof item.distributors === 'object') {
          // Use organization-specific state override if available, otherwise use distributor's default state
          const state = item.state || item.distributors.state;
          if (state) {
            stateMap.set(item.distributors.name, state);
          }
          return item.distributors;
        }
        return null;
      })
      .filter((dist: any): dist is Distributor => dist !== null && dist.active);

    // Process custom distributors and add to state map
    const customDistributors = customDistributorsRes.data || [];
    customDistributors.forEach((dist: any) => {
      if (dist.state) {
        stateMap.set(dist.name, dist.state);
      }
    });

    // Combine added global distributors and custom distributors
    const allDistributors = [
      ...addedGlobalDistributors,
      ...customDistributors
    ];
    setDistributors(allDistributors);
    setDistributorStateMap(stateMap);

    if (productsRes.data) {
      setProducts(productsRes.data);
    }

    if (accountsRes.data) {
      const accountOptions = accountsRes.data.map(a => ({
        value: a.account_name,
        label: a.account_name,
      }));
      setAccounts(accountOptions);
    }

    if (repsRes.data) {
      const uniqueReps = Array.from(
        new Set(repsRes.data.map(r => r.representative))
      ).map(r => ({ value: r, label: r }));
      setRepresentatives(uniqueReps);
    }

    if (brandsRes.data) {
      const uniqueBrands = Array.from(
        new Set(brandsRes.data.map(b => b.brand).filter((b): b is string => b !== null))
      ).sort().map(b => ({ value: b, label: b }));
      setBrands(uniqueBrands);
    }
  };

  const calculateBottles = (quantity: string, packageType: PackageType): number => {
    const qty = parseFloat(quantity) || 0;
    return qty * BOTTLES_PER_PACKAGE[packageType];
  };

  const calculateUnitPrice = (revenue: string, bottles: number): string => {
    const rev = parseFloat(revenue) || 0;
    if (bottles <= 0 || rev <= 0) return '';
    return (rev / bottles).toFixed(2);
  };

  const updateLineItem = (id: string, field: keyof ProductLineItem, value: string | number) => {
    setProductLineItems(items =>
      items.map(item => {
        if (item.id !== id) return item;

        const updatedItem = { ...item, [field]: value };

        if (field === 'productName' && typeof value === 'string') {
          const product = products.find(p => p.product_name === value);
          if (product) {
            updatedItem.packageType = product.default_package_type || 'case_6';
          }
        }

        const bottles = BOTTLES_PER_PACKAGE[updatedItem.packageType] * Number(updatedItem.quantity || 0);
        updatedItem.unitPrice = calculateUnitPrice(updatedItem.revenue, bottles);

        return updatedItem;
      })
    );
  };

  const addProductLine = () => {
    setProductLineItems([
      ...productLineItems,
      {
        id: crypto.randomUUID(),
        productName: '',
        quantity: '',
        packageType: 'case_6',
        revenue: '',
        unitPrice: '',
        brand: '',
      },
    ]);
  };

  const removeProductLine = (id: string) => {
    if (productLineItems.length === 1) return;
    setProductLineItems(items => items.filter(item => item.id !== id));
  };

  const calculateTotalRevenue = (): number => {
    return productLineItems.reduce((sum, item) => {
      return sum + (parseFloat(item.revenue) || 0);
    }, 0);
  };

  const calculateTotalBottles = (): number => {
    return productLineItems.reduce((sum, item) => {
      return sum + calculateBottles(item.quantity, item.packageType);
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization) return;

    setError(null);
    setLoading(true);

    if (!orderData.accountName) {
      setError('Account name is required');
      setLoading(false);
      return;
    }

    if (!orderData.distributorName) {
      setError('Distributor is required');
      setLoading(false);
      return;
    }

    const validLineItems = productLineItems.filter(
      item => item.productName && item.quantity && item.revenue
    );

    if (validLineItems.length === 0) {
      setError('At least one product with quantity and revenue is required');
      setLoading(false);
      return;
    }

    for (const item of validLineItems) {
      const quantity = parseFloat(item.quantity);
      const revenue = parseFloat(item.revenue);

      if (isNaN(quantity) || quantity <= 0) {
        setError(`Quantity must be a positive number for ${item.productName}`);
        setLoading(false);
        return;
      }

      if (isNaN(revenue) || revenue < 0) {
        setError(`Revenue must be a valid number (0 or greater) for ${item.productName}`);
        setLoading(false);
        return;
      }

      if (!item.revenue || item.revenue.trim() === '') {
        setError(`Revenue is required for ${item.productName}`);
        setLoading(false);
        return;
      }
    }

    // Look up the distributor's state from the mapping
    const distributorState = distributorStateMap.get(orderData.distributorName) || null;

    const salesDataRecords = validLineItems.map(item => {
      const bottles = calculateBottles(item.quantity, item.packageType);
      const revenue = parseFloat(item.revenue);
      const unitPrice = parseFloat(item.unitPrice) || revenue / bottles;

      return {
        organization_id: currentOrganization.id,
        upload_id: null,
        order_id: orderData.orderId || null,
        order_date: orderData.orderDate,
        date_of_sale: orderData.dateOfSale || orderData.orderDate,
        account_name: orderData.accountName,
        product_name: item.productName,
        quantity: parseFloat(item.quantity),
        package_type: item.packageType,
        bottles_per_unit: BOTTLES_PER_PACKAGE[item.packageType],
        quantity_unit: item.packageType.includes('case') ? 'cases' : (item.packageType === 'barrel' ? 'barrel' : 'bottles'),
        case_size: item.packageType.includes('case') ? BOTTLES_PER_PACKAGE[item.packageType] : null,
        quantity_in_bottles: bottles,
        revenue: revenue,
        unit_price: unitPrice,
        category: null,
        region: null,
        distributor: orderData.distributorName,
        account_state: distributorState,
        representative: orderData.representative || null,
        brand: item.brand || null,
        has_revenue_data: true,
      };
    });

    const { error: insertError } = await supabase
      .from('sales_data')
      .insert(salesDataRecords);

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    // Calculate order totals for account management
    const orderTotalRevenue = validLineItems.reduce(
      (sum, item) => sum + parseFloat(item.revenue),
      0
    );
    const orderTotalCases = validLineItems.reduce(
      (sum, item) => sum + parseFloat(item.quantity),
      0
    );

    // Check if account exists and get its current metrics
    const { data: existingAccount } = await supabase
      .from('accounts')
      .select('id, total_revenue, total_orders, first_order_date, premise_type, state')
      .eq('organization_id', currentOrganization.id)
      .eq('account_name', orderData.accountName)
      .maybeSingle();

    // Prepare account data
    const accountData = {
      organization_id: currentOrganization.id,
      account_name: orderData.accountName,
      total_revenue: existingAccount
        ? Number(existingAccount.total_revenue) + orderTotalRevenue
        : orderTotalRevenue,
      total_orders: existingAccount ? existingAccount.total_orders + 1 : 1,
      first_order_date: existingAccount?.first_order_date || orderData.orderDate,
      last_order_date: orderData.orderDate,
      average_order_value: existingAccount
        ? (Number(existingAccount.total_revenue) + orderTotalRevenue) / (existingAccount.total_orders + 1)
        : orderTotalRevenue,
      premise_type: existingAccount?.premise_type || 'unclassified',
      state: existingAccount?.state || distributorState,
      updated_at: new Date().toISOString(),
    };

    // Upsert account record
    const { error: accountError } = await supabase
      .from('accounts')
      .upsert(accountData, {
        onConflict: 'organization_id,account_name',
      });

    if (accountError) {
      console.error('Error creating/updating account:', accountError);
    }

    // Classify premise type if needed
    const shouldClassify = !existingAccount || existingAccount.premise_type === 'unclassified';
    if (shouldClassify) {
      try {
        const classification = await classifyAccountPremiseType(
          orderData.accountName,
          currentOrganization.id
        );

        await supabase
          .from('accounts')
          .update({
            premise_type: classification.premise_type,
            premise_type_confidence: classification.confidence,
            premise_type_updated_at: new Date().toISOString()
          })
          .eq('organization_id', currentOrganization.id)
          .eq('account_name', orderData.accountName);
      } catch (err) {
        console.error('Error classifying account:', err);
      }
    }

    setLoading(false);
    resetForm();
    onSuccess();
    onClose();
  };

  const resetForm = () => {
    setOrderData({
      orderId: '',
      orderDate: format(new Date(), 'yyyy-MM-dd'),
      dateOfSale: format(new Date(), 'yyyy-MM-dd'),
      accountName: '',
      distributorName: '',
      representative: '',
    });
    setProductLineItems([
      {
        id: crypto.randomUUID(),
        productName: '',
        quantity: '',
        packageType: 'case_6',
        revenue: '',
        unitPrice: '',
        brand: '',
      },
    ]);
    setShowNewAccount(false);
    setShowNewRepresentative(false);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  const totalRevenue = calculateTotalRevenue();
  const totalBottles = calculateTotalBottles();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="relative glass-card rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 glass-card rounded-t-2xl border-b border-gray-200 dark:border-white/10 p-6 flex justify-between items-center z-10">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Add Order</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-zinc-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Order Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                  Order Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={orderData.orderDate}
                  onChange={(e) => setOrderData({ ...orderData, orderDate: e.target.value })}
                  className="w-full px-4 py-2.5 glass rounded-xl text-gray-900 dark:text-white focus-ring"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                  Date of Sale
                </label>
                <input
                  type="date"
                  value={orderData.dateOfSale}
                  onChange={(e) => setOrderData({ ...orderData, dateOfSale: e.target.value })}
                  className="w-full px-4 py-2.5 glass rounded-xl text-gray-900 dark:text-white focus-ring"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                  Order ID
                </label>
                <input
                  type="text"
                  value={orderData.orderId}
                  onChange={(e) => setOrderData({ ...orderData, orderId: e.target.value })}
                  placeholder="Optional"
                  className="w-full px-4 py-2.5 glass rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-400 focus-ring"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                  Account Name <span className="text-red-500">*</span>
                </label>
                {showNewAccount ? (
                  <input
                    type="text"
                    value={orderData.accountName}
                    onChange={(e) => setOrderData({ ...orderData, accountName: e.target.value })}
                    placeholder="Enter new account name"
                    className="w-full px-4 py-2.5 glass rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-400 focus-ring"
                    required
                  />
                ) : (
                  <select
                    value={orderData.accountName}
                    onChange={(e) => {
                      if (e.target.value === '__new__') {
                        setShowNewAccount(true);
                        setOrderData({ ...orderData, accountName: '' });
                      } else {
                        setOrderData({ ...orderData, accountName: e.target.value });
                      }
                    }}
                    className="w-full px-4 py-2.5 glass rounded-xl text-gray-900 dark:text-white focus-ring appearance-none"
                    required
                  >
                    <option value="">Select account...</option>
                    {accounts.map((account) => (
                      <option key={account.value} value={account.value}>
                        {account.label}
                      </option>
                    ))}
                    <option value="__new__">+ Add New Account</option>
                  </select>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-white/10 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Distributor & Representative</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                  Distributor <span className="text-red-500">*</span>
                </label>
                <select
                  value={orderData.distributorName}
                  onChange={(e) => setOrderData({ ...orderData, distributorName: e.target.value })}
                  className="w-full px-4 py-2.5 glass rounded-xl text-gray-900 dark:text-white focus-ring appearance-none"
                  required
                >
                  <option value="">Select distributor...</option>
                  {distributors.map((dist) => (
                    <option key={dist.id} value={dist.name}>
                      {dist.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                  Representative
                </label>
                {showNewRepresentative ? (
                  <input
                    type="text"
                    value={orderData.representative}
                    onChange={(e) => setOrderData({ ...orderData, representative: e.target.value })}
                    placeholder="Enter new representative"
                    className="w-full px-4 py-2.5 glass rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-400 focus-ring"
                  />
                ) : (
                  <select
                    value={orderData.representative}
                    onChange={(e) => {
                      if (e.target.value === '__new__') {
                        setShowNewRepresentative(true);
                        setOrderData({ ...orderData, representative: '' });
                      } else {
                        setOrderData({ ...orderData, representative: e.target.value });
                      }
                    }}
                    className="w-full px-4 py-2.5 glass rounded-xl text-gray-900 dark:text-white focus-ring appearance-none"
                  >
                    <option value="">Select representative...</option>
                    {representatives.map((rep) => (
                      <option key={rep.value} value={rep.value}>
                        {rep.label}
                      </option>
                    ))}
                    <option value="__new__">+ Add New Representative</option>
                  </select>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-white/10 pt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Products</h3>
              <button
                type="button"
                onClick={addProductLine}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
              >
                <Plus className="w-4 h-4" />
                Add Product
              </button>
            </div>

            <div className="space-y-4">
              {productLineItems.map((item, index) => {
                const bottles = calculateBottles(item.quantity, item.packageType);
                return (
                  <div
                    key={item.id}
                    className="p-4 glass rounded-xl border border-gray-200 dark:border-white/10 space-y-4"
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-semibold text-gray-600 dark:text-zinc-400">
                        Product {index + 1}
                      </span>
                      {productLineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeProductLine(item.id)}
                          className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                          Product Name <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={item.productName}
                          onChange={(e) => updateLineItem(item.id, 'productName', e.target.value)}
                          className="w-full px-4 py-2.5 glass rounded-xl text-gray-900 dark:text-white focus-ring appearance-none"
                          required
                        >
                          <option value="">Select product...</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.product_name}>
                              {product.product_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                          Brand
                        </label>
                        <select
                          value={item.brand}
                          onChange={(e) => updateLineItem(item.id, 'brand', e.target.value)}
                          className="w-full px-4 py-2.5 glass rounded-xl text-gray-900 dark:text-white focus-ring appearance-none"
                        >
                          <option value="">Select brand (optional)...</option>
                          {brands.map((brand) => (
                            <option key={brand.value} value={brand.value}>
                              {brand.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                          Quantity (Cases) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(item.id, 'quantity', e.target.value)}
                          placeholder="0"
                          className="w-full px-4 py-2.5 glass rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-400 focus-ring"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                          Package Type <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={item.packageType}
                          onChange={(e) => updateLineItem(item.id, 'packageType', e.target.value)}
                          className="w-full px-4 py-2.5 glass rounded-xl text-gray-900 dark:text-white focus-ring"
                          required
                        >
                          {Object.entries(PACKAGE_TYPE_LABELS).map(([type, label]) => (
                            <option key={type} value={type}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>


                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                          Revenue <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={item.revenue}
                          onChange={(e) => updateLineItem(item.id, 'revenue', e.target.value)}
                          placeholder="0.00"
                          className="w-full px-4 py-2.5 glass rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-400 focus-ring"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                          Unit Price (per bottle)
                        </label>
                        <input
                          type="text"
                          value={item.unitPrice}
                          readOnly
                          placeholder="Auto-calculated"
                          className="w-full px-4 py-2.5 glass rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-400 bg-gray-50 dark:bg-white/5 cursor-not-allowed"
                        />
                      </div>
                    </div>

                    {item.quantity && bottles > 0 && (
                      <div className="text-sm text-gray-600 dark:text-zinc-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg">
                        = {bottles} bottles ({BOTTLES_PER_PACKAGE[item.packageType]} bottles per {PACKAGE_TYPE_LABELS[item.packageType]})
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {productLineItems.length > 1 && (
            <div className="border-t border-gray-200 dark:border-white/10 pt-6">
              <div className="glass rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-zinc-400">Total Bottles:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {totalBottles.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-900 dark:text-white font-semibold">Total Revenue:</span>
                  <span className="font-bold text-lg text-gray-900 dark:text-white">
                    ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-white/10">
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2.5 glass rounded-xl text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/10 transition font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/50 transition-all duration-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Add Order
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
