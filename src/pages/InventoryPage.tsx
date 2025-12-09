import { useEffect, useState } from 'react';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';
import {
  getImporterInventory,
  getDistributorInventory,
  updateImporterInventory,
  adjustDistributorInventory,
  getInventorySummary,
  getInventoryTransactions
} from '../lib/inventoryService';
import { supabase } from '../lib/supabase';
import { Package, Warehouse, TrendingDown, AlertTriangle, Search, Edit2, Plus, Save, X, BarChart2, History, Filter, ArrowUpDown, LayoutGrid, List, RefreshCw } from 'lucide-react';
import InitializeDistributorInventoryModal from '../components/InitializeDistributorInventoryModal';
import AddImporterInventoryModal from '../components/AddImporterInventoryModal';
import InventoryWidgets from '../components/InventoryWidgets';
import InventoryCharts from '../components/InventoryCharts';
import InventoryTransactionHistory from '../components/InventoryTransactionHistory';
import DistributorInventoryCard from '../components/DistributorInventoryCard';
import EditDistributorInventoryModal from '../components/EditDistributorInventoryModal';
import InventoryReconciliationModal from '../components/InventoryReconciliationModal';

type TabType = 'importer' | 'distributor';
type ViewMode = 'overview' | 'detailed' | 'analytics' | 'history';
type StockFilter = 'all' | 'in-stock' | 'low-stock' | 'out-of-stock';
type SortField = 'name' | 'quantity' | 'updated';
type SortOrder = 'asc' | 'desc';
type DisplayMode = 'cards' | 'table';

interface Distributor {
  id: string;
  name: string;
}

