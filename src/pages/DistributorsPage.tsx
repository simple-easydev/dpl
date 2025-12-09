import { useEffect, useState } from 'react';
import { useOrganization } from '../contexts/OrganizationContext';
import { supabase } from '../lib/supabase';
import { Plus, CreditCard as Edit2, MapPin, Mail, Phone, Search, Globe, Building2, Trash2 } from 'lucide-react';
import AddDistributorStateModal from '../components/AddDistributorStateModal';

interface Distributor {
  id: string;
  name: string;
  state: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  active: boolean;
  is_global: boolean;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
  organization_name?: string;
}

interface DistributorStats {
  total_revenue: number;
  fob_revenue: number;
  total_orders: number;
}

type FilterTab = 'all' | 'global' | 'custom';

export default function DistributorsPage() {
  const { currentOrganization, isPlatformAdmin, isViewingAllBrands } = useOrganization();
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [stats, setStats] = useState<Record<string, DistributorStats>>({});
  const [addedGlobalDistributorIds, setAddedGlobalDistributorIds] = useState<Set<string>>(new Set());
  const [organizationDistributorStates, setOrganizationDistributorStates] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [showModal, setShowModal] = useState(false);
  const [showAddDistributorModal, setShowAddDistributorModal] = useState(false);
  const [distributorToAdd, setDistributorToAdd] = useState<Distributor | null>(null);
  const [editingDistributor, setEditingDistributor] = useState<Distributor | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    state: '',
    contact_email: '',
    contact_phone: '',
  });
  const [error, setError] = useState<string | null>(null);

  const fetchAllBrandsDistributors = async () => {
    setLoading(true);

    // Fetch all global distributors
    const { data: allGlobalData, error: globalError } = await supabase
      .from('distributors')
      .select('*')
      .eq('is_global', true)
      .order('name', { ascending: true });

    // Fetch all custom distributors from all organizations with organization names
    const { data: allCustomData, error: customError } = await supabase
      .from('distributors')
      .select('*, organizations(name)')
      .eq('is_global', false)
      .order('name', { ascending: true });

    if (globalError || customError) {
      console.error('Error fetching distributors:', globalError || customError);
      setLoading(false);
      return;
    }

    // Process custom distributors to add organization name
    const customDistributors = (allCustomData || []).map((dist: any) => ({
      ...dist,
      organization_name: dist.organizations?.name || 'Unknown'
    }));

    // Combine all distributors
    const allDistributors = [...(allGlobalData || []), ...customDistributors];

    setDistributors(allDistributors);
    setAddedGlobalDistributorIds(new Set());
    setOrganizationDistributorStates({});
    setLoading(false);

    // Fetch stats for all distributors across all organizations
    await fetchAllBrandsDistributorStats(allDistributors);
  };

  const fetchAllBrandsDistributorStats = async (distributorList: Distributor[]) => {
    if (distributorList.length === 0) return;

    setStatsLoading(true);
    const statsMap: Record<string, DistributorStats> = {};

    try {
      const distributorNames = distributorList.map(d => d.name);

      // Fetch all sales data across all organizations
      const { data: allSalesData } = await supabase
        .from('sales_data')
        .select('distributor, revenue, product_name, quantity, organization_id')
        .in('distributor', distributorNames);

      if (!allSalesData || allSalesData.length === 0) {
        distributorList.forEach(d => {
          statsMap[d.id] = { total_revenue: 0, fob_revenue: 0, total_orders: 0 };
        });
        setStats(statsMap);
        setStatsLoading(false);
        return;
      }

      // Get unique org IDs and product names for efficient queries
      const orgIds = [...new Set(allSalesData.map(s => s.organization_id))];
      const uniqueProductNames = [...new Set(allSalesData.map(s => s.product_name))];

      // Fetch all products across organizations
      const { data: allProducts } = await supabase
        .from('products')
        .select('id, product_name, default_fob_price, organization_id')
        .in('organization_id', orgIds)
        .in('product_name', uniqueProductNames);

      const productMap = new Map(
        (allProducts || []).map(p => [`${p.organization_id}_${p.product_name}`, p])
      );

      distributorList.forEach(distributor => {
        const distributorSales = allSalesData.filter(s => s.distributor === distributor.name);

        const totalRevenue = distributorSales.reduce((sum, record) =>
          sum + Number(record.revenue || 0), 0
        );

        let fobRevenue = 0;
        distributorSales.forEach(sale => {
          const productKey = `${sale.organization_id}_${sale.product_name}`;
          const product = productMap.get(productKey);
          if (product && product.default_fob_price) {
            const fobPrice = Number(product.default_fob_price);
            const cases = Number(sale.quantity) || 0;
            fobRevenue += cases * fobPrice;
          }
        });

        statsMap[distributor.id] = {
          total_revenue: totalRevenue,
          fob_revenue: fobRevenue,
          total_orders: distributorSales.length,
        };
      });

      setStats(statsMap);
    } catch (error) {
      console.error('Error fetching distributor stats:', error);
      distributorList.forEach(d => {
        statsMap[d.id] = { total_revenue: 0, fob_revenue: 0, total_orders: 0 };
      });
      setStats(statsMap);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchDistributors = async () => {
    if (!isPlatformAdmin && !currentOrganization) return;

    // Platform admin viewing all brands
    if (isPlatformAdmin && isViewingAllBrands) {
      await fetchAllBrandsDistributors();
      return;
    }

    // Regular user or platform admin viewing specific brand
    if (!currentOrganization) return;

    const [addedGlobalResult, customResult, allGlobalResult] = await Promise.all([
      supabase
        .from('organization_distributors')
        .select('distributor_id, state, distributors(*)')
        .eq('organization_id', currentOrganization.id),
      supabase
        .from('distributors')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .eq('is_global', false)
        .order('name', { ascending: true }),
      supabase
        .from('distributors')
        .select('*')
        .eq('is_global', true)
        .order('name', { ascending: true })
    ]);

    const { data: addedGlobalData, error: addedGlobalError } = addedGlobalResult;
    const { data: customData, error: customError } = customResult;
    const { data: allGlobalData, error: allGlobalError } = allGlobalResult;

    if (!addedGlobalError && !customError && !allGlobalError) {
      // Use Map for proper deduplication by distributor ID
      const distributorMap = new Map<string, Distributor>();

      // Track which global distributors are added to this organization
      const addedGlobalIds = new Set(
        (addedGlobalData || []).map(item => item.distributor_id)
      );

      // Track organization-specific states for added distributors
      const orgDistributorStates: Record<string, string> = {};
      (addedGlobalData || []).forEach(item => {
        if (item.state) {
          orgDistributorStates[item.distributor_id] = item.state;
        }
      });

      // First, add custom distributors (these belong to the organization)
      (customData || []).forEach(dist => {
        distributorMap.set(dist.id, dist);
      });

      // Then, add ALL global distributors (both added and unadded)
      // We'll mark which ones are added via the addedGlobalIds set
      (allGlobalData || []).forEach(dist => {
        distributorMap.set(dist.id, dist);
      });

      // Convert map to array for state
      const allDistributors = Array.from(distributorMap.values());

      // Calculate stats only for distributors added to this organization
      const myDistributors = allDistributors.filter(d =>
        d.organization_id === currentOrganization.id || addedGlobalIds.has(d.id)
      );

      setDistributors(allDistributors);
      setAddedGlobalDistributorIds(addedGlobalIds);
      setOrganizationDistributorStates(orgDistributorStates);
      setLoading(false);

      fetchDistributorStats(myDistributors);
    } else {
      setLoading(false);
    }
  };

  const fetchDistributorStats = async (distributorList: Distributor[]) => {
    if (!currentOrganization || distributorList.length === 0) return;

    setStatsLoading(true);
    const statsMap: Record<string, DistributorStats> = {};

    try {
      const distributorNames = distributorList.map(d => d.name);

      const { data: allSalesData } = await supabase
        .from('sales_data')
        .select('distributor, revenue, product_name, quantity')
        .eq('organization_id', currentOrganization.id)
        .in('distributor', distributorNames);

      if (!allSalesData || allSalesData.length === 0) {
        distributorList.forEach(d => {
          statsMap[d.id] = { total_revenue: 0, fob_revenue: 0, total_orders: 0 };
        });
        setStats(statsMap);
        setStatsLoading(false);
        return;
      }

      const uniqueProductNames = [...new Set(allSalesData.map(s => s.product_name))];
      const { data: allProducts } = await supabase
        .from('products')
        .select('id, product_name, default_fob_price')
        .eq('organization_id', currentOrganization.id)
        .in('product_name', uniqueProductNames);

      const productMap = new Map(
        (allProducts || []).map(p => [p.product_name, p])
      );

      const productIds = (allProducts || []).map(p => p.id);
      const distributorIds = distributorList.map(d => d.id);

      const { data: fobOverrides } = await supabase
        .from('fob_pricing_matrix')
        .select('product_id, distributor_id, fob_price_override, package_type')
        .eq('organization_id', currentOrganization.id)
        .in('product_id', productIds)
        .in('distributor_id', distributorIds)
        .eq('package_type', 'case_6');

      const fobOverrideMap = new Map<string, number>();
      (fobOverrides || []).forEach(override => {
        const key = `${override.product_id}_${override.distributor_id}`;
        fobOverrideMap.set(key, Number(override.fob_price_override));
      });

      distributorList.forEach(distributor => {
        const distributorSales = allSalesData.filter(s => s.distributor === distributor.name);

        const totalRevenue = distributorSales.reduce((sum, record) =>
          sum + Number(record.revenue || 0), 0
        );

        let fobRevenue = 0;
        distributorSales.forEach(sale => {
          const product = productMap.get(sale.product_name);
          if (product) {
            const overrideKey = `${product.id}_${distributor.id}`;
            const fobPrice = fobOverrideMap.get(overrideKey) ||
                           (product.default_fob_price ? Number(product.default_fob_price) : 0);

            if (fobPrice > 0) {
              const cases = Number(sale.quantity) || 0;
              fobRevenue += cases * fobPrice;
            }
          }
        });

        statsMap[distributor.id] = {
          total_revenue: totalRevenue,
          fob_revenue: fobRevenue,
          total_orders: distributorSales.length,
        };
      });

      setStats(statsMap);
    } catch (error) {
      console.error('Error fetching distributor stats:', error);
      distributorList.forEach(d => {
        statsMap[d.id] = { total_revenue: 0, fob_revenue: 0, total_orders: 0 };
      });
      setStats(statsMap);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchDistributors();
  }, [currentOrganization, isViewingAllBrands, isPlatformAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization) return;

    setError(null);

    try {
      if (editingDistributor) {
        // Can only edit custom distributors
        if (editingDistributor.is_global) {
          setError('Cannot edit global distributors');
          return;
        }

        const { error: updateError } = await supabase
          .from('distributors')
          .update({
            name: formData.name.trim(),
            state: formData.state.trim() || null,
            contact_email: formData.contact_email.trim() || null,
            contact_phone: formData.contact_phone.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingDistributor.id);

        if (updateError) {
          if (updateError.code === '23505') {
            setError('A distributor with this name already exists');
          } else {
            setError(updateError.message);
          }
          return;
        }
      } else {
        // Creating a new custom distributor
        const { error: insertError } = await supabase
          .from('distributors')
          .insert({
            organization_id: currentOrganization.id,
            name: formData.name.trim(),
            state: formData.state.trim() || null,
            contact_email: formData.contact_email.trim() || null,
            contact_phone: formData.contact_phone.trim() || null,
            is_global: false,
          });

        if (insertError) {
          if (insertError.code === '23505') {
            setError('A distributor with this name already exists');
          } else {
            setError(insertError.message);
          }
          return;
        }
      }

      setShowModal(false);
      setEditingDistributor(null);
      setFormData({ name: '', state: '', contact_email: '', contact_phone: '' });
      fetchDistributors();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleEdit = (distributor: Distributor) => {
    if (distributor.is_global) {
      setError('Cannot edit global distributors');
      return;
    }

    setEditingDistributor(distributor);
    setFormData({
      name: distributor.name,
      state: distributor.state || '',
      contact_email: distributor.contact_email || '',
      contact_phone: distributor.contact_phone || '',
    });
    setShowModal(true);
    setError(null);
  };

  const handleToggleActive = async (distributor: Distributor) => {
    if (distributor.is_global) {
      return; // Cannot toggle global distributors
    }

    await supabase
      .from('distributors')
      .update({
        active: !distributor.active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', distributor.id);

    fetchDistributors();
  };

  const handleAddDistributorClick = (distributor: Distributor) => {
    setDistributorToAdd(distributor);
    setShowAddDistributorModal(true);
    setError(null);
  };

  const handleAddDistributor = async (state: string) => {
    if (!currentOrganization || !distributorToAdd) return;

    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('organization_distributors')
      .insert({
        organization_id: currentOrganization.id,
        distributor_id: distributorToAdd.id,
        state: state,
        added_by: userData.user?.id,
      });

    if (!error) {
      setShowAddDistributorModal(false);
      setDistributorToAdd(null);
      fetchDistributors();
    } else {
      setError('Failed to add distributor: ' + error.message);
    }
  };

  const handleCancelAddDistributor = () => {
    setShowAddDistributorModal(false);
    setDistributorToAdd(null);
    setError(null);
  };

  const handleRemoveDistributor = async (distributor: Distributor) => {
    if (!currentOrganization) return;

    const { error } = await supabase
      .from('organization_distributors')
      .delete()
      .eq('organization_id', currentOrganization.id)
      .eq('distributor_id', distributor.id);

    if (!error) {
      fetchDistributors();
    } else {
      setError('Failed to remove distributor: ' + error.message);
    }
  };

  const handleOpenModal = () => {
    setEditingDistributor(null);
    setFormData({ name: '', state: '', contact_email: '', contact_phone: '' });
    setShowModal(true);
    setError(null);
  };

  const filteredDistributors = distributors.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.state?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.organization_name?.toLowerCase().includes(searchTerm.toLowerCase());

    // For all-brands view, show all distributors
    if (isViewingAllBrands) {
      const matchesFilter =
        filterTab === 'all' ? true :
        filterTab === 'global' ? d.is_global :
        (filterTab === 'custom' && !d.is_global);
      return matchesSearch && matchesFilter;
    }

    // Check if distributor is added to this organization
    // Custom distributors: organization_id matches
    // Global distributors: in the addedGlobalDistributorIds set
    const isAdded = d.organization_id === currentOrganization?.id ||
      addedGlobalDistributorIds.has(d.id);

    const matchesFilter =
      filterTab === 'all' ? isAdded :
      filterTab === 'global' ? (d.is_global && !isAdded) :
      (filterTab === 'custom' && !d.is_global);

    return matchesSearch && matchesFilter;
  });

  // Count only unadded global distributors for global tab
  const globalCount = isViewingAllBrands
    ? distributors.filter(d => d.is_global).length
    : distributors.filter(d => {
        const isAdded = d.organization_id === currentOrganization?.id ||
          addedGlobalDistributorIds.has(d.id);
        return d.is_global && !isAdded;
      }).length;

  // Count only custom distributors
  const customCount = distributors.filter(d => !d.is_global).length;

  // Count added distributors (both global and custom)
  const addedCount = isViewingAllBrands
    ? distributors.length
    : distributors.filter(d => {
        const isAdded = d.organization_id === currentOrganization?.id ||
          addedGlobalDistributorIds.has(d.id);
        return isAdded;
      }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Distributors</h1>
          <p className="text-gray-600 dark:text-zinc-400 mt-1">
            {isViewingAllBrands
              ? 'View all sales distribution partners across all brands'
              : 'Manage your sales distribution partners'}
          </p>
        </div>
        {!isViewingAllBrands && (
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            Add Custom Distributor
          </button>
        )}
      </div>

      <div className="glass-card rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
        <div className="p-6 border-b border-gray-200 dark:border-white/10 space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filterTab === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'glass text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/10'
              }`}
            >
              All ({addedCount})
            </button>
            <button
              onClick={() => setFilterTab('global')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                filterTab === 'global'
                  ? 'bg-blue-600 text-white'
                  : 'glass text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/10'
              }`}
            >
              <Globe className="w-4 h-4" />
              Global ({globalCount})
            </button>
            <button
              onClick={() => setFilterTab('custom')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                filterTab === 'custom'
                  ? 'bg-blue-600 text-white'
                  : 'glass text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/10'
              }`}
            >
              <Building2 className="w-4 h-4" />
              Custom ({customCount})
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-zinc-400 w-5 h-5" />
            <input
              type="text"
              placeholder={isViewingAllBrands ? "Search by name, state, or brand..." : "Search by name or state..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        {filteredDistributors.length === 0 ? (
          <div className="p-8 text-center text-gray-600 dark:text-zinc-400">
            {searchTerm
              ? 'No distributors found matching your search.'
              : filterTab === 'global'
              ? 'No global distributors available to add. All global distributors have been added to your account.'
              : filterTab === 'custom'
              ? 'No custom distributors yet. Add your first custom distributor to get started.'
              : 'No distributors in your account yet. Add distributors from the Global tab or create custom ones.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="glass-card dark:glass border-b border-gray-200 dark:border-white/10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
                    Distributor
                  </th>
                  {isViewingAllBrands && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
                      Brand
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
                    Sales Revenue
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
                    FOB Revenue
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
                    Orders
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
                    Status
                  </th>
                  {!isViewingAllBrands && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {filteredDistributors.map((distributor) => {
                  const distributorStats = stats[distributor.id] || { total_revenue: 0, fob_revenue: 0, total_orders: 0 };
                  return (
                    <tr key={distributor.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition">
                      <td className="px-6 py-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {distributor.name}
                            </span>
                            {distributor.is_global && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                <Globe className="w-3 h-3" />
                                Global
                              </span>
                            )}
                          </div>
                          {(organizationDistributorStates[distributor.id] || distributor.state) && (
                            <div className="flex items-center gap-1 mt-1 text-sm text-gray-600 dark:text-zinc-400">
                              <MapPin className="w-3 h-3" />
                              {organizationDistributorStates[distributor.id] || distributor.state}
                            </div>
                          )}
                        </div>
                      </td>
                      {isViewingAllBrands && (
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            {distributor.organization_name ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                <Building2 className="w-3 h-3" />
                                {distributor.organization_name}
                              </span>
                            ) : distributor.is_global ? (
                              <span className="text-gray-400 dark:text-zinc-400 text-xs">Global</span>
                            ) : (
                              <span className="text-gray-400 dark:text-zinc-400">-</span>
                            )}
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          {distributor.contact_email && (
                            <div className="flex items-center gap-1 text-gray-700 dark:text-zinc-300">
                              <Mail className="w-3 h-3 text-gray-400 dark:text-zinc-400" />
                              {distributor.contact_email}
                            </div>
                          )}
                          {distributor.contact_phone && (
                            <div className="flex items-center gap-1 text-gray-700 dark:text-zinc-300 mt-1">
                              <Phone className="w-3 h-3 text-gray-400 dark:text-zinc-400" />
                              {distributor.contact_phone}
                            </div>
                          )}
                          {!distributor.contact_email && !distributor.contact_phone && (
                            <span className="text-gray-400 dark:text-zinc-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {statsLoading ? (
                          <div className="inline-block animate-pulse bg-gray-200 dark:bg-gray-700 h-5 w-20 rounded"></div>
                        ) : (
                          <span className="font-semibold text-gray-900 dark:text-white">
                            ${distributorStats.total_revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {statsLoading ? (
                          <div className="inline-block animate-pulse bg-gray-200 dark:bg-gray-700 h-5 w-20 rounded"></div>
                        ) : (
                          <span className="font-semibold text-teal-600 dark:text-teal-400">
                            ${distributorStats.fob_revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-700 dark:text-zinc-300">
                        {statsLoading ? (
                          <div className="inline-block animate-pulse bg-gray-200 dark:bg-gray-700 h-5 w-12 rounded"></div>
                        ) : (
                          distributorStats.total_orders.toLocaleString()
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {distributor.is_global ? (
                          filterTab === 'global' ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              Available
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                              Active
                            </span>
                          )
                        ) : (
                          <button
                            onClick={() => handleToggleActive(distributor)}
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              distributor.active
                                ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-slate-100 text-gray-700 dark:text-zinc-300 hover:bg-slate-200 dark:bg-white/5'
                            } transition`}
                          >
                            {distributor.active ? 'Active' : 'Inactive'}
                          </button>
                        )}
                      </td>
                      {!isViewingAllBrands && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {distributor.is_global && filterTab === 'global' ? (
                              <button
                                onClick={() => handleAddDistributorClick(distributor)}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition flex items-center gap-1"
                              >
                                <Plus className="w-4 h-4" />
                                Add Distributor
                              </button>
                            ) : distributor.is_global && filterTab === 'all' ? (
                              <button
                                onClick={() => handleRemoveDistributor(distributor)}
                                className="text-red-600 hover:text-red-700 transition"
                                title="Remove distributor from account"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : !distributor.is_global ? (
                              <button
                                onClick={() => handleEdit(distributor)}
                                className="text-blue-600 hover:text-blue-700 transition"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddDistributorModal && distributorToAdd && (
        <AddDistributorStateModal
          distributorName={distributorToAdd.name}
          onConfirm={handleAddDistributor}
          onCancel={handleCancelAddDistributor}
        />
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="glass-card rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {editingDistributor ? 'Edit Custom Distributor' : 'Add Custom Distributor'}
              </h2>
              <p className="text-sm text-gray-600 dark:text-zinc-400 mt-1">
                Create a custom distributor specific to your organization
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Enter distributor name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                  State
                </label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="e.g., California, CA"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="distributor@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingDistributor(null);
                    setError(null);
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 text-gray-700 dark:text-zinc-300 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                >
                  {editingDistributor ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
