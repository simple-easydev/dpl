import { useEffect, useState } from 'react';
import { useOrganization } from '../contexts/OrganizationContext';
import { Trophy, Medal, Sparkles, Building2 } from 'lucide-react';
import FileUpload from '../components/FileUpload';
import MonthlyCaseTrendsChart from '../components/MonthlyCaseTrendsChart';
import RevenueBreakdownCharts, { TreemapChart } from '../components/RevenueBreakdownCharts';
import InsightCards from '../components/InsightCards';
import AdvancedMetrics from '../components/AdvancedMetrics';
import {
  getMonthlyRevenueData,
  getRevenueByCategory,
  getRevenueByRepresentative,
  getRevenueByRegion,
  getAccountMetrics,
  getTopProductsWithTrends,
  forecastNextMonthRevenue,
  calculateDepletionsMetrics,
  getTopAccountsLeaderboard,
  checkHasRevenueData,
  getTotalCasesSold,
  getBestMonth,
  getReorderRate,
  getMonthlyCasesTrendsByProduct,
  MonthlyRevenue,
  RevenueByCategory,
  AccountMetrics,
  ProductPerformance,
  DepletionsMetrics,
  RevenueForecast,
  TopAccountLeaderboard,
  TotalCasesMetrics,
  BestMonthMetrics,
  ReorderRateMetrics,
  ProductCasesTrend,
} from '../lib/revenueAnalytics';
import {
  getAggregatedMonthlyRevenueData,
  getAggregatedRevenueByRepresentative,
  getAggregatedRevenueByRegion,
  getAggregatedTopAccountsLeaderboard,
  getAggregatedTopProducts,
  getAggregatedTotalCases,
  checkHasAggregatedRevenueData,
  getAggregatedMonthlyCasesTrendsByProduct,
  AggregatedMonthlyRevenue,
  AggregatedProductPerformance,
  AggregatedTopAccountLeaderboard,
  AggregatedProductCasesTrend,
} from '../lib/aggregatedAnalytics';
import { generateInsights, Insight } from '../lib/insightGenerator';
import { supabase } from '../lib/supabase';