export default function InventoryPage() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('importer');
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [showFilters, setShowFilters] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('cards');

  const [importerInventory, setImporterInventory] = useState<any[]>([]);
  const [distributorInventory, setDistributorInventory] = useState<any[]>([]);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [selectedDistributor, setSelectedDistributor] = useState<string>('');
  const [organizationDistributorStates, setOrganizationDistributorStates] = useState<Record<string, string>>({});
  const [transactions, setTransactions] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  const [editingImporterId, setEditingImporterId] = useState<string | null>(null);
  const [editingQuantity, setEditingQuantity] = useState('');
  const [editingNotes, setEditingNotes] = useState('');

  const [editingDistributorId, setEditingDistributorId] = useState<string | null>(null);
  const [editingDistQuantity, setEditingDistQuantity] = useState('');
  const [editingDistNotes, setEditingDistNotes] = useState('');
  const [editingDistributorItem, setEditingDistributorItem] = useState<any | null>(null);

  const [summary, setSummary] = useState({
    totalImporterInventory: 0,
    totalDistributorInventory: 0,
    totalDepleted: 0,
    outOfStockCount: 0,
    lowStockCount: 0,
    totalProducts: 0,
    trackedImporterCount: 0,
    trackedDistributorCount: 0,
  });

  const [showInitModal, setShowInitModal] = useState(false);
  const [showAddImporterModal, setShowAddImporterModal] = useState(false);
  const [showReconciliationModal, setShowReconciliationModal] = useState(false);

  useEffect(() => {
    if (currentOrganization) {
      fetchData();
    }
  }, [currentOrganization, selectedDistributor]);

  const fetchData = async () => {
    if (!currentOrganization) return;

    setLoading(true);

    const [importerData, distributorData, summaryData, transactionsData] = await Promise.all([
      getImporterInventory(currentOrganization.id),
      getDistributorInventory(currentOrganization.id, selectedDistributor || undefined),
      getInventorySummary(currentOrganization.id),
      getInventoryTransactions(currentOrganization.id, undefined, undefined, 100),
    ]);

    setImporterInventory(importerData);
    setDistributorInventory(distributorData);
    setSummary(summaryData);
    setTransactions(transactionsData);

    const { data: distData } = await supabase
      .from('organization_distributors')
      .select('distributor_id, state, distributors(id, name)')
      .eq('organization_id', currentOrganization.id);

    if (distData) {
      const dists = distData
        .map((item: any) => item.distributors)
        .filter(Boolean);
      setDistributors(dists);

      const orgDistributorStates: Record<string, string> = {};
      distData.forEach((item: any) => {
        if (item.state) {
          orgDistributorStates[item.distributor_id] = item.state;
        }
      });
      setOrganizationDistributorStates(orgDistributorStates);

      if (dists.length > 0 && !selectedDistributor) {
        setSelectedDistributor(dists[0].id);
      }
    }

    const { data: productsData } = await supabase
      .from('products')
      .select('id, product_name')
      .eq('organization_id', currentOrganization.id)
      .order('product_name');

    if (productsData) {
      setProducts(productsData);
    }

    setLoading(false);
  };

  const handleStartEdit = (item: any, type: 'importer' | 'distributor') => {
    if (type === 'importer') {
      setEditingImporterId(item.id);
      setEditingQuantity(item.quantity.toString());
      setEditingNotes(item.notes || '');
    } else {
      setEditingDistributorId(item.id);
      setEditingDistQuantity(item.current_quantity.toString());
      setEditingDistNotes('');
    }
  };

  const handleCancelEdit = (type: 'importer' | 'distributor') => {
    if (type === 'importer') {
      setEditingImporterId(null);
      setEditingQuantity('');
      setEditingNotes('');
    } else {
      setEditingDistributorId(null);
      setEditingDistQuantity('');
      setEditingDistNotes('');
    }
  };

  const handleSaveImporter = async (item: any) => {
    if (!currentOrganization) return;

    const quantity = parseFloat(editingQuantity);
    if (isNaN(quantity) || quantity < 0) {
      alert('Please enter a valid quantity');
      return;
    }

    const success = await updateImporterInventory(
      currentOrganization.id,
      item.product_id,
      quantity,
      editingNotes || undefined
    );

    if (success) {
      setEditingImporterId(null);
      setEditingQuantity('');
      setEditingNotes('');
      fetchData();
    } else {
      alert('Failed to update inventory');
    }
  };

  const handleSaveDistributor = async (item: any) => {
    if (!currentOrganization) return;

    const quantity = parseFloat(editingDistQuantity);
    if (isNaN(quantity)) {
      alert('Please enter a valid quantity');
      return;
    }

    const success = await adjustDistributorInventory(
      currentOrganization.id,
      item.product_id,
      item.distributor_id,
      quantity,
      editingDistNotes || undefined
    );

    if (success) {
      setEditingDistributorId(null);
      setEditingDistQuantity('');
      setEditingDistNotes('');
      fetchData();
    } else {
      alert('Failed to update distributor inventory');
    }
  };

  const handleSaveDistributorModal = async (quantity: number, notes: string) => {
    if (!currentOrganization || !editingDistributorItem) return;

    const success = await adjustDistributorInventory(
      currentOrganization.id,
      editingDistributorItem.product_id,
      editingDistributorItem.distributor_id,
      quantity,
      notes || undefined
    );

    if (success) {
      setEditingDistributorItem(null);
      fetchData();
    } else {
      throw new Error('Failed to update distributor inventory');
    }
  };

  const filteredAndSortedImporterInventory = importerInventory
    .filter(item => item.products?.product_name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      const aVal = sortField === 'name' ? a.products?.product_name :
                   sortField === 'quantity' ? Number(a.quantity) :
                   new Date(a.updated_at).getTime();
      const bVal = sortField === 'name' ? b.products?.product_name :
                   sortField === 'quantity' ? Number(b.quantity) :
                   new Date(b.updated_at).getTime();

      if (sortField === 'name') {
        return sortOrder === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
      }
      return sortOrder === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
    });

  const filteredAndSortedDistributorInventory = distributorInventory
    .filter(item => {
      const matchesSearch = item.products?.product_name.toLowerCase().includes(searchTerm.toLowerCase());

      if (stockFilter === 'out-of-stock') {
        return matchesSearch && Number(item.current_quantity) <= 0;
      } else if (stockFilter === 'low-stock') {
        const qty = Number(item.current_quantity);
        const initial = Number(item.initial_quantity);
        return matchesSearch && qty > 0 && qty < initial * 0.2;
      } else if (stockFilter === 'in-stock') {
        const qty = Number(item.current_quantity);
        const initial = Number(item.initial_quantity);
        return matchesSearch && qty >= initial * 0.2;
      }

      return matchesSearch;
    })
    .sort((a, b) => {
      const aVal = sortField === 'name' ? a.products?.product_name :
                   sortField === 'quantity' ? Number(a.current_quantity) :
                   new Date(a.last_updated).getTime();
      const bVal = sortField === 'name' ? b.products?.product_name :
                   sortField === 'quantity' ? Number(b.current_quantity) :
                   new Date(b.last_updated).getTime();

      if (sortField === 'name') {
        return sortOrder === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
      }
      return sortOrder === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-4">Inventory Management</h1>
          <p className="text-gray-600 dark:text-zinc-400">
            Track inventory levels for both importer stock and distributor stock
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowReconciliationModal(true)}
            className="px-4 py-2 glass rounded-xl text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/10 transition flex items-center gap-2"
            title="Reconcile historical orders"
          >
            <RefreshCw className="w-4 h-4" />
            Reconcile
          </button>
          <button
            onClick={() => setViewMode('overview')}
            className={`px-4 py-2 rounded-xl font-medium transition flex items-center gap-2 ${
              viewMode === 'overview'
                ? 'bg-gradient-blue text-white shadow-glow-blue'
                : 'glass text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/10'
            }`}
          >
            <Package className="w-4 h-4" />
            Overview
          </button>
          <button
            onClick={() => setViewMode('analytics')}
            className={`px-4 py-2 rounded-xl font-medium transition flex items-center gap-2 ${
              viewMode === 'analytics'
                ? 'bg-gradient-blue text-white shadow-glow-blue'
                : 'glass text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/10'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            Analytics
          </button>
          <button
            onClick={() => setViewMode('history')}
            className={`px-4 py-2 rounded-xl font-medium transition flex items-center gap-2 ${
              viewMode === 'history'
                ? 'bg-gradient-blue text-white shadow-glow-blue'
                : 'glass text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/10'
            }`}
          >
            <History className="w-4 h-4" />
            History
          </button>
        </div>
      </div>

      {viewMode === 'overview' && (
        <>
          <InventoryWidgets
            summary={summary}
            distributorInventory={distributorInventory}
            transactions={transactions}
          />
        </>
      )}

      {viewMode === 'analytics' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="glass-card rounded-2xl p-6 glow-hover-blue">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wide">Importer Stock</span>
                <div className="rounded-xl p-2 bg-gradient-blue shadow-glow-blue">
                  <Warehouse className="w-5 h-5 text-white" />
                </div>
              </div>
              <span className="text-3xl font-semibold text-gray-900 dark:text-white">
                {summary.totalImporterInventory.toLocaleString()}
              </span>
            </div>

            <div className="glass-card rounded-2xl p-6 glow-hover-teal">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wide">Distributor Stock</span>
                <div className="rounded-xl p-2 bg-gradient-teal shadow-glow-teal">
                  <Package className="w-5 h-5 text-white" />
                </div>
              </div>
              <span className="text-3xl font-semibold text-gray-900 dark:text-white">
                {summary.totalDistributorInventory.toLocaleString()}
              </span>
            </div>

            <div className="glass-card rounded-2xl p-6 glow-hover-purple">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wide">Total Depleted</span>
                <div className="rounded-xl p-2 bg-gradient-orange">
                  <TrendingDown className="w-5 h-5 text-white" />
                </div>
              </div>
              <span className="text-3xl font-semibold text-gray-900 dark:text-white">
                {summary.totalDepleted.toLocaleString()}
              </span>
            </div>

            <div className="glass-card rounded-2xl p-6 glow-hover-red">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wide">Low/Out Stock</span>
                <div className="rounded-xl p-2 bg-gradient-red">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
              </div>
              <span className="text-3xl font-semibold text-gray-900 dark:text-white">
                {summary.outOfStockCount + summary.lowStockCount}
              </span>
            </div>
          </div>

          <InventoryCharts
            importerInventory={importerInventory}
            distributorInventory={distributorInventory}
            transactions={transactions}
          />
        </>
      )}

      {viewMode === 'history' && (
        <InventoryTransactionHistory
          transactions={transactions}
          products={products}
          distributors={distributors}
        />
      )}

      {(viewMode === 'overview' || viewMode === 'detailed') && (
        <>

      <div className="glass-card rounded-2xl glow-hover-blue">
        <div className="p-6 border-b border-gray-200 dark:border-white/10">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => setActiveTab('importer')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeTab === 'importer'
                  ? 'bg-gradient-blue text-white shadow-glow-blue'
                  : 'glass text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/10'
              }`}
            >
              Importer Inventory
            </button>
            <button
              onClick={() => setActiveTab('distributor')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeTab === 'distributor'
                  ? 'bg-gradient-blue text-white shadow-glow-blue'
                  : 'glass text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/10'
              }`}
            >
              Distributor Inventory
            </button>
          </div>

          {activeTab === 'importer' && (
            <div className="flex items-center gap-4 mb-4">
              <button
                onClick={() => setShowAddImporterModal(true)}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Product
              </button>
            </div>
          )}

          {activeTab === 'distributor' && (
            <div className="flex items-center gap-4 mb-4 flex-wrap">
              <select
                value={selectedDistributor}
                onChange={(e) => setSelectedDistributor(e.target.value)}
                className="px-4 py-2 glass rounded-xl text-gray-900 dark:text-white focus-ring"
              >
                <option value="">All Distributors</option>
                {distributors.map((dist) => (
                  <option key={dist.id} value={dist.id}>
                    {dist.name}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2">
                <div className="flex items-center glass rounded-xl p-1">
                  <button
                    onClick={() => setDisplayMode('cards')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-2 ${
                      displayMode === 'cards' ? 'bg-gradient-blue text-white shadow-glow-blue' : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/10'
                    }`}
                    title="Card view"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDisplayMode('table')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-2 ${
                      displayMode === 'table' ? 'bg-gradient-blue text-white shadow-glow-blue' : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/10'
                    }`}
                    title="Table view"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-4 py-2 rounded-xl font-medium transition flex items-center gap-2 ${
                    showFilters ? 'bg-gradient-blue text-white' : 'glass text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/10'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  Filters
                </button>

                <button
                  onClick={() => {
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  }}
                  className="px-4 py-2 glass rounded-xl text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/10 transition flex items-center gap-2"
                >
                  <ArrowUpDown className="w-4 h-4" />
                  {sortOrder === 'asc' ? 'Asc' : 'Desc'}
                </button>
              </div>

              <button
                onClick={() => setShowInitModal(true)}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Initialize Inventory
              </button>
            </div>
          )}

          {showFilters && activeTab === 'distributor' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 glass rounded-xl">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
                  Stock Status
                </label>
                <select
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value as StockFilter)}
                  className="w-full px-4 py-2 glass rounded-xl text-gray-900 dark:text-white focus-ring"
                >
                  <option value="all">All Status</option>
                  <option value="in-stock">In Stock</option>
                  <option value="low-stock">Low Stock</option>
                  <option value="out-of-stock">Out of Stock</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
                  Sort By
                </label>
                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value as SortField)}
                  className="w-full px-4 py-2 glass rounded-xl text-gray-900 dark:text-white focus-ring"
                >
                  <option value="name">Product Name</option>
                  <option value="quantity">Quantity</option>
                  <option value="updated">Last Updated</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => {
                    setStockFilter('all');
                    setSortField('name');
                    setSortOrder('asc');
                  }}
                  className="w-full px-4 py-2 glass rounded-xl text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-white/10 transition"
                >
                  Reset Filters
                </button>
              </div>
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-zinc-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 glass rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-400 focus-ring"
            />
          </div>
        </div>

        {activeTab === 'importer' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 dark:border-white/10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
                    Product Name
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
                    Notes
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
                    Last Updated
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {filteredAndSortedImporterInventory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-600 dark:text-zinc-400">
                      No importer inventory records found. Products will appear here after you update their inventory.
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedImporterInventory.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {item.products?.product_name}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {editingImporterId === item.id ? (
                          <input
                            type="number"
                            value={editingQuantity}
                            onChange={(e) => setEditingQuantity(e.target.value)}
                            className="w-32 px-2 py-1 border border-blue-500 rounded text-sm text-right text-gray-900 dark:text-white glass"
                            autoFocus
                          />
                        ) : (
                          <span className="text-gray-900 dark:text-white font-semibold">
                            {Number(item.quantity).toLocaleString()}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {editingImporterId === item.id ? (
                          <input
                            type="text"
                            value={editingNotes}
                            onChange={(e) => setEditingNotes(e.target.value)}
                            placeholder="Optional notes"
                            className="w-full px-2 py-1 border border-blue-500 rounded text-sm text-gray-900 dark:text-white glass"
                          />
                        ) : (
                          <span className="text-gray-700 dark:text-zinc-300 text-sm">
                            {item.notes || '-'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-zinc-400 text-sm">
                        {new Date(item.updated_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {editingImporterId === item.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleSaveImporter(item)}
                              className="text-green-600 hover:text-green-700 transition"
                              title="Save"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleCancelEdit('importer')}
                              className="text-gray-600 hover:text-gray-700 transition"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleStartEdit(item, 'importer')}
                            className="text-blue-600 hover:text-blue-700 transition"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : displayMode === 'cards' ? (
          <div className="p-6">
            {filteredAndSortedDistributorInventory.length === 0 ? (
              <div className="text-center py-12 text-gray-600 dark:text-zinc-400">
                No distributor inventory records found. Click "Initialize Inventory" to set up initial stock levels.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredAndSortedDistributorInventory.map((item) => (
                  <DistributorInventoryCard
                    key={item.id}
                    item={item}
                    distributorState={organizationDistributorStates[item.distributor_id] || item.distributors?.state}
                    onEdit={(item) => setEditingDistributorItem(item)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 dark:border-white/10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
                    Product Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
                    Distributor
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
                    Initial
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
                    Current
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
                    Depleted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
                    Last Updated
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                {filteredAndSortedDistributorInventory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-600 dark:text-zinc-400">
                      No distributor inventory records found. Click "Initialize Inventory" to set up initial stock levels.
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedDistributorInventory.map((item) => {
                    const depleted = Number(item.initial_quantity) - Number(item.current_quantity);
                    const isLowStock = Number(item.current_quantity) > 0 && Number(item.current_quantity) < Number(item.initial_quantity) * 0.2;
                    const isOutOfStock = Number(item.current_quantity) <= 0;

                    return (
                      <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {item.products?.product_name}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-zinc-300">
                          {item.distributors?.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700 dark:text-zinc-300">
                          {Number(item.initial_quantity).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          {editingDistributorId === item.id ? (
                            <input
                              type="number"
                              value={editingDistQuantity}
                              onChange={(e) => setEditingDistQuantity(e.target.value)}
                              className="w-32 px-2 py-1 border border-blue-500 rounded text-sm text-right text-gray-900 dark:text-white glass"
                              autoFocus
                            />
                          ) : (
                            <span className={`font-semibold ${
                              isOutOfStock ? 'text-red-600 dark:text-red-400' :
                              isLowStock ? 'text-orange-600 dark:text-orange-400' :
                              'text-gray-900 dark:text-white'
                            }`}>
                              {Number(item.current_quantity).toLocaleString()}
                              {isOutOfStock && ' (Out)'}
                              {isLowStock && ' (Low)'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700 dark:text-zinc-300">
                          {depleted.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-zinc-400 text-sm">
                          {new Date(item.last_updated).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          {editingDistributorId === item.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleSaveDistributor(item)}
                                className="text-green-600 hover:text-green-700 transition"
                                title="Save"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleCancelEdit('distributor')}
                                className="text-gray-600 hover:text-gray-700 transition"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleStartEdit(item, 'distributor')}
                              className="text-blue-600 hover:text-blue-700 transition"
                              title="Adjust"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </>
      )}

      {showAddImporterModal && currentOrganization && (
        <AddImporterInventoryModal
          organizationId={currentOrganization.id}
          onClose={() => setShowAddImporterModal(false)}
          onSuccess={() => {
            setShowAddImporterModal(false);
            fetchData();
          }}
        />
      )}

      {showInitModal && currentOrganization && (
        <InitializeDistributorInventoryModal
          organizationId={currentOrganization.id}
          onClose={() => setShowInitModal(false)}
          onSuccess={() => {
            setShowInitModal(false);
            fetchData();
          }}
        />
      )}

      {editingDistributorItem && (
        <EditDistributorInventoryModal
          item={editingDistributorItem}
          distributorState={organizationDistributorStates[editingDistributorItem.distributor_id] || editingDistributorItem.distributors?.state}
          onSave={handleSaveDistributorModal}
          onClose={() => setEditingDistributorItem(null)}
        />
      )}

      {showReconciliationModal && currentOrganization && (
        <InventoryReconciliationModal
          organizationId={currentOrganization.id}
          onClose={() => setShowReconciliationModal(false)}
          onSuccess={() => {
            fetchData();
          }}
        />
      )}
    </div>
  );
}
