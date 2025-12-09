import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOrganization } from '../contexts/OrganizationContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, DollarSign, ShoppingCart, TrendingUp, Calendar, Package, User, Briefcase, FileText, Phone, Save, Edit2, X, Wine, Store, HelpCircle, Check } from 'lucide-react';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Account {
  id: string;
  account_name: string;
  total_revenue: number;
  total_orders: number;
  first_order_date: string;
  last_order_date: string;
  average_order_value: number;
  manager_name: string | null;
  buyer_name: string | null;
  notes: string | null;
  last_contact_date: string | null;
  premise_type: 'on_premise' | 'off_premise' | 'unclassified' | 'online' | null;
  premise_type_confidence: number | null;
  premise_type_manual_override: boolean | null;
  premise_type_updated_at: string | null;
}

interface SalesRecord {
  id: string;
  order_id: string | null;
  order_date: string;
  product_name: string;
  quantity: number;
  revenue: number;
  unit_price: number | null;
  distributor: string | null;
  representative: string | null;
  date_of_sale: string | null;
}

interface ProductBreakdown {
  product_name: string;
  total_revenue: number;
  total_quantity: number;
  total_cases: number;
  order_count: number;
}

interface MonthlyRevenue {
  month: string;
  revenue: number;
}

export default function AccountDetail() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const [account, setAccount] = useState<Account | null>(null);
  const [orders, setOrders] = useState<SalesRecord[]>([]);
  const [productBreakdown, setProductBreakdown] = useState<ProductBreakdown[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthlyRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingPremiseType, setIsEditingPremiseType] = useState(false);
  const [isSavingPremiseType, setIsSavingPremiseType] = useState(false);
  const [selectedPremiseType, setSelectedPremiseType] = useState<'on_premise' | 'off_premise' | 'unclassified' | 'online'>('unclassified');
  const [formData, setFormData] = useState({
    manager_name: '',
    buyer_name: '',
    notes: '',
    last_contact_date: '',
  });

  useEffect(() => {
    const fetchAccountData = async () => {
      if (!currentOrganization || !accountId) return;

      setLoading(true);

      let accountData = null;
      let accountError = null;

      const { data: dataById, error: errorById } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', accountId)
        .eq('organization_id', currentOrganization.id)
        .maybeSingle();

      if (dataById) {
        accountData = dataById;
      } else {
        const { data: dataByName, error: errorByName } = await supabase
          .from('accounts')
          .select('*')
          .eq('account_name', accountId)
          .eq('organization_id', currentOrganization.id)
          .maybeSingle();

        accountData = dataByName;
        accountError = errorByName;
      }

      if (accountError || !accountData) {
        console.error('Error fetching account:', accountError);
        setLoading(false);
        return;
      }

      setAccount(accountData);
      setFormData({
        manager_name: accountData.manager_name || '',
        buyer_name: accountData.buyer_name || '',
        notes: accountData.notes || '',
        last_contact_date: accountData.last_contact_date || '',
      });
      setSelectedPremiseType(accountData.premise_type || 'unclassified');

      const { data: ordersData, error: ordersError } = await supabase
        .from('sales_data')
        .select('*')
        .eq('organization_id', currentOrganization.id)
        .eq('account_name', accountData.account_name)
        .order('order_date', { ascending: false });

      if (!ordersError && ordersData) {
        setOrders(ordersData);

        const productMap = new Map<string, ProductBreakdown>();
        ordersData.forEach((order) => {
          const existing = productMap.get(order.product_name) || {
            product_name: order.product_name,
            total_revenue: 0,
            total_quantity: 0,
            total_cases: 0,
            order_count: 0,
          };
          productMap.set(order.product_name, {
            product_name: order.product_name,
            total_revenue: existing.total_revenue + Number(order.revenue),
            total_quantity: existing.total_quantity + (order.quantity || 0),
            total_cases: existing.total_cases + (order.quantity || 0),
            order_count: existing.order_count + 1,
          });
        });

        const sortedProducts = Array.from(productMap.values()).sort(
          (a, b) => b.total_cases - a.total_cases
        );
        setProductBreakdown(sortedProducts);

        const monthlyMap = new Map<string, number>();
        ordersData.forEach((order) => {
          const date = new Date(order.order_date);
          const monthKey = format(date, 'MMM yyyy');
          const existing = monthlyMap.get(monthKey) || 0;
          monthlyMap.set(monthKey, existing + Number(order.revenue));
        });

        const sortedMonths = Array.from(monthlyMap.entries())
          .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
          .map(([month, revenue]) => ({ month, revenue }))
          .slice(-12);

        setMonthlyRevenue(sortedMonths);
      }

      setLoading(false);
    };

    fetchAccountData();
  }, [currentOrganization, accountId]);

  const handleSave = async () => {
    if (!account || !currentOrganization) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('accounts')
        .update({
          manager_name: formData.manager_name || null,
          buyer_name: formData.buyer_name || null,
          notes: formData.notes || null,
          last_contact_date: formData.last_contact_date || null,
        })
        .eq('id', account.id)
        .eq('organization_id', currentOrganization.id);

      if (error) throw error;

      setAccount({
        ...account,
        manager_name: formData.manager_name || null,
        buyer_name: formData.buyer_name || null,
        notes: formData.notes || null,
        last_contact_date: formData.last_contact_date || null,
      });

      setIsEditing(false);
    } catch (error) {
      console.error('Error updating account:', error);
      alert('Failed to update account information. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (account) {
      setFormData({
        manager_name: account.manager_name || '',
        buyer_name: account.buyer_name || '',
        notes: account.notes || '',
        last_contact_date: account.last_contact_date || '',
      });
    }
    setIsEditing(false);
  };

  const handleSavePremiseType = async () => {
    if (!account || !currentOrganization) return;

    setIsSavingPremiseType(true);
    try {
      const updateData = {
        premise_type: selectedPremiseType,
        premise_type_manual_override: true,
        premise_type_updated_at: new Date().toISOString(),
        premise_type_confidence: 1.0,
      };

      console.log('Updating premise type with data:', updateData);
      console.log('Account ID:', account.id);
      console.log('Organization ID:', currentOrganization.id);

      const { data, error } = await supabase
        .from('accounts')
        .update(updateData)
        .eq('id', account.id)
        .eq('organization_id', currentOrganization.id)
        .select()
        .single();

      if (error) {
        console.error('Supabase error details:', error);
        throw error;
      }

      console.log('Update successful:', data);

      setAccount({
        ...account,
        premise_type: selectedPremiseType,
        premise_type_manual_override: true,
        premise_type_updated_at: new Date().toISOString(),
        premise_type_confidence: 1.0,
      });

      setIsEditingPremiseType(false);
    } catch (error: any) {
      console.error('Error updating premise type:', error);
      const errorMessage = error?.message || 'Unknown error occurred';
      const errorCode = error?.code || 'N/A';
      const errorDetails = error?.details || 'No additional details';

      alert(
        `Failed to update premise type.\n\n` +
        `Error: ${errorMessage}\n` +
        `Code: ${errorCode}\n` +
        `Details: ${errorDetails}\n\n` +
        `Please try again or contact support if the issue persists.`
      );
    } finally {
      setIsSavingPremiseType(false);
    }
  };

  const handleCancelPremiseType = () => {
    if (account) {
      setSelectedPremiseType(account.premise_type || 'unclassified');
    }
    setIsEditingPremiseType(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Account Not Found</h2>
        <button
          onClick={() => navigate('/dashboard/accounts')}
          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
        >
          Return to Accounts
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => navigate('/dashboard/accounts')}
        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white mb-6 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Accounts
      </button>

      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-2xl">
            {account.account_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{account.account_name}</h1>
            <p className="text-slate-600 dark:text-slate-300 mt-1">Complete account overview and order history</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-white/5 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Account Information</h2>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                {isSaving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              <User className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              Manager Name
            </label>
            {isEditing ? (
              <input
                type="text"
                value={formData.manager_name}
                onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
                placeholder="Enter manager name"
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
            ) : (
              <p className="text-slate-900 dark:text-white px-4 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                {formData.manager_name || <span className="text-slate-400 dark:text-slate-500">Not set</span>}
              </p>
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              <Briefcase className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              Buyer Name
            </label>
            {isEditing ? (
              <input
                type="text"
                value={formData.buyer_name}
                onChange={(e) => setFormData({ ...formData, buyer_name: e.target.value })}
                placeholder="Enter buyer name"
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
            ) : (
              <p className="text-slate-900 dark:text-white px-4 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                {formData.buyer_name || <span className="text-slate-400 dark:text-slate-500">Not set</span>}
              </p>
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              <Phone className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              Last Contact Date
            </label>
            {isEditing ? (
              <input
                type="date"
                value={formData.last_contact_date}
                onChange={(e) => setFormData({ ...formData, last_contact_date: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
            ) : (
              <p className="text-slate-900 dark:text-white px-4 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                {formData.last_contact_date
                  ? format(new Date(formData.last_contact_date), 'MMM dd, yyyy')
                  : <span className="text-slate-400 dark:text-slate-500">Not set</span>}
              </p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              Notes
            </label>
            {isEditing ? (
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add notes about this account (e.g., preferences, special requirements, history)"
                rows={4}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 resize-none"
              />
            ) : (
              <p className="text-slate-900 dark:text-white px-4 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg min-h-[100px] whitespace-pre-wrap">
                {formData.notes || <span className="text-slate-400 dark:text-slate-500">No notes added</span>}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-white/5 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Premise Type Classification</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
              Classify this account as on-premise (bars, restaurants) or off-premise (retail stores)
            </p>
          </div>
          {!isEditingPremiseType ? (
            <button
              onClick={() => setIsEditingPremiseType(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancelPremiseType}
                disabled={isSavingPremiseType}
                className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={handleSavePremiseType}
                disabled={isSavingPremiseType}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                {isSavingPremiseType ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {isEditingPremiseType ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => setSelectedPremiseType('on_premise')}
                className={`p-6 rounded-xl border-2 transition-all ${
                  selectedPremiseType === 'on_premise'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 shadow-lg'
                    : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 hover:border-blue-300 hover:shadow-md'
                }`}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                    selectedPremiseType === 'on_premise'
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}>
                    <Wine className="w-8 h-8" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-1">On-Premise</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Bars, restaurants, nightclubs</p>
                  </div>
                  {selectedPremiseType === 'on_premise' && (
                    <div className="mt-2 flex items-center gap-1 text-blue-600 font-semibold">
                      <Check className="w-5 h-5" />
                      Selected
                    </div>
                  )}
                </div>
              </button>

              <button
                onClick={() => setSelectedPremiseType('off_premise')}
                className={`p-6 rounded-xl border-2 transition-all ${
                  selectedPremiseType === 'off_premise'
                    ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10 shadow-lg'
                    : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 hover:border-teal-300 hover:shadow-md'
                }`}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                    selectedPremiseType === 'off_premise'
                      ? 'bg-teal-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}>
                    <Store className="w-8 h-8" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-1">Off-Premise</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Retail stores, liquor shops</p>
                  </div>
                  {selectedPremiseType === 'off_premise' && (
                    <div className="mt-2 flex items-center gap-1 text-teal-600 font-semibold">
                      <Check className="w-5 h-5" />
                      Selected
                    </div>
                  )}
                </div>
              </button>

              <button
                onClick={() => setSelectedPremiseType('online')}
                className={`p-6 rounded-xl border-2 transition-all ${
                  selectedPremiseType === 'online'
                    ? 'border-green-500 bg-green-50 dark:bg-green-500/10 shadow-lg'
                    : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 hover:border-green-300 hover:shadow-md'
                }`}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                    selectedPremiseType === 'online'
                      ? 'bg-green-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}>
                    <ShoppingCart className="w-8 h-8" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-1">Online</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">E-commerce, web sales</p>
                  </div>
                  {selectedPremiseType === 'online' && (
                    <div className="mt-2 flex items-center gap-1 text-green-600 font-semibold">
                      <Check className="w-5 h-5" />
                      Selected
                    </div>
                  )}
                </div>
              </button>

              <button
                onClick={() => setSelectedPremiseType('unclassified')}
                className={`p-6 rounded-xl border-2 transition-all ${
                  selectedPremiseType === 'unclassified'
                    ? 'border-slate-400 dark:border-slate-500 bg-slate-50 dark:bg-slate-500/10 shadow-lg'
                    : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 hover:border-slate-300 hover:shadow-md'
                }`}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                    selectedPremiseType === 'unclassified'
                      ? 'bg-slate-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}>
                    <HelpCircle className="w-8 h-8" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-1">Unclassified</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Not yet categorized</p>
                  </div>
                  {selectedPremiseType === 'unclassified' && (
                    <div className="mt-2 flex items-center gap-1 text-slate-600 font-semibold">
                      <Check className="w-5 h-5" />
                      Selected
                    </div>
                  )}
                </div>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                account?.premise_type === 'on_premise'
                  ? 'bg-blue-500 text-white'
                  : account?.premise_type === 'off_premise'
                  ? 'bg-teal-500 text-white'
                  : account?.premise_type === 'online'
                  ? 'bg-green-500 text-white'
                  : 'bg-slate-400 text-white'
              }`}>
                {account?.premise_type === 'on_premise' ? (
                  <Wine className="w-8 h-8" />
                ) : account?.premise_type === 'off_premise' ? (
                  <Store className="w-8 h-8" />
                ) : account?.premise_type === 'online' ? (
                  <ShoppingCart className="w-8 h-8" />
                ) : (
                  <HelpCircle className="w-8 h-8" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {account?.premise_type === 'on_premise'
                      ? 'On-Premise'
                      : account?.premise_type === 'off_premise'
                      ? 'Off-Premise'
                      : account?.premise_type === 'online'
                      ? 'Online'
                      : 'Unclassified'}
                  </h3>
                  {account?.premise_type_manual_override ? (
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                      Manual
                    </span>
                  ) : account?.premise_type_confidence ? (
                    <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                      Auto ({(account.premise_type_confidence * 100).toFixed(0)}% confident)
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {account?.premise_type === 'on_premise'
                    ? 'This account is classified as on-premise (bars, restaurants, nightclubs)'
                    : account?.premise_type === 'off_premise'
                    ? 'This account is classified as off-premise (retail stores, liquor shops)'
                    : account?.premise_type === 'online'
                    ? 'This account is classified as online (e-commerce, direct web sales)'
                    : 'This account has not been classified yet'}
                </p>
                {account?.premise_type_updated_at && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    Last updated: {format(new Date(account.premise_type_updated_at), 'MMM dd, yyyy h:mm a')}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-white/5 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Lifetime Cases</span>
            <div className="rounded-lg p-2 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <span className="text-2xl font-bold text-slate-900 dark:text-white">
            {orders.reduce((sum, order) => sum + (order.quantity || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">All-time total</p>
        </div>

        <div className="bg-white dark:bg-white/5 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Total Orders</span>
            <div className="rounded-lg p-2 bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400">
              <ShoppingCart className="w-5 h-5" />
            </div>
          </div>
          <span className="text-2xl font-bold text-slate-900 dark:text-white">{account.total_orders}</span>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">All-time total</p>
        </div>

        <div className="bg-white dark:bg-white/5 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Avg Cases/Order</span>
            <div className="rounded-lg p-2 bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <span className="text-2xl font-bold text-slate-900 dark:text-white">
            {account.total_orders > 0
              ? Math.round(orders.reduce((sum, order) => sum + (order.quantity || 0), 0) / account.total_orders).toLocaleString(undefined, { maximumFractionDigits: 0 })
              : '0'}
          </span>
        </div>

        <div className="bg-white dark:bg-white/5 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Lifetime Revenue</span>
            <div className="rounded-lg p-2 bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <span className="text-2xl font-bold text-slate-900 dark:text-white">
            ${Number(account.total_revenue).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">All-time total</p>
        </div>
      </div>

      {monthlyRevenue.length > 0 && (
        <div className="bg-white dark:bg-white/5 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 p-6 mb-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Revenue Trend</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" vertical={false} />
              <XAxis dataKey="month" stroke="#94a3b8" className="dark:stroke-slate-400" fontSize={12} />
              <YAxis stroke="#94a3b8" className="dark:stroke-slate-400" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#fff'
                }}
                formatter={(value: number) => `$${value.toLocaleString()}`}
              />
              <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-white dark:bg-white/5 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 p-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Top Products</h2>
          {productBreakdown.length === 0 ? (
            <p className="text-slate-600 dark:text-slate-300 text-center py-8">No product data available</p>
          ) : (
            <div className="space-y-4">
              {productBreakdown.slice(0, 5).map((product, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white truncate">{product.product_name}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {product.order_count} orders • ${product.total_revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-bold text-slate-900 dark:text-white">
                      {product.total_cases.toLocaleString(undefined, { maximumFractionDigits: 0 })} cases
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-white/5 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 p-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Account Timeline</h2>
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">First Order</p>
                <p className="text-slate-600 dark:text-slate-300">
                  {account.first_order_date
                    ? format(new Date(account.first_order_date), 'MMMM dd, yyyy')
                    : 'N/A'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <ShoppingCart className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">Total Orders Placed</p>
                <p className="text-slate-600 dark:text-slate-300">{account.total_orders} orders</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">Most Recent Order</p>
                <p className="text-slate-600 dark:text-slate-300">
                  {account.last_order_date
                    ? format(new Date(account.last_order_date), 'MMMM dd, yyyy')
                    : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-white/5 rounded-xl shadow-sm border border-slate-200 dark:border-white/10">
        <div className="p-6 border-b border-slate-200 dark:border-white/10">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Order History</h2>
          <p className="text-slate-600 dark:text-slate-300 mt-1">Complete list of all orders from this account</p>
        </div>

        {orders.length === 0 ? (
          <div className="p-8 text-center text-slate-600 dark:text-slate-300">No orders available</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-white/10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Order ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Distributor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Representative
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
                      {format(new Date(order.date_of_sale || order.order_date), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                      {order.order_id || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">
                      {order.product_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
                      {order.distributor || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
                      {order.representative || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-700 dark:text-slate-300">
                      {order.quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-slate-900 dark:text-white">
                      ${Number(order.revenue).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
