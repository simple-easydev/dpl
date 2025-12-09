import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrganization } from '../contexts/OrganizationContext';
import {
  calculateBlitzAccounts,
  filterBlitzAccounts,
  getRegionsList,
  BlitzAccount,
  BlitzCategory,
  BlitzFilters,
} from '../lib/salesBlitzAnalytics';
import { forceRecategorization } from '../lib/accountCategorization';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  Download,
  AlertCircle,
  Calendar,
  ChevronDown,
  ChevronUp,
  Info,
  MapPin,
  X,
  Building2,
  Wine,
  Store,
  HelpCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import ClassificationRow from '../components/ClassificationRow';

const CATEGORY_CONFIG = {
  large_active: {
    label: 'Large Active',
    description: 'Consistently selling 1+ case/month with recent orders',
    color: 'teal',
    icon: TrendingUp,
  },
  small_active: {
    label: 'Small Active',
    description: 'Lower volume but consistent orders',
    color: 'blue',
    icon: Minus,
  },
  large_loss: {
    label: 'Large Loss',
    description: 'Previously strong accounts now selling 75% less or stopped',
    color: 'orange',
    icon: TrendingDown,
  },
  small_loss: {
    label: 'Small Loss',
    description: 'Lower volume accounts that dropped off',
    color: 'orange',
    icon: AlertCircle,
  },
  one_time: {
    label: 'One-Time',
    description: 'Only ordered once, then nothing',
    color: 'gray',
    icon: Calendar,
  },
  inactive: {
    label: 'Inactive',
    description: 'No orders in 90+ days',
    color: 'gray',
    icon: Minus,
  },
};

