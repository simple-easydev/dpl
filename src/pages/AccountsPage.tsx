import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrganization } from '../contexts/OrganizationContext';
import { getAccountsWithDateFilter, getAllOrganizationsAccounts, AccountWithMetrics } from '../lib/revenueAnalytics';
import { Search, TrendingUp, DollarSign, LayoutGrid, List, Calendar, Info, Building2, Wine, Store, HelpCircle, ShoppingCart, Package, TrendingDown, ArrowUpDown } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

type ViewMode = 'list' | 'card';
type TimeMode = 'last12months' | 'lifetime';
type PremiseFilter = 'all' | 'on_premise' | 'off_premise' | 'unclassified' | 'online';
type SortOption =
  | 'cases-desc'
  | 'cases-asc'
  | 'orders-desc'
  | 'orders-asc'
  | 'name-asc'
  | 'name-desc'
  | 'avg-monthly-desc'
  | 'avg-monthly-asc'
  | 'first-order-desc'
  | 'first-order-asc'
  | 'last-order-desc'
  | 'last-order-asc';

export default function AccountsPage() {
  const navigate = useNavigate();
  const { currentOrganization, isPlatformAdmin, isViewingAllBrands } = useOrganization();
  const [accounts, setAccounts] = useState<AccountWithMetrics[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [premiseFilter, setPremiseFilter] = useState<PremiseFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [timeMode, setTimeMode] = useState<TimeMode>('lifetime');
  const [sortBy, setSortBy] = useState<SortOption>('cases-desc');
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>(() => {
    const now = new Date();
    return {
      start: subMonths(startOfMonth(now), 11),
      end: endOfMonth(now),
    };
  });

  useEffect(() => {
    const fetchAccounts = async () => {
      if (!isPlatformAdmin && !currentOrganization) return;

      setLoading(true);

      let data: AccountWithMetrics[];
      if (isPlatformAdmin && isViewingAllBrands) {
        data = await getAllOrganizationsAccounts(
          timeMode === 'last12months' ? dateRange.start : undefined,
          timeMode === 'last12months' ? dateRange.end : undefined
        );
      } else if (currentOrganization) {
        data = await getAccountsWithDateFilter(
          currentOrganization.id,
          timeMode === 'last12months' ? dateRange.start : undefined,
          timeMode === 'last12months' ? dateRange.end : undefined
        );
      } else {
        data = [];
      }

      setAccounts(data);
      setLoading(false);
    };

    fetchAccounts();
  }, [currentOrganization, isPlatformAdmin, isViewingAllBrands, timeMode, dateRange]);

  const filteredAccounts = useMemo(() => {
    let filtered = [...accounts];

    if (premiseFilter !== 'all') {
      filtered = filtered.filter(account => account.premise_type === premiseFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter((account) =>
        account.account_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'cases-desc':
          return Number(b.total_cases) - Number(a.total_cases);
        case 'cases-asc':
          return Number(a.total_cases) - Number(b.total_cases);
        case 'orders-desc':
          return b.total_orders - a.total_orders;
        case 'orders-asc':
          return a.total_orders - b.total_orders;
        case 'name-asc':
          return a.account_name.localeCompare(b.account_name);
        case 'name-desc':
          return b.account_name.localeCompare(a.account_name);
        case 'avg-monthly-desc':
          return Number(b.average_monthly_cases || 0) - Number(a.average_monthly_cases || 0);
        case 'avg-monthly-asc':
          return Number(a.average_monthly_cases || 0) - Number(b.average_monthly_cases || 0);
        case 'first-order-desc':
          if (!a.first_order_date) return 1;
          if (!b.first_order_date) return -1;
          return new Date(b.first_order_date).getTime() - new Date(a.first_order_date).getTime();
        case 'first-order-asc':
          if (!a.first_order_date) return 1;
          if (!b.first_order_date) return -1;
          return new Date(a.first_order_date).getTime() - new Date(b.first_order_date).getTime();
        case 'last-order-desc':
          if (!a.last_order_date) return 1;
          if (!b.last_order_date) return -1;
          return new Date(b.last_order_date).getTime() - new Date(a.last_order_date).getTime();
        case 'last-order-asc':
          if (!a.last_order_date) return 1;
          if (!b.last_order_date) return -1;
          return new Date(a.last_order_date).getTime() - new Date(b.last_order_date).getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }, [searchTerm, premiseFilter, accounts, sortBy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
      </div>
    );
  }

  const totalAccounts = filteredAccounts.length;
  const totalRevenue = filteredAccounts.reduce((sum, a) => sum + Number(a.total_revenue), 0);
  const totalCases = filteredAccounts.reduce((sum, a) => sum + Number(a.total_cases), 0);
  const totalLifetimeCases = filteredAccounts.reduce((sum, a) => sum + Number(a.lifetime_cases || 0), 0);
  const avgMonthlyCases = filteredAccounts.reduce((sum, a) => sum + Number(a.average_monthly_cases || 0), 0);
  const isAllBrandsView = isPlatformAdmin && isViewingAllBrands;

  const handleAccountClick = (accountId: string, organizationId?: string) => {
    if (isAllBrandsView && organizationId) {
      navigate(`/dashboard/accounts/${accountId}?orgId=${organizationId}`);
    } else {
      navigate(`/dashboard/accounts/${accountId}`);
    }
  };

  const periodLabel = timeMode === 'last12months'
    ? `${format(dateRange.start, 'MMM yyyy')} - ${format(dateRange.end, 'MMM yyyy')}`
    : 'All Time';

  return (
    <div>
      <div className="mb-8">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-semibold text-theme-text">Account Analysis</h1>
            <div className="flex items-center gap-2 mt-2">
              <Calendar className="w-4 h-4 text-theme-muted" />
              <span className="text-sm text-theme-muted">Period: {periodLabel}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 glass rounded-xl p-1">
              <button
                onClick={() => setTimeMode('last12months')}
                className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition btn-hover-gradient ${
                  timeMode === 'last12months'
                    ? 'bg-gradient-blue text-white font-semibold'
                    : 'text-theme-muted hover:text-theme-text'
                }`}
              >
                Last 12 Months
              </button>
              <button
                onClick={() => setTimeMode('lifetime')}
                className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition btn-hover-gradient ${
                  timeMode === 'lifetime'
                    ? 'bg-gradient-blue text-white font-semibold'
                    : 'text-theme-muted hover:text-theme-text'
                }`}
              >
                Lifetime
              </button>
            </div>
            <div className="flex items-center gap-2 glass rounded-xl p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition btn-hover-gradient ${
                  viewMode === 'list'
                    ? 'bg-gradient-blue text-white font-semibold'
                    : 'text-theme-muted hover:text-theme-text'
                }`}
              >
                <List className="w-4 h-4" />
                List
              </button>
              <button
                onClick={() => setViewMode('card')}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition btn-hover-gradient ${
                  viewMode === 'card'
                    ? 'bg-gradient-blue text-white font-semibold'
                    : 'text-theme-muted hover:text-theme-text'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                Cards
              </button>
            </div>
          </div>
        </div>
        {timeMode === 'last12months' && (
          <div className="glass rounded-xl p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-accent-teal-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-theme-muted">
              Showing revenue and metrics for the last 12 months. This matches the time period used on the Dashboard.
              Switch to "Lifetime" to see all-time totals.
            </p>
          </div>
        )}
      </div>

      {!isAllBrandsView && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="glass-card rounded-2xl p-6 glow-hover-blue">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-theme-muted uppercase tracking-wide">Total Accounts</span>
              <div className="rounded-xl p-2 bg-gradient-blue shadow-glow-blue">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
            </div>
            <span className="text-3xl font-semibold text-theme-text">{totalAccounts}</span>
            <p className="text-xs text-theme-muted mt-1">Active in selected period</p>
          </div>

          <div className="glass-card rounded-2xl p-6 glow-hover-teal">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-theme-muted uppercase tracking-wide">
                {timeMode === 'last12months' ? 'Period Cases' : 'Total Cases'}
              </span>
              <div className="rounded-xl p-2 bg-gradient-teal shadow-glow-teal">
                <Package className="w-5 h-5 text-white" />
              </div>
            </div>
            <span className="text-3xl font-semibold text-theme-text">
              {totalCases.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
            <p className="text-xs text-theme-muted mt-1">{periodLabel}</p>
          </div>

          <div className="glass-card rounded-2xl p-6 glow-hover-purple">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-theme-muted uppercase tracking-wide">
                {timeMode === 'last12months' ? 'Avg Monthly Cases' : 'Lifetime Cases'}
              </span>
              <div className="rounded-xl p-2 bg-gradient-orange">
                <Package className="w-5 h-5 text-white" />
              </div>
            </div>
            <span className="text-3xl font-semibold text-theme-text">
              {timeMode === 'last12months'
                ? Math.round(avgMonthlyCases).toLocaleString(undefined, { maximumFractionDigits: 0 })
                : totalLifetimeCases.toLocaleString(undefined, { maximumFractionDigits: 0 })
              }
            </span>
            <p className="text-xs text-theme-muted mt-1">
              {timeMode === 'last12months' ? 'Average per month' : 'All-time total'}
            </p>
          </div>
        </div>
      )}

      <div className="mb-6">
        <div className="flex items-center gap-4 mb-3">
          <div className="glass rounded-xl p-1 inline-flex items-center gap-2">
            <button
              onClick={() => setPremiseFilter('all')}
              className={`px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-300 ${
                premiseFilter === 'all'
                  ? 'bg-gradient-blue text-white shadow-glow-blue'
                  : 'text-theme-muted hover:text-theme-text hover:bg-white/5'
              }`}
            >
              <Building2 className="w-4 h-4" />
              ALL
            </button>
            <button
              onClick={() => setPremiseFilter('on_premise')}
              className={`px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-300 ${
                premiseFilter === 'on_premise'
                  ? 'bg-gradient-blue text-white shadow-glow-blue'
                  : 'text-theme-muted hover:text-theme-text hover:bg-white/5'
              }`}
            >
              <Wine className="w-4 h-4" />
              ON-PREMISE
            </button>
            <button
              onClick={() => setPremiseFilter('off_premise')}
              className={`px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-300 ${
                premiseFilter === 'off_premise'
                  ? 'bg-gradient-blue text-white shadow-glow-blue'
                  : 'text-theme-muted hover:text-theme-text hover:bg-white/5'
              }`}
            >
              <Store className="w-4 h-4" />
              OFF-PREMISE
            </button>
            <button
              onClick={() => setPremiseFilter('online')}
              className={`px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-300 ${
                premiseFilter === 'online'
                  ? 'bg-gradient-blue text-white shadow-glow-blue'
                  : 'text-theme-muted hover:text-theme-text hover:bg-white/5'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              ONLINE
            </button>
            <button
              onClick={() => setPremiseFilter('unclassified')}
              className={`px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-300 ${
                premiseFilter === 'unclassified'
                  ? 'bg-gradient-blue text-white shadow-glow-blue'
                  : 'text-theme-muted hover:text-theme-text hover:bg-white/5'
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              UNCLASSIFIED
            </button>
          </div>

          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-theme-muted" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="glass rounded-xl px-4 py-2.5 text-sm font-medium text-theme-text focus-ring cursor-pointer"
            >
              <option value="cases-desc">Cases (High to Low)</option>
              <option value="cases-asc">Cases (Low to High)</option>
              <option value="orders-desc">Orders (High to Low)</option>
              <option value="orders-asc">Orders (Low to High)</option>
              <option value="avg-monthly-desc">Avg Monthly Cases (High to Low)</option>
              <option value="avg-monthly-asc">Avg Monthly Cases (Low to High)</option>
              <option value="name-asc">Account Name (A-Z)</option>
              <option value="name-desc">Account Name (Z-A)</option>
              <option value="first-order-desc">First Order (Newest)</option>
              <option value="first-order-asc">First Order (Oldest)</option>
              <option value="last-order-desc">Last Order (Newest)</option>
              <option value="last-order-asc">Last Order (Oldest)</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-theme-muted">
          Filter accounts by type. On-premise: bars, restaurants, nightclubs. Off-premise: retail stores, liquor shops.
        </p>
      </div>

      <div className="glass-card rounded-2xl glow-hover-blue">
        <div className="p-6 border-b table-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-theme-muted w-5 h-5" />
            <input
              type="text"
              placeholder="Search accounts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 glass rounded-xl text-theme-text placeholder:text-theme-muted/60 focus-ring"
            />
          </div>
        </div>

        {filteredAccounts.length === 0 ? (
          <div className="p-8 text-center text-theme-muted">
            {searchTerm ? 'No accounts found matching your search.' : 'No accounts data available.'}
          </div>
        ) : viewMode === 'list' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b table-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-theme-muted uppercase tracking-wider">
                    Account Name
                  </th>
                  {isAllBrandsView && (
                    <th className="px-6 py-3 text-left text-xs font-semibold text-theme-muted uppercase tracking-wider">
                      Organization
                    </th>
                  )}
                  <th className="px-6 py-3 text-right text-xs font-semibold text-theme-muted uppercase tracking-wider">
                    {timeMode === 'last12months' ? 'Period Cases' : 'Total Cases'}
                  </th>
                  {timeMode === 'last12months' && !isAllBrandsView && (
                    <th className="px-6 py-3 text-right text-xs font-semibold text-theme-muted uppercase tracking-wider">
                      Lifetime Cases
                    </th>
                  )}
                  <th className="px-6 py-3 text-right text-xs font-semibold text-theme-muted uppercase tracking-wider">
                    Avg Monthly Cases
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-theme-muted uppercase tracking-wider">
                    Orders
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-theme-muted uppercase tracking-wider">
                    First Order
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-theme-muted uppercase tracking-wider">
                    Last Order
                  </th>
                </tr>
              </thead>
              <tbody className="table-divide">
                {filteredAccounts.map((account) => (
                  <tr
                    key={`${account.organization_id || 'default'}-${account.id}`}
                    onClick={() => handleAccountClick(account.id, account.organization_id)}
                    className="hover:bg-white/5 transition cursor-pointer"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-theme-text">{account.account_name}</span>
                        {account.premise_type === 'on_premise' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-blue text-white text-xs font-semibold">
                            <Wine className="w-3 h-3" />
                            On
                          </span>
                        )}
                        {account.premise_type === 'off_premise' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-teal text-white text-xs font-semibold">
                            <Store className="w-3 h-3" />
                            Off
                          </span>
                        )}
                        {account.premise_type === 'online' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-green text-white text-xs font-semibold">
                            <ShoppingCart className="w-3 h-3" />
                            Online
                          </span>
                        )}
                        {account.premise_type === 'unclassified' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-400 dark:bg-zinc-600 text-white text-xs font-semibold">
                            <HelpCircle className="w-3 h-3" />
                            ?
                          </span>
                        )}
                      </div>
                    </td>
                    {isAllBrandsView && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-theme-text">{account.organization_name || 'Unknown'}</span>
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-theme-text font-semibold">
                      {Number(account.total_cases).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    {timeMode === 'last12months' && !isAllBrandsView && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-theme-muted text-sm">
                        {account.lifetime_cases
                          ? Number(account.lifetime_cases).toLocaleString(undefined, { maximumFractionDigits: 0 })
                          : '-'}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-theme-text">
                      {Math.round(account.average_monthly_cases || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-theme-text">
                      {account.total_orders}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-theme-muted text-sm">
                      {account.first_order_date ? format(new Date(account.first_order_date), 'MMM dd, yyyy') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-theme-muted text-sm">
                      {account.last_order_date ? format(new Date(account.last_order_date), 'MMM dd, yyyy') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
            {filteredAccounts.map((account) => (
              <div
                key={`${account.organization_id || 'default'}-${account.id}`}
                onClick={() => handleAccountClick(account.id, account.organization_id)}
                className="glass-card rounded-2xl p-6 hover:shadow-hover-lift transition-all cursor-pointer hover:scale-[1.02] duration-200 glow-hover-purple"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-theme-text truncate">
                        {account.account_name}
                      </h3>
                      {account.premise_type === 'on_premise' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-blue text-white text-xs font-semibold flex-shrink-0">
                          <Wine className="w-3 h-3" />
                          On
                        </span>
                      )}
                      {account.premise_type === 'off_premise' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-teal text-white text-xs font-semibold flex-shrink-0">
                          <Store className="w-3 h-3" />
                          Off
                        </span>
                      )}
                      {account.premise_type === 'online' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-green text-white text-xs font-semibold flex-shrink-0">
                          <ShoppingCart className="w-3 h-3" />
                          Online
                        </span>
                      )}
                      {account.premise_type === 'unclassified' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-400 dark:bg-zinc-600 text-white text-xs font-semibold flex-shrink-0">
                          <HelpCircle className="w-3 h-3" />
                          ?
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-theme-muted">{account.total_orders} orders</p>
                    {isAllBrandsView && account.organization_name && (
                      <p className="text-xs text-theme-muted mt-1">
                        <Building2 className="w-3 h-3 inline mr-1" />
                        {account.organization_name}
                      </p>
                    )}
                  </div>
                  <div className="ml-3 flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-gradient-blue flex items-center justify-center text-white font-semibold text-lg shadow-glow-blue">
                      {account.account_name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between py-3 border-t table-border">
                    <span className="text-sm text-theme-muted">
                      {timeMode === 'last12months' ? 'Period Cases' : 'Total Cases'}
                    </span>
                    <span className="text-lg font-semibold text-theme-text">
                      {Number(account.total_cases).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>

                  {timeMode === 'last12months' && !isAllBrandsView && account.lifetime_cases && (
                    <div className="flex items-center justify-between py-3 border-t table-border">
                      <span className="text-sm text-theme-muted">Lifetime Cases</span>
                      <span className="text-sm font-medium text-theme-muted">
                        {Number(account.lifetime_cases).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between py-3 border-t table-border">
                    <span className="text-sm text-theme-muted">Avg Monthly Cases</span>
                    <span className="text-sm font-semibold text-theme-text">
                      {Math.round(account.average_monthly_cases || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-3 border-t table-border">
                    <div className="flex flex-col">
                      <span className="text-xs text-theme-muted mb-1">First Order</span>
                      <span className="text-sm font-medium text-theme-text">
                        {account.first_order_date ? format(new Date(account.first_order_date), 'MMM dd, yyyy') : '-'}
                      </span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-xs text-theme-muted mb-1">Last Order</span>
                      <span className="text-sm font-medium text-theme-text">
                        {account.last_order_date ? format(new Date(account.last_order_date), 'MMM dd, yyyy') : '-'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