export default function Dashboard() {
  const { currentOrganization, isViewingAllBrands, loading: orgLoading } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [monthlyData, setMonthlyData] = useState<MonthlyRevenue[] | AggregatedMonthlyRevenue[]>([]);
  const [representativeData, setRepresentativeData] = useState<RevenueByCategory[]>([]);
  const [regionData, setRegionData] = useState<RevenueByCategory[]>([]);
  const [accountMetrics, setAccountMetrics] = useState<AccountMetrics[]>([]);
  const [productPerformance, setProductPerformance] = useState<ProductPerformance[] | AggregatedProductPerformance[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [depletionsMetrics, setDepletionsMetrics] = useState<DepletionsMetrics | undefined>();
  const [forecast, setForecast] = useState<RevenueForecast | undefined>();
  const [topAccountsLeaderboard, setTopAccountsLeaderboard] = useState<TopAccountLeaderboard[] | AggregatedTopAccountLeaderboard[]>([]);
  const [hasRevenueData, setHasRevenueData] = useState<boolean>(true);
  const [totalCasesMetrics, setTotalCasesMetrics] = useState<TotalCasesMetrics | undefined>();
  const [bestMonthMetrics, setBestMonthMetrics] = useState<BestMonthMetrics | undefined>();
  const [totalAccounts, setTotalAccounts] = useState<number>(0);
  const [reorderRateMetrics, setReorderRateMetrics] = useState<ReorderRateMetrics | undefined>();
  const [productCasesTrends, setProductCasesTrends] = useState<ProductCasesTrend[] | AggregatedProductCasesTrend[]>([]);

  const fetchAggregatedDashboardData = async () => {
    console.log('[Dashboard] fetchAggregatedDashboardData called for all brands');
    setLoading(true);
    setError(null);

    let timeoutId: NodeJS.Timeout | null = setTimeout(() => {
      console.error('[Dashboard] Data fetch timeout after 30 seconds');
      setError('Data fetch timeout. Please try refreshing.');
      setLoading(false);
      setHasData(false);
      timeoutId = null;
    }, 30000);

    try {
      console.log('[Dashboard] Fetching aggregated monthly revenue data...');
      const monthly = await getAggregatedMonthlyRevenueData(12);
      console.log('[Dashboard] Aggregated monthly data received:', monthly?.length, 'months');

      if (!monthly || monthly.length === 0) {
        console.log('[Dashboard] No aggregated data found');
        if (timeoutId) clearTimeout(timeoutId);
        setHasData(false);
        setLoading(false);
        setError(null);
        return;
      }

      setHasData(true);
      setMonthlyData(monthly);

      const hasRevenue = await checkHasAggregatedRevenueData();
      setHasRevenueData(hasRevenue);
      console.log('[Dashboard] Aggregated data has revenue:', hasRevenue);

      console.log('[Dashboard] Fetching additional aggregated data...');
      const [representative, region, topAccounts, products, totalCases, casesTrends] = await Promise.all([
        getAggregatedRevenueByRepresentative(15),
        getAggregatedRevenueByRegion(3),
        getAggregatedTopAccountsLeaderboard(5),
        getAggregatedTopProducts(10),
        getAggregatedTotalCases(),
        getAggregatedMonthlyCasesTrendsByProduct(12, 8),
      ]);

      console.log('[Dashboard] Additional aggregated data received:', {
        representatives: representative.length,
        regions: region.length,
        topAccounts: topAccounts.length,
        products: products.length,
        casesTrends: casesTrends.length,
      });

      setRepresentativeData(representative);
      setRegionData(region);
      setTopAccountsLeaderboard(topAccounts);
      setProductPerformance(products);
      setProductCasesTrends(casesTrends);
      setTotalCasesMetrics({
        totalCases: totalCases.totalCases,
        growthPercentage: totalCases.growthPercentage,
        currentMonthCases: 0,
        previousMonthCases: 0,
      });

      setAccountMetrics([]);
      setDepletionsMetrics(undefined);
      setForecast(undefined);
      setBestMonthMetrics(undefined);
      setInsights([]);

      // Fetch total accounts count across all organizations
      const { count: allAccountsCount } = await supabase
        .from('accounts')
        .select('*', { count: 'exact', head: true });
      setTotalAccounts(allAccountsCount || 0);

      if (timeoutId) clearTimeout(timeoutId);
      console.log('[Dashboard] Aggregated data fetch complete');
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('[Dashboard] Error fetching aggregated dashboard data:', err);
      console.error('[Dashboard] Error details:', err instanceof Error ? err.message : String(err));
      if (timeoutId) clearTimeout(timeoutId);
      setHasData(false);
      setLoading(false);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred. Please try refreshing.');
    }
  };

  const fetchDashboardData = async (orgId: string) => {
    console.log('[Dashboard] fetchDashboardData called, organization:', orgId);

    console.log('[Dashboard] Starting data fetch for organization:', orgId);
    setLoading(true);
    setError(null);

    let timeoutId: NodeJS.Timeout | null = setTimeout(() => {
      console.error('[Dashboard] Data fetch timeout after 30 seconds');
      setError('Data fetch timeout. Please try refreshing.');
      setLoading(false);
      setHasData(false);
      timeoutId = null;
    }, 30000);

    try {
      console.log('[Dashboard] Fetching monthly revenue data...');
      const monthly = await getMonthlyRevenueData(orgId, 12);
      console.log('[Dashboard] Monthly data received:', monthly?.length, 'months');

      if (!monthly || monthly.length === 0) {
        console.log('[Dashboard] No data found, showing upload prompt');
        if (timeoutId) clearTimeout(timeoutId);
        setHasData(false);
        setLoading(false);
        setError(null);
        return;
      }

      setHasData(true);
      setMonthlyData(monthly);

      const hasRevenue = await checkHasRevenueData(orgId);
      setHasRevenueData(hasRevenue);
      console.log('[Dashboard] Organization has revenue data:', hasRevenue);

      console.log('[Dashboard] Fetching additional data...');
      const [representative, region, accounts, products, topAccounts, totalCases, bestMonth, reorderRate, casesTrends] = await Promise.all([
        getRevenueByRepresentative(orgId, 15),
        getRevenueByRegion(orgId, 3),
        getAccountMetrics(orgId),
        getTopProductsWithTrends(orgId, 10),
        getTopAccountsLeaderboard(orgId, 5),
        getTotalCasesSold(orgId),
        getBestMonth(orgId),
        getReorderRate(orgId, 6),
        getMonthlyCasesTrendsByProduct(orgId, 12, 8),
      ]);

      console.log('[Dashboard] Additional data received:', {
        representatives: representative.length,
        regions: region.length,
        accounts: accounts.length,
        products: products.length,
        topAccounts: topAccounts.length,
        casesTrends: casesTrends.length,
      });

      setRepresentativeData(representative);
      setRegionData(region);
      setAccountMetrics(accounts);
      setProductPerformance(products);
      setTopAccountsLeaderboard(topAccounts);
      setProductCasesTrends(casesTrends);
      setTotalCasesMetrics(totalCases);
      setBestMonthMetrics(bestMonth);
      setReorderRateMetrics(reorderRate);

      // Fetch total accounts count
      const { count: accountsCount } = await supabase
        .from('accounts')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId);
      setTotalAccounts(accountsCount || 0);

      const depletions = calculateDepletionsMetrics(accounts, monthly);
      setDepletionsMetrics(depletions);

      const revenueForecast = forecastNextMonthRevenue(monthly);
      setForecast(revenueForecast);

      console.log('[Dashboard] Generating insights...');
      const generatedInsights = await generateInsights(
        monthly,
        accounts,
        products,
        representative,
        region,
        orgId
      );
      console.log('[Dashboard] Insights generated:', generatedInsights.length);
      setInsights(generatedInsights);

      if (timeoutId) clearTimeout(timeoutId);
      console.log('[Dashboard] Data fetch complete');
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('[Dashboard] Error fetching dashboard data:', err);
      console.error('[Dashboard] Error details:', err instanceof Error ? err.message : String(err));
      if (timeoutId) clearTimeout(timeoutId);
      setHasData(false);
      setLoading(false);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred. Please try refreshing.');
    }
  };


  useEffect(() => {
    console.log('[Dashboard] useEffect triggered');
    console.log('[Dashboard] orgLoading:', orgLoading);
    console.log('[Dashboard] isViewingAllBrands:', isViewingAllBrands);
    console.log('[Dashboard] currentOrganization:', currentOrganization);
    console.log('[Dashboard] currentOrganization?.id:', currentOrganization?.id);

    if (orgLoading) {
      console.log('[Dashboard] Organization context still loading, waiting...');
      setLoading(true);
      return;
    }

    if (isViewingAllBrands) {
      console.log('[Dashboard] Viewing all brands, fetching aggregated data');
      fetchAggregatedDashboardData();
    } else if (!currentOrganization?.id) {
      console.log('[Dashboard] No organization ID available');
      console.log('[Dashboard] Will show upload prompt');
      setLoading(false);
      setHasData(false);
      return;
    } else {
      console.log('[Dashboard] Fetching data for organization:', currentOrganization.id);
      console.log('[Dashboard] Organization name:', currentOrganization.name);
      fetchDashboardData(currentOrganization.id);
    }
  }, [currentOrganization?.id, isViewingAllBrands, orgLoading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary mx-auto mb-4"></div>
          <p className="text-theme-muted">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="glass-card rounded-2xl p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-theme-text mb-2">Error Loading Dashboard</h2>
          <p className="text-theme-muted mb-6">{error}</p>
          <button
            onClick={() => currentOrganization && fetchDashboardData(currentOrganization.id)}
            className="px-6 py-2.5 bg-gradient-blue text-white rounded-xl hover:shadow-glow-blue transition-all duration-300 font-semibold"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div>
        <h1 className="text-4xl font-semibold text-theme-text mb-8">Welcome to Sales Insights</h1>

        <div className="glass-card rounded-2xl p-8 mb-8 glow-hover-blue">
          <h2 className="text-2xl font-semibold text-theme-text mb-4">Get Started</h2>
          <p className="text-theme-muted mb-6 leading-relaxed">
            Upload your sales data to begin analyzing revenue trends, customer behavior, and product performance.
            Our AI will automatically detect your data structure and generate insights.
          </p>
          <FileUpload onUploadComplete={() => currentOrganization && fetchDashboardData(currentOrganization.id)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card rounded-2xl p-6 glow-hover-teal">
            <div className="bg-gradient-teal rounded-xl p-3 w-12 h-12 flex items-center justify-center mb-4 shadow-glow-teal">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
            </div>
            <h3 className="font-semibold text-theme-text mb-2 text-lg">Depletion Analytics</h3>
            <p className="text-sm text-theme-muted leading-relaxed">
              Track total revenue, growth trends, and period comparisons
            </p>
          </div>
          <div className="glass-card rounded-2xl p-6 glow-hover-blue">
            <div className="bg-gradient-blue rounded-xl p-3 w-12 h-12 flex items-center justify-center mb-4 shadow-glow-blue">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            </div>
            <h3 className="font-semibold text-theme-text mb-2 text-lg">Customer Insights</h3>
            <p className="text-sm text-theme-muted leading-relaxed">
              Analyze account performance, order frequency, and lifetime value
            </p>
          </div>
          <div className="glass-card rounded-2xl p-6 glow-hover-blue">
            <div className="bg-gradient-blue-light rounded-xl p-3 w-12 h-12 flex items-center justify-center mb-4 shadow-glow-blue">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-semibold text-theme-text mb-2 text-lg">AI-Powered Analysis</h3>
            <p className="text-sm text-theme-muted leading-relaxed">
              Get automated insights and recommendations based on your data
            </p>
          </div>
        </div>
      </div>
    );
  }

  const currentMonth = monthlyData[monthlyData.length - 1];
  const previousMonth = monthlyData.length > 1 ? monthlyData[monthlyData.length - 2] : null;

  const currentMonthRevenue = currentMonth?.revenue || 0;
  const previousMonthRevenue = previousMonth?.revenue || 0;
  const currentAccounts = currentMonth?.accounts || 0;
  const previousAccounts = previousMonth?.accounts || 0;
  const allTimeTotalCases = totalCasesMetrics?.totalCases || 0;
  const casesGrowthPercentage = totalCasesMetrics?.growthPercentage || 0;

  return (
    <div className="space-y-8">
      {isViewingAllBrands && (
        <div className="bg-gradient-to-r from-blue-50 to-teal-50 dark:from-blue-900/20 dark:to-teal-900/20 border border-blue-200 dark:border-blue-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-blue flex items-center justify-center shadow-glow-blue">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-300">
                Viewing All Brands
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400">
                You are viewing aggregated data across all client brands in the platform
              </p>
            </div>
          </div>
        </div>
      )}

      {!hasRevenueData && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/30 rounded-xl p-4">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Note:</strong> Not all depletion reports include revenue data. Metrics shown reflect available information based on product movement and account activity.
          </p>
        </div>
      )}

      <div>
        <h1 className="text-4xl font-semibold text-theme-text mb-2">
          {isViewingAllBrands ? 'Platform Analytics' : 'Depletion Analytics'}
        </h1>
        <p className="text-theme-muted mt-1">
          {isViewingAllBrands
            ? 'Comprehensive insights across all client brands'
            : 'Comprehensive monthly insights with AI-powered analysis'
          }
        </p>
      </div>

      <AdvancedMetrics
        currentMonthRevenue={currentMonthRevenue}
        previousMonthRevenue={previousMonthRevenue}
        bestMonth={bestMonthMetrics}
        totalAccounts={totalAccounts}
        allTimeTotalCases={allTimeTotalCases}
        casesGrowthPercentage={casesGrowthPercentage}
        depletionsMetrics={depletionsMetrics}
        forecast={forecast}
        monthlyData={monthlyData}
        reorderRateMetrics={reorderRateMetrics}
      />

      <div className="glass-card rounded-2xl p-6 glow-hover-blue">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-theme-text">Monthly Case Trends by Product</h2>
            <p className="text-sm text-theme-muted mt-1">
              12-month volume performance by top products
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-theme-muted">Showing</span>
            <span className="font-semibold text-theme-text">Last 12 Months</span>
          </div>
        </div>
        <MonthlyCaseTrendsChart data={productCasesTrends} showBrandNames={isViewingAllBrands} />
      </div>

      <InsightCards insights={insights} onTaskCreated={() => {
        console.log('[Dashboard] Task created from insight');
      }} />

      <RevenueBreakdownCharts regionData={regionData} />

      {topAccountsLeaderboard.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card rounded-2xl p-6 glow-hover-teal">
            <h3 className="text-xl font-bold text-theme-text mb-6">Top 5 Performing Accounts</h3>
            <p className="text-sm text-theme-muted mb-6">{isViewingAllBrands ? 'Across all brands' : 'All-time revenue leaders'}</p>
            <div className="space-y-4">
              {topAccountsLeaderboard.map((account, index) => {
                let badgeContent;
                let badgeClasses = "flex items-center justify-center text-white font-bold shadow-lg";

                if (index === 0) {
                  badgeContent = <Trophy className="w-5 h-5" />;
                  badgeClasses += " w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-600";
                } else if (index === 1) {
                  badgeContent = <Medal className="w-5 h-5" />;
                  badgeClasses += " w-11 h-11 rounded-xl bg-gradient-to-br from-gray-300 to-gray-500";
                } else if (index === 2) {
                  badgeContent = <Medal className="w-4 h-4" />;
                  badgeClasses += " w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600";
                } else if (index === 3) {
                  badgeContent = <span className="text-base">4</span>;
                  badgeClasses += " w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700";
                } else {
                  badgeContent = <span className="text-base">5</span>;
                  badgeClasses += " w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500 to-teal-700";
                }

                return (
                  <div
                    key={`${account.accountName}-${index}`}
                    className="flex items-center justify-between p-4 rounded-xl hover:bg-white/5 transition-all duration-300 border border-white/5 hover:border-white/10"
                  >
                    <div className="flex items-center gap-4">
                      <div className={badgeClasses}>
                        {badgeContent}
                      </div>
                      <div>
                        <p className="font-bold text-theme-text text-lg">{account.accountName}</p>
                        <div className="flex items-center gap-2">
                          {isViewingAllBrands && 'brandName' in account && (
                            <>
                              <Building2 className="w-3 h-3 text-theme-muted" />
                              <p className="text-sm text-theme-muted">{account.brandName}</p>
                              <span className="text-theme-muted">·</span>
                            </>
                          )}
                          <p className="text-sm text-theme-muted">
                            {account.totalOrders.toLocaleString()} total {account.totalOrders === 1 ? 'order' : 'orders'}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-theme-text text-xl">
                        ${account.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                      <p className="text-xs text-theme-muted uppercase tracking-wide">Lifetime</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <TreemapChart data={representativeData} title="Revenue Distribution by Sales Rep" />
        </div>
      )}

      {accountMetrics.length > 0 && topAccountsLeaderboard.length === 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TreemapChart data={representativeData} title="Revenue Distribution by Sales Rep" />

          <div className="glass-card rounded-2xl p-6 glow-hover-purple">
            <h3 className="text-xl font-semibold text-theme-text mb-4">Top Performing Accounts</h3>
            <div className="space-y-3">
              {accountMetrics.slice(0, 10).map((account, index) => (
                <div
                  key={account.accountName}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all duration-300"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-teal-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-theme-text">{account.accountName}</p>
                      <p className="text-xs text-theme-muted">{account.orders} orders this month</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-theme-text">
                      ${account.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                    <p className={`text-xs font-semibold ${
                      account.trend === 'up' ? 'text-accent-teal-400' :
                      account.trend === 'down' ? 'text-accent-orange-400' : 'text-zinc-400'
                    }`}>
                      {account.trend === 'up' ? '↑' : account.trend === 'down' ? '↓' : '→'}
                      {' '}{Math.abs(account.changePercent).toFixed(0)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {productPerformance.length > 0 && (
        <div className="glass-card rounded-2xl p-6 glow-hover-blue">
          <h3 className="text-xl font-semibold text-theme-text mb-4">Product Performance Overview</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-white/10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase tracking-wider">Product</th>
                  {isViewingAllBrands && (
                    <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase tracking-wider">Brand</th>
                  )}
                  <th className="px-4 py-3 text-right text-xs font-semibold text-theme-muted uppercase tracking-wider">Revenue</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-theme-muted uppercase tracking-wider">Cases Sold</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-theme-muted uppercase tracking-wider">6-Month Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {productPerformance.slice(0, 10).map((product, index) => {
                  const trendDirection = product.monthlyTrend.length >= 2 &&
                    product.monthlyTrend[product.monthlyTrend.length - 1] >
                    product.monthlyTrend[product.monthlyTrend.length - 2] ? 'up' : 'down';

                  return (
                    <tr key={`${product.productName}-${index}`} className="hover:bg-white/5 transition-colors duration-200">
                      <td className="px-4 py-3 text-sm font-semibold text-theme-text">{product.productName}</td>
                      {isViewingAllBrands && 'brandName' in product && (
                        <td className="px-4 py-3 text-sm text-theme-muted">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-3 h-3" />
                            {product.brandName}
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3 text-sm text-right font-bold text-theme-text">
                        ${product.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-theme-text">
                        {product.units.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <div className="flex items-end gap-0.5 h-8">
                            {product.monthlyTrend.map((value, idx) => {
                              const maxValue = Math.max(...product.monthlyTrend);
                              const height = (value / maxValue) * 100;
                              return (
                                <div
                                  key={idx}
                                  className="w-2 bg-gradient-blue rounded-t"
                                  style={{ height: `${height}%` }}
                                  title={`$${value.toLocaleString()}`}
                                />
                              );
                            })}
                          </div>
                          <span className={`text-xs font-semibold ml-2 ${
                            trendDirection === 'up' ? 'text-accent-teal-400' : 'text-accent-orange-400'
                          }`}>
                            {trendDirection === 'up' ? '↑' : '↓'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