export default function SalesBlitzPage() {
  const { currentOrganization } = useOrganization();

  const [accounts, setAccounts] = useState<BlitzAccount[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<BlitzAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [recategorizing, setRecategorizing] = useState(false);
  const [showRecategorizeConfirm, setShowRecategorizeConfirm] = useState(false);

  const [filters, setFilters] = useState<BlitzFilters>({
    search: '',
    sortBy: 'baseline',
    sortDirection: 'desc',
  });

  const [premiseFilter, setPremiseFilter] = useState<'all' | 'on_premise' | 'off_premise' | 'unclassified'>('all');

  const [states, setStates] = useState<string[]>([]);
  const [stateCounts, setStateCounts] = useState<Map<string, number>>(new Map());

  const [baselineMonths] = useState(8);
  const [recentMonths] = useState(3);
  const [largeThreshold] = useState(1.0);

  useEffect(() => {
    if (currentOrganization) {
      loadData();
    }
  }, [currentOrganization]);

  useEffect(() => {
    applyFilters();
    calculateStateCounts();
  }, [accounts, filters, premiseFilter]);

  const loadData = async () => {
    if (!currentOrganization) return;

    setLoading(true);
    try {
      const [blitzAccounts, regionsList] = await Promise.all([
        calculateBlitzAccounts(currentOrganization.id, baselineMonths, recentMonths, largeThreshold),
        getRegionsList(currentOrganization.id),
      ]);

      setAccounts(blitzAccounts);
      setStates(regionsList);
    } catch (error) {
      console.error('Error loading blitz data:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    const updatedFilters = {
      ...filters,
      premiseType: premiseFilter === 'all' ? undefined : premiseFilter,
    };
    const filtered = filterBlitzAccounts(accounts, updatedFilters);
    setFilteredAccounts(filtered);
  };

  const calculateStateCounts = () => {
    const counts = new Map<string, number>();
    const searchFiltered = accounts.filter(acc => {
      if (filters.search) {
        return acc.accountName.toLowerCase().includes(filters.search.toLowerCase());
      }
      return true;
    });

    searchFiltered.forEach(acc => {
      if (acc.region) {
        counts.set(acc.region, (counts.get(acc.region) || 0) + 1);
      }
    });
    setStateCounts(counts);
  };

  const clearStateFilter = () => {
    setFilters({ ...filters, region: undefined });
  };

  const getSortedStates = () => {
    return [...states].sort((a, b) => {
      const countA = stateCounts.get(a) || 0;
      const countB = stateCounts.get(b) || 0;
      return countB - countA;
    });
  };

  const handleRecategorize = async () => {
    if (!currentOrganization) return;

    setShowRecategorizeConfirm(false);
    setRecategorizing(true);

    try {
      await forceRecategorization(currentOrganization.id);
      await loadData();
    } catch (error) {
      console.error('Error recategorizing accounts:', error);
      alert('Failed to recategorize accounts. Please try again.');
    } finally {
      setRecategorizing(false);
    }
  };

  const getCategorizationStatus = () => {
    if (accounts.length === 0) return null;

    const firstAccount = accounts[0];
    if (!firstAccount.categorizedAt) return null;

    const daysSince = differenceInDays(new Date(), new Date(firstAccount.categorizedAt));
    const daysUntilNext = 30 - daysSince;

    return {
      categorizedAt: firstAccount.categorizedAt,
      daysSince,
      daysUntilNext,
      isAiCategorized: firstAccount.isAiCategorized,
    };
  };

  const handleExport = () => {
    const getPremiseTypeLabel = (type?: 'on_premise' | 'off_premise' | 'unclassified') => {
      switch (type) {
        case 'on_premise': return 'On-Premise';
        case 'off_premise': return 'Off-Premise';
        case 'unclassified': return 'Unclassified';
        default: return 'Unclassified';
      }
    };

    const csvContent = [
      ['Account Name', 'Premise Type', 'Category', 'Baseline Avg (cases)', 'Recent Avg (cases)', 'Trend %', 'Last Order Date', 'Days Since Order', 'Total Orders'],
      ...filteredAccounts.map(acc => [
        acc.accountName,
        getPremiseTypeLabel(acc.premise_type),
        CATEGORY_CONFIG[acc.category].label,
        acc.baselineAvg.toFixed(2),
        acc.recentAvg.toFixed(2),
        acc.trendPercent.toFixed(1),
        acc.lastOrderDate ? format(parseISO(acc.lastOrderDate), 'yyyy-MM-dd') : '',
        acc.lastOrderDaysAgo.toString(),
        acc.totalOrders.toString(),
      ]),
    ]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-blitz-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary mx-auto mb-4"></div>
          <p className="text-theme-muted">{recategorizing ? 'Recategorizing accounts with AI...' : 'Analyzing account trends...'}</p>
        </div>
      </div>
    );
  }

  const categorizationStatus = getCategorizationStatus();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-semibold text-theme-text mb-2">Sales Blitz</h1>
          <p className="text-theme-muted">Categorize accounts by purchasing trends to prioritize outreach</p>
          {categorizationStatus && (
            <div className="mt-2 flex items-center gap-2">
              {categorizationStatus.isAiCategorized && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 text-xs font-medium text-purple-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  AI Categorized
                </span>
              )}
              <span className="text-xs text-theme-muted">
                {categorizationStatus.daysSince === 0 ? 'Today' : `${categorizationStatus.daysSince} days ago`}
                {categorizationStatus.daysUntilNext > 0 && (
                  <span> • Next auto-recategorization in {categorizationStatus.daysUntilNext} days</span>
                )}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowRecategorizeConfirm(true)}
            disabled={recategorizing}
            className="px-4 py-2.5 glass text-theme-text rounded-xl text-sm flex items-center gap-2 hover:bg-white/10 transition-all duration-300 font-semibold border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${recategorizing ? 'animate-spin' : ''}`} />
            {recategorizing ? 'Recategorizing...' : 'Recategorize with AI'}
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2.5 bg-gradient-blue text-white rounded-xl text-sm flex items-center gap-2 hover:shadow-glow-blue transition-all duration-300 font-semibold"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {showRecategorizeConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold text-theme-text mb-3">Recategorize with AI?</h3>
            <p className="text-sm text-theme-muted mb-4">
              This will use OpenAI to analyze all accounts and recategorize them based on their purchasing patterns. This may use API credits.
            </p>
            <p className="text-sm text-theme-muted mb-6">
              The categorization will be cached for 30 days to minimize API costs.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowRecategorizeConfirm(false)}
                className="px-4 py-2 glass rounded-lg text-theme-text hover:bg-white/10 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleRecategorize}
                className="px-4 py-2 bg-gradient-blue text-white rounded-lg hover:shadow-glow-blue transition-all duration-300 text-sm font-semibold"
              >
                Recategorize Now
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="glass rounded-xl p-4 flex items-start gap-3 mb-6">
        <Info className="w-5 h-5 text-accent-teal-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 text-sm text-theme-muted">
          <p className="font-semibold text-theme-text mb-1">How it works:</p>
          <p>
            Accounts are analyzed using AI to categorize them based on volume, trends, and recency. Accounts are compared by their <strong>baseline period</strong> (first 8 months)
            to <strong>recent activity</strong> (last 3 months). AI recategorizes automatically every 30 days or on demand.
          </p>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-theme-muted w-4 h-4" />
            <input
              type="text"
              placeholder="Search accounts..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-10 pr-4 py-2 glass rounded-xl text-theme-text placeholder:text-theme-muted/60 focus-ring text-sm"
            />
          </div>

          <div className="glass rounded-xl p-1 inline-flex items-center gap-1">
            <button
              onClick={() => setPremiseFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-300 ${
                premiseFilter === 'all'
                  ? 'bg-gradient-blue text-white shadow-glow-blue'
                  : 'text-theme-muted hover:text-theme-text hover:bg-white/5'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              ALL
            </button>
            <button
              onClick={() => setPremiseFilter('on_premise')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-300 ${
                premiseFilter === 'on_premise'
                  ? 'bg-gradient-blue text-white shadow-glow-blue'
                  : 'text-theme-muted hover:text-theme-text hover:bg-white/5'
              }`}
            >
              <Wine className="w-3.5 h-3.5" />
              ON
            </button>
            <button
              onClick={() => setPremiseFilter('off_premise')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-300 ${
                premiseFilter === 'off_premise'
                  ? 'bg-gradient-teal text-white shadow-glow-teal'
                  : 'text-theme-muted hover:text-theme-text hover:bg-white/5'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              OFF
            </button>
            <button
              onClick={() => setPremiseFilter('unclassified')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-300 ${
                premiseFilter === 'unclassified'
                  ? 'bg-gray-500 text-white'
                  : 'text-theme-muted hover:text-theme-text hover:bg-white/5'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              ?
            </button>
          </div>

          <div className="relative flex items-center gap-2">
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-theme-muted w-4 h-4 pointer-events-none" />
              <select
                value={filters.region || ''}
                onChange={(e) => setFilters({ ...filters, region: e.target.value || undefined })}
                className="pl-10 pr-4 py-2 glass rounded-xl text-sm text-theme-text border border-white/10 focus-ring appearance-none bg-theme-base/30 hover:bg-white/5 transition-all duration-300 min-w-[180px]"
                disabled={states.length === 0}
              >
                <option value="">{states.length > 0 ? 'All States' : 'No State Data'}</option>
                {getSortedStates().map(s => {
                  const count = stateCounts.get(s) || 0;
                  return (
                    <option key={s} value={s}>
                      {s} ({count})
                    </option>
                  );
                })}
              </select>
            </div>
            {filters.region && (
              <button
                onClick={clearStateFilter}
                className="p-2 glass rounded-xl hover:bg-red-500/20 transition-all duration-300 group"
                title="Clear state filter"
              >
                <X className="w-4 h-4 text-theme-muted group-hover:text-red-400" />
              </button>
            )}
          </div>

          <select
            value={filters.sortBy}
            onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as any })}
            className="px-3 py-2 glass rounded-xl text-sm text-theme-text border border-white/10 focus-ring"
          >
            <option value="baseline">Sort by Baseline</option>
            <option value="recent">Sort by Recent</option>
            <option value="trend">Sort by Trend</option>
            <option value="name">Sort by Name</option>
          </select>

          <button
            onClick={() => setFilters({ ...filters, sortDirection: filters.sortDirection === 'asc' ? 'desc' : 'asc' })}
            className="p-2 glass rounded-xl hover:bg-white/10 transition-all duration-300"
          >
            {filters.sortDirection === 'desc' ? (
              <ChevronDown className="w-4 h-4 text-theme-text" />
            ) : (
              <ChevronUp className="w-4 h-4 text-theme-text" />
            )}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {(Object.keys(CATEGORY_CONFIG) as BlitzCategory[]).map(category => {
          const config = CATEGORY_CONFIG[category];
          const categoryAccounts = filteredAccounts.filter(acc => acc.category === category);
          const totalCount = accounts.filter(acc => acc.category === category).length;

          return (
            <ClassificationRow
              key={category}
              category={category}
              label={config.label}
              description={config.description}
              color={config.color}
              icon={config.icon}
              accounts={categoryAccounts}
              totalCount={totalCount}
            />
          );
        })}
      </div>
    </div>
  );
}
