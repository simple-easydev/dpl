import { useEffect, useState } from 'react';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';
import { TrendingUp, TrendingDown, Users, ShoppingCart, DollarSign, Target, ArrowUpRight, ArrowDownRight, Minus, Sparkles, AlertTriangle, Info, Calendar } from 'lucide-react';
import { format, isBefore } from 'date-fns';
import PeriodSelector, { DateRange } from '../components/PeriodSelector';
import DateRangeSelector from '../components/DateRangeSelector';
import BrandSelector from '../components/BrandSelector';
import { MetricComparisonChart, DailyTrendChart, DistributionComparison } from '../components/ComparisonCharts';
import {
  getComparisonMetrics,
  getAggregateComparisonMetrics,
  ComparisonMetrics,
  calculateChange,
  generateComparisonInsights,
  generateBrandComparisonInsights,
  findTopGainersAndLosers,
  ComparisonInsight,
  getBrandComparisonMetrics,
  logBrandComparison,
  PeriodRange,
} from '../lib/comparisonAnalytics';
import { getAvailableMonths, getAvailableMonthsAllBrands } from '../lib/monthUtils';

export default function ComparePage() {
  const { currentOrganization, isViewingAllBrands, isPlatformAdmin: isOrgPlatformAdmin } = useOrganization();
  const { isPlatformAdmin, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);

  const [comparisonMode, setComparisonMode] = useState<'period' | 'brand'>('period');

  const [currentPeriod, setCurrentPeriod] = useState<DateRange | null>(null);
  const [previousPeriod, setPreviousPeriod] = useState<DateRange | null>(null);

  const [brandPeriod, setBrandPeriod] = useState<DateRange | null>(null);
  const [brandAId, setBrandAId] = useState<string>('');
  const [brandBId, setBrandBId] = useState<string>('');
  const [brandAName, setBrandAName] = useState<string>('');
  const [brandBName, setBrandBName] = useState<string>('');

  const [earlierMetrics, setEarlierMetrics] = useState<ComparisonMetrics | null>(null);
  const [laterMetrics, setLaterMetrics] = useState<ComparisonMetrics | null>(null);
  const [insights, setInsights] = useState<ComparisonInsight[]>([]);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  useEffect(() => {
    const initializeDefaultPeriods = async () => {
      setInitializing(true);

      let availableMonths;
      if (isPlatformAdmin && !currentOrganization) {
        availableMonths = await getAvailableMonthsAllBrands();
      } else if (currentOrganization) {
        availableMonths = await getAvailableMonths(currentOrganization.id);
      } else {
        setInitializing(false);
        return;
      }

      if (availableMonths.length >= 2) {
        const laterMonth = availableMonths[0];
        const earlierMonth = availableMonths[1];

        setCurrentPeriod({
          startDate: laterMonth.startDate,
          endDate: laterMonth.endDate,
          label: laterMonth.label,
        });

        setPreviousPeriod({
          startDate: earlierMonth.startDate,
          endDate: earlierMonth.endDate,
          label: earlierMonth.label,
        });
      } else if (availableMonths.length === 1) {
        const onlyMonth = availableMonths[0];
        setCurrentPeriod({
          startDate: onlyMonth.startDate,
          endDate: onlyMonth.endDate,
          label: onlyMonth.label,
        });
        setPreviousPeriod({
          startDate: onlyMonth.startDate,
          endDate: onlyMonth.endDate,
          label: onlyMonth.label,
        });
      }

      setInitializing(false);
    };

    initializeDefaultPeriods();
  }, [currentOrganization, isPlatformAdmin]);

  useEffect(() => {
    const fetchComparisonData = async () => {
      if (comparisonMode === 'period') {
        if (!currentPeriod || !previousPeriod) return;

        if (!isPlatformAdmin && !currentOrganization) return;

        setLoading(true);

        const isCurrentEarlier = isBefore(currentPeriod.startDate, previousPeriod.startDate);
        const earlierPeriod = isCurrentEarlier ? currentPeriod : previousPeriod;
        const laterPeriod = isCurrentEarlier ? previousPeriod : currentPeriod;

        let earlier, later;
        if (isPlatformAdmin && !currentOrganization) {
          [earlier, later] = await Promise.all([
            getAggregateComparisonMetrics(earlierPeriod),
            getAggregateComparisonMetrics(laterPeriod),
          ]);
        } else if (currentOrganization) {
          [earlier, later] = await Promise.all([
            getComparisonMetrics(currentOrganization.id, earlierPeriod),
            getComparisonMetrics(currentOrganization.id, laterPeriod),
          ]);
        } else {
          setLoading(false);
          return;
        }

        setEarlierMetrics(earlier);
        setLaterMetrics(later);

        if (later && earlier) {
          const generatedInsights = generateComparisonInsights(later, earlier);
          setInsights(generatedInsights);
        }

        setLoading(false);
      } else if (comparisonMode === 'brand') {
        if (!brandPeriod || !brandAId || !brandBId) return;

        setLoading(true);

        const periodRange: PeriodRange = {
          startDate: brandPeriod.startDate,
          endDate: brandPeriod.endDate,
          label: brandPeriod.label,
        };

        const { brandA, brandB } = await getBrandComparisonMetrics(
          brandAId,
          brandBId,
          periodRange
        );

        setEarlierMetrics(brandB);
        setLaterMetrics(brandA);

        if (brandA && brandB) {
          const generatedInsights = generateBrandComparisonInsights(brandA, brandB);
          setInsights(generatedInsights);

          if (user) {
            await logBrandComparison(user.id, brandAId, brandBId, periodRange);
          }
        }

        setLoading(false);
      }
    };

    fetchComparisonData();
  }, [currentOrganization, currentPeriod, previousPeriod, comparisonMode, brandPeriod, brandAId, brandBId, user, isPlatformAdmin]);

  const handlePeriodChange = (current: DateRange, previous: DateRange) => {
    setCurrentPeriod(current);
    setPreviousPeriod(previous);
  };

  if (initializing || loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (comparisonMode === 'period' && !currentPeriod) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Period Comparison</h1>
        <div className="glass-card rounded-xl shadow-sm border border-gray-200 dark:border-white/10 p-8 text-center text-gray-600 dark:text-zinc-400">
          No data available to compare periods. Upload sales data to get started.
        </div>
      </div>
    );
  }

  if (comparisonMode === 'brand' && (!brandAId || !brandBId || !brandPeriod)) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Brand Comparison</h1>
        <div className="glass-card rounded-xl shadow-sm border border-gray-200 dark:border-white/10 p-8 text-center text-gray-600 dark:text-zinc-400">
          Select two brands and a time period to compare their performance.
        </div>
      </div>
    );
  }

  if (!laterMetrics || !earlierMetrics) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Period Comparison</h1>
        <div className="glass-card rounded-xl shadow-sm border border-gray-200 dark:border-white/10 p-8 text-center text-gray-600 dark:text-zinc-400">
          Not enough data to compare periods. Upload more sales data to see comparisons.
        </div>
      </div>
    );
  }

  const hasData = laterMetrics.revenue > 0 || earlierMetrics.revenue > 0;

  const isCurrentEarlier = comparisonMode === 'period' && currentPeriod && previousPeriod
    ? isBefore(currentPeriod.startDate, previousPeriod.startDate)
    : false;
  const earlierPeriod = comparisonMode === 'period' && currentPeriod && previousPeriod
    ? (isCurrentEarlier ? currentPeriod : previousPeriod)
    : brandPeriod;
  const laterPeriod = comparisonMode === 'period' && currentPeriod && previousPeriod
    ? (isCurrentEarlier ? previousPeriod : currentPeriod)
    : brandPeriod;

  const earlierLabel = comparisonMode === 'brand'
    ? (earlierMetrics.organizationName || 'Brand B')
    : (earlierPeriod?.label || 'Earlier Period');
  const laterLabel = comparisonMode === 'brand'
    ? (laterMetrics.organizationName || 'Brand A')
    : (laterPeriod?.label || 'Later Period');

  if (!hasData) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Period Comparison</h1>
        <div className="glass-card rounded-xl shadow-sm border border-gray-200 dark:border-white/10 p-8 text-center text-gray-600 dark:text-zinc-400">
          No data available for the selected periods. Try adjusting your date range.
        </div>
      </div>
    );
  }

  const gainersAndLosers = findTopGainersAndLosers(laterMetrics, earlierMetrics);

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {comparisonMode === 'period' ? 'Advanced Period Comparison' : 'Brand Comparison'}
          </h1>
          {isPlatformAdmin && comparisonMode === 'period' && !currentOrganization && (
            <span className="px-3 py-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold rounded-full shadow-sm">
              All Brands
            </span>
          )}
          {currentOrganization && (
            <span className="px-3 py-1 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 text-sm font-medium rounded-full">
              {currentOrganization.name}
            </span>
          )}
        </div>
        <p className="text-gray-600 dark:text-zinc-400">
          {comparisonMode === 'period'
            ? isPlatformAdmin && !currentOrganization
              ? 'Compare aggregated performance metrics across all brands for different time periods'
              : 'Compare performance metrics across different time periods to identify trends and opportunities'
            : 'Compare performance metrics between different brands over the same time period'}
        </p>
      </div>

      {isPlatformAdmin && (
        <div className="flex gap-3 p-1 bg-slate-100 dark:bg-zinc-800 rounded-lg w-fit">
          <button
            onClick={() => setComparisonMode('period')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              comparisonMode === 'period'
                ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-accent-primary shadow-sm'
                : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Period Comparison
            </div>
          </button>
          <button
            onClick={() => setComparisonMode('brand')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              comparisonMode === 'brand'
                ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-accent-primary shadow-sm'
                : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Brand Comparison
            </div>
          </button>
        </div>
      )}

      {comparisonMode === 'period' ? (
        <PeriodSelector
          onPeriodChange={handlePeriodChange}
          currentPeriod={currentPeriod}
          previousPeriod={previousPeriod}
        />
      ) : (
        <div className="glass-card rounded-xl p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <BrandSelector
              selectedBrandId={brandAId}
              onSelectBrand={(id, name) => {
                setBrandAId(id);
                setBrandAName(name);
              }}
              label="Brand A"
              excludeBrandId={brandBId}
            />
            <BrandSelector
              selectedBrandId={brandBId}
              onSelectBrand={(id, name) => {
                setBrandBId(id);
                setBrandBName(name);
              }}
              label="Brand B"
              excludeBrandId={brandAId}
            />
            <DateRangeSelector
              selectedPeriod={brandPeriod}
              onPeriodChange={(period) => setBrandPeriod(period)}
              label="Time Period"
            />
          </div>
        </div>
      )}

      {insights.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">Key Insights</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {insights.map((insight, index) => (
              <InsightCard key={index} insight={insight} index={index} />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Revenue"
          later={laterMetrics.revenue}
          earlier={earlierMetrics.revenue}
          formatter={(val) =>
            `$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
          }
          icon={<DollarSign className="w-5 h-5" />}
          iconColor="bg-green-100 text-green-600"
          laterPeriodLabel={laterLabel}
          earlierPeriodLabel={earlierLabel}
        />

        <MetricCard
          title="Total Orders"
          later={laterMetrics.orders}
          earlier={earlierMetrics.orders}
          formatter={(val) => val.toLocaleString()}
          icon={<ShoppingCart className="w-5 h-5" />}
          iconColor="bg-blue-100 text-blue-600"
          laterPeriodLabel={laterLabel}
          earlierPeriodLabel={earlierLabel}
        />

        <MetricCard
          title="Unique Accounts"
          later={laterMetrics.uniqueAccounts}
          earlier={earlierMetrics.uniqueAccounts}
          formatter={(val) => val.toLocaleString()}
          icon={<Users className="w-5 h-5" />}
          iconColor="bg-slate-100 text-gray-600 dark:text-zinc-400"
          laterPeriodLabel={laterLabel}
          earlierPeriodLabel={earlierLabel}
        />

        <MetricCard
          title="Avg Order Value"
          later={laterMetrics.averageOrderValue}
          earlier={earlierMetrics.averageOrderValue}
          formatter={(val) =>
            `$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
          }
          icon={<Target className="w-5 h-5" />}
          iconColor="bg-orange-100 text-orange-600"
          laterPeriodLabel={laterLabel}
          earlierPeriodLabel={earlierLabel}
        />

        <MetricCard
          title="Revenue Per Day"
          later={laterMetrics.revenuePerDay}
          earlier={earlierMetrics.revenuePerDay}
          formatter={(val) =>
            `$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
          }
          icon={<TrendingUp className="w-5 h-5" />}
          iconColor="bg-teal-100 text-teal-600"
          laterPeriodLabel={laterLabel}
          earlierPeriodLabel={earlierLabel}
        />

        <MetricCard
          title="New Accounts"
          later={laterMetrics.newAccounts}
          earlier={earlierMetrics.newAccounts}
          formatter={(val) => val.toLocaleString()}
          icon={<Users className="w-5 h-5" />}
          iconColor="bg-cyan-100 text-cyan-600"
          laterPeriodLabel={laterLabel}
          earlierPeriodLabel={earlierLabel}
        />
      </div>

      {laterMetrics.dailyTrend.length > 0 && earlierMetrics.dailyTrend.length > 0 && (
        <DailyTrendChart
          currentData={laterMetrics.dailyTrend}
          previousData={earlierMetrics.dailyTrend}
          currentPeriodLabel={laterLabel}
          previousPeriodLabel={earlierLabel}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MetricComparisonChart
          data={[
            {
              name: 'Orders',
              current: laterMetrics.orders,
              previous: earlierMetrics.orders,
            },
            {
              name: 'New Accounts',
              current: laterMetrics.newAccounts,
              previous: earlierMetrics.newAccounts,
            },
          ]}
          title="Core Metrics Comparison"
          valueFormatter={(value) => value.toLocaleString()}
          currentPeriodLabel={laterLabel}
          previousPeriodLabel={earlierLabel}
        />

        <div className="glass-card rounded-xl shadow-sm border border-gray-200 dark:border-white/10 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Performance Summary</h3>
          <div className="space-y-4">
            <SummaryRow
              label="Revenue Change"
              later={laterMetrics.revenue}
              earlier={earlierMetrics.revenue}
              isPercent={true}
            />
            <SummaryRow
              label="Order Volume Change"
              later={laterMetrics.orders}
              earlier={earlierMetrics.orders}
              isPercent={true}
            />
            <SummaryRow
              label="Account Growth"
              later={laterMetrics.uniqueAccounts}
              earlier={earlierMetrics.uniqueAccounts}
              isPercent={true}
            />
            <SummaryRow
              label="AOV Change"
              later={laterMetrics.averageOrderValue}
              earlier={earlierMetrics.averageOrderValue}
              isPercent={true}
            />
          </div>
        </div>
      </div>

      <ExpandableSection
        title="Top Performers & Decliners"
        isExpanded={expandedSection === 'performers'}
        onToggle={() =>
          setExpandedSection(expandedSection === 'performers' ? null : 'performers')
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-green-600" />
              Top Product Gainers
            </h4>
            <div className="space-y-2">
              {gainersAndLosers.productGainers.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{item.name}</p>
                    <p className="text-xs text-gray-600 dark:text-zinc-400">
                      ${item.currentRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div className="text-green-600 dark:text-green-400 font-semibold">
                    +{item.change.toFixed(1)}%
                  </div>
                </div>
              ))}
              {gainersAndLosers.productGainers.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-zinc-500 text-center py-4">No significant gainers</p>
              )}
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <ArrowDownRight className="w-5 h-5 text-red-600" />
              Top Product Decliners
            </h4>
            <div className="space-y-2">
              {gainersAndLosers.productLosers.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{item.name}</p>
                    <p className="text-xs text-gray-600 dark:text-zinc-400">
                      ${item.currentRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div className="text-red-600 dark:text-red-400 font-semibold">
                    {item.change.toFixed(1)}%
                  </div>
                </div>
              ))}
              {gainersAndLosers.productLosers.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-zinc-500 text-center py-4">No significant decliners</p>
              )}
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-green-600" />
              Top Account Gainers
            </h4>
            <div className="space-y-2">
              {gainersAndLosers.accountGainers.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{item.name}</p>
                    <p className="text-xs text-gray-600 dark:text-zinc-400">
                      ${item.currentRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div className="text-green-600 dark:text-green-400 font-semibold">
                    +{item.change.toFixed(1)}%
                  </div>
                </div>
              ))}
              {gainersAndLosers.accountGainers.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-zinc-500 text-center py-4">No significant gainers</p>
              )}
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <ArrowDownRight className="w-5 h-5 text-red-600" />
              Top Account Decliners
            </h4>
            <div className="space-y-2">
              {gainersAndLosers.accountLosers.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{item.name}</p>
                    <p className="text-xs text-gray-600 dark:text-zinc-400">
                      ${item.currentRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div className="text-red-600 dark:text-red-400 font-semibold">
                    {item.change.toFixed(1)}%
                  </div>
                </div>
              ))}
              {gainersAndLosers.accountLosers.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-zinc-500 text-center py-4">No significant decliners</p>
              )}
            </div>
          </div>
        </div>
      </ExpandableSection>

      {laterMetrics.representativePerformance.length > 0 && (
        <ExpandableSection
          title="Representative Performance Comparison"
          isExpanded={expandedSection === 'representatives'}
          onToggle={() =>
            setExpandedSection(expandedSection === 'representatives' ? null : 'representatives')
          }
        >
          <DistributionComparison
            currentData={laterMetrics.representativePerformance.map(r => ({
              name: r.representative,
              value: r.revenue,
            }))}
            previousData={earlierMetrics.representativePerformance.map(r => ({
              name: r.representative,
              value: r.revenue,
            }))}
            title="Revenue by Representative"
            currentPeriodLabel={laterLabel}
            previousPeriodLabel={earlierLabel}
          />
        </ExpandableSection>
      )}
    </div>
  );
}

interface InsightCardProps {
  insight: ComparisonInsight;
  index: number;
}

function InsightCard({ insight, index }: InsightCardProps) {
  const getInsightConfig = () => {
    switch (insight.type) {
      case 'positive':
        return {
          gradient: 'from-emerald-500/10 via-teal-500/5 to-transparent',
          borderGradient: 'from-emerald-400 via-teal-400 to-emerald-500',
          iconBg: 'bg-gradient-to-br from-emerald-400 to-teal-500',
          icon: <Sparkles className="w-5 h-5 text-white" />,
          accentColor: 'text-emerald-600',
          shadowColor: 'hover:shadow-emerald-200/50',
          glowColor: 'before:bg-emerald-400/20',
        };
      case 'negative':
        return {
          gradient: 'from-rose-500/10 via-orange-500/5 to-transparent',
          borderGradient: 'from-rose-400 via-orange-400 to-rose-500',
          iconBg: 'bg-gradient-to-br from-rose-400 to-orange-500',
          icon: <AlertTriangle className="w-5 h-5 text-white" />,
          accentColor: 'text-rose-600',
          shadowColor: 'hover:shadow-rose-200/50',
          glowColor: 'before:bg-rose-400/20',
        };
      default:
        return {
          gradient: 'from-sky-500/10 via-blue-500/5 to-transparent',
          borderGradient: 'from-sky-400 via-blue-400 to-sky-500',
          iconBg: 'bg-gradient-to-br from-sky-400 to-blue-500',
          icon: <Info className="w-5 h-5 text-white" />,
          accentColor: 'text-sky-600',
          shadowColor: 'hover:shadow-sky-200/50',
          glowColor: 'before:bg-sky-400/20',
        };
    }
  };

  const config = getInsightConfig();

  return (
    <div
      className="group relative overflow-hidden"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br ${config.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
      />

      <div
        className={`relative h-full glass-card rounded-2xl border-2 border-transparent bg-clip-padding
          before:absolute before:inset-0 before:rounded-2xl before:p-[2px]
          before:bg-gradient-to-br before:${config.borderGradient} before:-z-10
          transform transition-all duration-300 ease-out
          hover:scale-[1.02] hover:shadow-xl ${config.shadowColor}`}
      >
        <div className="relative p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight mb-1">
                {insight.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed">
                {insight.description}
              </p>
            </div>

            <div
              className={`flex-shrink-0 w-12 h-12 rounded-xl ${config.iconBg}
                flex items-center justify-center shadow-lg
                transform transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6`}
            >
              {config.icon}
            </div>
          </div>

          {Math.abs(insight.change) > 0 && (
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <div
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold ${config.accentColor}
                  bg-gradient-to-r ${config.gradient} backdrop-blur-sm`}
              >
                {insight.type === 'positive' ? (
                  <TrendingUp className="w-4 h-4" />
                ) : insight.type === 'negative' ? (
                  <TrendingDown className="w-4 h-4" />
                ) : (
                  <Minus className="w-4 h-4" />
                )}
                <span>
                  {insight.type === 'positive' ? '+' : ''}
                  {Math.abs(insight.change).toFixed(1)}%
                </span>
              </div>
              <span className="text-xs text-gray-500 dark:text-zinc-500 font-medium">vs previous period</span>
            </div>
          )}

          <div
            className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl ${config.glowColor}
              opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10`}
          />
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  later: number;
  earlier: number;
  formatter: (value: number) => string;
  icon: React.ReactNode;
  iconColor: string;
  laterPeriodLabel: string;
  earlierPeriodLabel: string;
}

function MetricCard({ title, later, earlier, formatter, icon, iconColor, laterPeriodLabel, earlierPeriodLabel }: MetricCardProps) {
  const change = calculateChange(later, earlier);
  const isPositive = change >= 0;
  const isNeutral = Math.abs(change) < 0.1;

  return (
    <div className="glass-card rounded-xl shadow-sm border border-gray-200 dark:border-white/10 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-600 dark:text-zinc-400">{title}</h3>
        <div className={`rounded-lg p-2 ${iconColor}`}>{icon}</div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatter(later)}</p>
          <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">{laterPeriodLabel}</p>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-white/10">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">{formatter(earlier)}</p>
            <p className="text-xs text-gray-500 dark:text-zinc-500">{earlierPeriodLabel}</p>
          </div>
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
              isNeutral
                ? 'bg-slate-100 text-gray-600 dark:text-zinc-400'
                : isPositive
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {isNeutral ? (
              <Minus className="w-3 h-3" />
            ) : isPositive ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            <span>{Math.abs(change).toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SummaryRowProps {
  label: string;
  later: number;
  earlier: number;
  isPercent: boolean;
}

function SummaryRow({ label, later, earlier, isPercent }: SummaryRowProps) {
  const change = calculateChange(later, earlier);
  const isPositive = change >= 0;

  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-gray-700 dark:text-zinc-300">{label}</span>
      <div className="flex items-center gap-2">
        {isPercent && (
          <span
            className={`text-sm font-semibold ${
              isPositive ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {isPositive ? '+' : ''}
            {change.toFixed(1)}%
          </span>
        )}
        {!isPercent && (
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {later.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        )}
      </div>
    </div>
  );
}

interface ExpandableSectionProps {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function ExpandableSection({ title, isExpanded, onToggle, children }: ExpandableSectionProps) {
  return (
    <div className="glass-card rounded-xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
      >
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h2>
        <TrendingUp
          className={`w-5 h-5 text-gray-600 dark:text-zinc-400 transition-transform ${
            isExpanded ? 'rotate-90' : ''
          }`}
        />
      </button>
      {isExpanded && <div className="px-6 pb-6">{children}</div>}
    </div>
  );
}
