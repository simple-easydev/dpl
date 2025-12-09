import { supabase } from './supabase';
import { startOfMonth, endOfMonth, subMonths, format, parseISO, differenceInMonths } from 'date-fns';

// Helper function to deduplicate sales records
// This ensures consistent counting across Dashboard and Month Over Month views
function deduplicateSalesRecords<T extends {
  order_id?: string | null;
  order_date?: string | null;
  default_period?: string | null;
  account_name?: string | null;
  product_name?: string | null;
  quantity?: number | null;
  quantity_in_bottles?: number | null;
}>(records: T[]): T[] {
  const seenKeys = new Map<string, T>();

  records.forEach(record => {
    let key: string;

    // If order_id exists, use it as the primary key
    if (record.order_id) {
      key = `${record.order_id}`;
    } else {
      // Otherwise, create a composite key from critical fields
      const dateKey = record.order_date || record.default_period || 'no_date';
      key = `${dateKey}_${record.account_name}_${record.product_name}_${record.quantity}_${record.quantity_in_bottles || 0}`;
    }

    // Keep only the first occurrence of each unique key
    if (!seenKeys.has(key)) {
      seenKeys.set(key, record);
    }
  });

  return Array.from(seenKeys.values());
}

export async function checkHasRevenueData(organizationId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('sales_data')
    .select('has_revenue_data')
    .eq('organization_id', organizationId)
    .eq('has_revenue_data', true)
    .limit(1);

  if (error || !data) {
    return false;
  }

  return data.length > 0;
}

export interface MonthlyRevenue {
  month: string;
  revenue: number;
  orders: number;
  accounts: number;
  growth: number;
  totalCases: number;
}

export interface RevenueByCategory {
  category: string;
  revenue: number;
  percentage: number;
  distributor?: string;
}

export interface AccountMetrics {
  accountName: string;
  revenue: number;
  orders: number;
  lastOrderDate: string;
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
}

export interface ProductPerformance {
  productName: string;
  revenue: number;
  units: number;
  monthlyTrend: number[];
}

export interface RevenueForecast {
  forecastedRevenue: number;
  confidence: number;
  basedOnMonths: number;
}

export interface RevenueConcentration {
  top10Percentage: number;
  top20Percentage: number;
  giniCoefficient: number;
}

export interface DepletionsMetrics {
  totalRevenue: number;
  growthPercentage: number;
  status: 'strong' | 'growing' | 'stable' | 'declining';
  monthOverMonthChange: number;
  accountCount: number;
}

export interface TotalCasesMetrics {
  totalCases: number;
  growthPercentage: number;
  currentMonthCases: number;
  previousMonthCases: number;
}

export interface BestMonthMetrics {
  monthName: string;
  revenue: number;
  cases: number;
}

export interface ReorderRateMetrics {
  rate: number;
  reorderingAccounts: number;
  totalAccounts: number;
  period: string;
}

export async function getReorderRate(organizationId: string, monthsBack: number = 6): Promise<ReorderRateMetrics> {
  try {
    if (!organizationId) {
      console.warn('[RevenueAnalytics] No organizationId provided to getReorderRate');
      return { rate: 0, reorderingAccounts: 0, totalAccounts: 0, period: `Last ${monthsBack} months` };
    }

    // Calculate the date threshold
    const thresholdDate = subMonths(new Date(), monthsBack);
    const thresholdDateStr = format(thresholdDate, 'yyyy-MM-dd');

    // Fetch sales data for the period
    const { data: salesData, error } = await supabase
      .from('sales_data')
      .select('account_name, order_date')
      .eq('organization_id', organizationId)
      .not('account_name', 'is', null)
      .not('order_date', 'is', null)
      .gte('order_date', thresholdDateStr);

    if (error) {
      console.error('[RevenueAnalytics] Error fetching reorder rate data:', error);
      return { rate: 0, reorderingAccounts: 0, totalAccounts: 0, period: `Last ${monthsBack} months` };
    }

    if (!salesData || salesData.length === 0) {
      return { rate: 0, reorderingAccounts: 0, totalAccounts: 0, period: `Last ${monthsBack} months` };
    }

    // Group orders by account and count distinct order dates
    const accountOrders = new Map<string, Set<string>>();

    salesData.forEach((sale) => {
      if (!sale.account_name || !sale.order_date) return;

      if (!accountOrders.has(sale.account_name)) {
        accountOrders.set(sale.account_name, new Set());
      }
      accountOrders.get(sale.account_name)!.add(sale.order_date);
    });

    // Count accounts with multiple order dates (reordering customers)
    let reorderingAccounts = 0;
    accountOrders.forEach((orderDates) => {
      if (orderDates.size >= 2) {
        reorderingAccounts++;
      }
    });

    const totalAccounts = accountOrders.size;
    const rate = totalAccounts > 0 ? (reorderingAccounts / totalAccounts) * 100 : 0;

    return {
      rate,
      reorderingAccounts,
      totalAccounts,
      period: `Last ${monthsBack} months`,
    };
  } catch (error) {
    console.error('[RevenueAnalytics] Error calculating reorder rate:', error);
    return { rate: 0, reorderingAccounts: 0, totalAccounts: 0, period: `Last ${monthsBack} months` };
  }
}

export async function getMonthlyRevenueData(organizationId: string, months: number = 12): Promise<MonthlyRevenue[]> {
  try {
    if (!organizationId) {
      console.warn('[RevenueAnalytics] No organizationId provided to getMonthlyRevenueData');
      return [];
    }

    console.log('[RevenueAnalytics] Fetching sales data for organization:', organizationId);

    const { data: salesData, error } = await supabase
      .from('sales_data')
      .select('order_date, revenue, account_name, default_period, has_revenue_data, quantity, distributor')
      .eq('organization_id', organizationId)
      .or('order_date.not.is.null,default_period.not.is.null');

    if (error) {
      console.error('[RevenueAnalytics] Error fetching monthly revenue data:', error);
      console.error('[RevenueAnalytics] Error details:', error.message, error.code);
      return [];
    }

    console.log('[RevenueAnalytics] Fetched', salesData?.length || 0, 'sales records');

    if (!salesData || salesData.length === 0) {
      console.log('[RevenueAnalytics] No sales data found for organization:', organizationId);
      return [];
    }

    const monthlyData = new Map<string, { revenue: number; orders: number; accounts: Set<string>; totalCases: number }>();

    salesData.forEach((sale) => {
      let monthKey: string | null = null;

      if (sale.order_date) {
        monthKey = format(parseISO(sale.order_date), 'yyyy-MM');
      } else if (sale.default_period) {
        monthKey = sale.default_period;
      } else {
        return;
      }

      const existing = monthlyData.get(monthKey) || { revenue: 0, orders: 0, accounts: new Set(), totalCases: 0 };

      if (sale.has_revenue_data && sale.revenue !== null) {
        existing.revenue += Number(sale.revenue) || 0;
      }
      existing.orders += 1;
      if (sale.account_name) {
        existing.accounts.add(sale.account_name);
      }
      if (sale.quantity !== null) {
        existing.totalCases += Number(sale.quantity) || 0;
      }

      monthlyData.set(monthKey, existing);
    });

    const sortedMonths = Array.from(monthlyData.keys()).sort();
    const recentMonths = sortedMonths.slice(-months);

    return recentMonths.map((monthKey, index) => {
      const current = monthlyData.get(monthKey)!;
      const previous = index > 0 ? monthlyData.get(recentMonths[index - 1]) : null;
      const growth = previous ? ((current.revenue - previous.revenue) / previous.revenue) * 100 : 0;

      return {
        month: format(parseISO(monthKey + '-01'), 'MMM yyyy'),
        revenue: current.revenue,
        orders: current.orders,
        accounts: current.accounts.size,
        growth,
        totalCases: current.totalCases,
      };
    });
  } catch (err) {
    console.error('[RevenueAnalytics] Unexpected error in getMonthlyRevenueData:', err);
    return [];
  }
}

export async function getRevenueByCategory(organizationId: string, monthsBack: number = 3): Promise<RevenueByCategory[]> {
  const { data: salesData, error } = await supabase
    .from('sales_data')
    .select('category, revenue, has_revenue_data, order_date')
    .eq('organization_id', organizationId)
    .eq('has_revenue_data', true)
    .not('revenue', 'is', null)
    .or('order_date.not.is.null,default_period.not.is.null');

  if (error || !salesData) {
    return [];
  }

  const categoryMap = new Map<string, number>();
  let totalRevenue = 0;

  salesData.forEach((sale) => {
    if (sale.revenue !== null) {
      const category = sale.category || 'Uncategorized';
      categoryMap.set(category, (categoryMap.get(category) || 0) + Number(sale.revenue));
      totalRevenue += Number(sale.revenue);
    }
  });

  return Array.from(categoryMap.entries())
    .map(([category, revenue]) => ({
      category,
      revenue,
      percentage: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export async function getRevenueByRepresentative(organizationId: string, limit: number = 15): Promise<RevenueByCategory[]> {
  const { data: salesData, error } = await supabase
    .from('sales_data')
    .select('representative, distributor, revenue, has_revenue_data, order_date')
    .eq('organization_id', organizationId)
    .eq('has_revenue_data', true)
    .not('revenue', 'is', null)
    .or('order_date.not.is.null,default_period.not.is.null');

  if (error || !salesData) {
    return [];
  }

  const representativeMap = new Map<string, { revenue: number; distributor: string }>();
  let totalRevenue = 0;

  salesData.forEach((sale) => {
    if (sale.revenue !== null) {
      const representative = sale.representative || 'Unassigned';
      const distributor = sale.distributor || 'Unknown Distributor';
      const existing = representativeMap.get(representative);

      if (existing) {
        existing.revenue += Number(sale.revenue);
      } else {
        representativeMap.set(representative, { revenue: Number(sale.revenue), distributor });
      }
      totalRevenue += Number(sale.revenue);
    }
  });

  const sortedReps = Array.from(representativeMap.entries())
    .map(([category, data]) => ({
      category,
      revenue: data.revenue,
      percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
      distributor: data.distributor,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return sortedReps.slice(0, limit);
}

export async function getRevenueByRegion(organizationId: string, monthsBack: number = 3): Promise<RevenueByCategory[]> {
  const { data: salesData, error } = await supabase
    .from('sales_data')
    .select('account_state, revenue, has_revenue_data, distributor, order_date')
    .eq('organization_id', organizationId)
    .eq('has_revenue_data', true)
    .not('revenue', 'is', null)
    .not('account_state', 'is', null)
    .or('order_date.not.is.null,default_period.not.is.null');

  if (error || !salesData) {
    return [];
  }

  const stateMap = new Map<string, number>();
  let totalRevenue = 0;

  salesData.forEach((sale) => {
    const state = sale.account_state || 'Unknown';
    stateMap.set(state, (stateMap.get(state) || 0) + Number(sale.revenue));
    totalRevenue += Number(sale.revenue);
  });

  return Array.from(stateMap.entries())
    .map(([category, revenue]) => ({
      category,
      revenue,
      percentage: (revenue / totalRevenue) * 100,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export async function getAccountMetrics(organizationId: string): Promise<AccountMetrics[]> {
  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  const previousMonthStart = startOfMonth(subMonths(now, 1));

  const currentQuery = supabase
    .from('sales_data')
    .select('account_name, revenue, order_date, distributor')
    .eq('organization_id', organizationId)
    .not('order_date', 'is', null)
    .gte('order_date', currentMonthStart.toISOString().split('T')[0]);

  const previousQuery = supabase
    .from('sales_data')
    .select('account_name, revenue, distributor')
    .eq('organization_id', organizationId)
    .not('order_date', 'is', null)
    .gte('order_date', previousMonthStart.toISOString().split('T')[0])
    .lt('order_date', currentMonthStart.toISOString().split('T')[0]);

  const { data: currentMonth, error: currentError } = await currentQuery;
  const { data: previousMonth, error: previousError } = await previousQuery;

  if (currentError || previousError || !currentMonth) {
    return [];
  }

  const currentMap = new Map<string, { revenue: number; orders: number; lastDate: string }>();
  const previousMap = new Map<string, number>();

  currentMonth.forEach((sale) => {
    const existing = currentMap.get(sale.account_name) || { revenue: 0, orders: 0, lastDate: sale.order_date };
    existing.revenue += Number(sale.revenue);
    existing.orders += 1;
    if (sale.order_date > existing.lastDate) {
      existing.lastDate = sale.order_date;
    }
    currentMap.set(sale.account_name, existing);
  });

  previousMonth?.forEach((sale) => {
    previousMap.set(sale.account_name, (previousMap.get(sale.account_name) || 0) + Number(sale.revenue));
  });

  return Array.from(currentMap.entries())
    .map(([accountName, data]) => {
      const previousRevenue = previousMap.get(accountName) || 0;
      const changePercent = previousRevenue > 0
        ? ((data.revenue - previousRevenue) / previousRevenue) * 100
        : 100;

      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (changePercent > 5) trend = 'up';
      else if (changePercent < -5) trend = 'down';

      return {
        accountName,
        revenue: data.revenue,
        orders: data.orders,
        lastOrderDate: data.lastDate,
        trend,
        changePercent,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

export async function getTopProductsWithTrends(organizationId: string, limit: number = 10): Promise<ProductPerformance[]> {
  const now = new Date();
  const sixMonthsAgo = subMonths(now, 6);

  const { data: salesData, error } = await supabase
    .from('sales_data')
    .select('product_name, revenue, quantity, order_date, distributor')
    .eq('organization_id', organizationId)
    .not('order_date', 'is', null)
    .gte('order_date', sixMonthsAgo.toISOString().split('T')[0])
    .order('order_date', { ascending: true });

  if (error || !salesData) {
    return [];
  }

  const productMap = new Map<string, { revenue: number; units: number; monthlyRevenue: Map<string, number> }>();

  salesData.forEach((sale) => {
    const monthKey = format(parseISO(sale.order_date), 'yyyy-MM');
    const existing = productMap.get(sale.product_name) || {
      revenue: 0,
      units: 0,
      monthlyRevenue: new Map()
    };

    existing.revenue += Number(sale.revenue);
    existing.units += Number(sale.quantity || 0);
    existing.monthlyRevenue.set(
      monthKey,
      (existing.monthlyRevenue.get(monthKey) || 0) + Number(sale.revenue)
    );

    productMap.set(sale.product_name, existing);
  });

  const topProducts = Array.from(productMap.entries())
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, limit);

  return topProducts.map(([productName, data]) => {
    const monthlyTrend = Array.from(data.monthlyRevenue.values());

    return {
      productName,
      revenue: data.revenue,
      units: data.units,
      monthlyTrend,
    };
  });
}

export function forecastNextMonthRevenue(monthlyData: MonthlyRevenue[]): RevenueForecast {
  if (monthlyData.length < 3) {
    return {
      forecastedRevenue: 0,
      confidence: 0,
      basedOnMonths: 0,
    };
  }

  const recentMonths = monthlyData.slice(-6);
  const revenues = recentMonths.map(m => m.revenue);

  const simpleAverage = revenues.reduce((a, b) => a + b, 0) / revenues.length;

  const weights = recentMonths.map((_, i) => i + 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const weightedAverage = revenues.reduce((sum, rev, i) => sum + rev * weights[i], 0) / totalWeight;

  const growthRates = [];
  for (let i = 1; i < revenues.length; i++) {
    if (revenues[i - 1] > 0) {
      growthRates.push((revenues[i] - revenues[i - 1]) / revenues[i - 1]);
    }
  }

  const avgGrowthRate = growthRates.length > 0
    ? growthRates.reduce((a, b) => a + b, 0) / growthRates.length
    : 0;

  const trendForecast = revenues[revenues.length - 1] * (1 + avgGrowthRate);

  const forecastedRevenue = (weightedAverage * 0.5) + (trendForecast * 0.5);

  const variance = revenues.reduce((sum, rev) => sum + Math.pow(rev - simpleAverage, 2), 0) / revenues.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = stdDev / simpleAverage;
  const confidence = Math.max(0, Math.min(100, 100 - (coefficientOfVariation * 100)));

  return {
    forecastedRevenue,
    confidence,
    basedOnMonths: recentMonths.length,
  };
}

export function calculateRevenueConcentration(accountMetrics: AccountMetrics[]): RevenueConcentration {
  if (accountMetrics.length === 0) {
    return {
      top10Percentage: 0,
      top20Percentage: 0,
      giniCoefficient: 0,
    };
  }

  const totalRevenue = accountMetrics.reduce((sum, acc) => sum + acc.revenue, 0);

  const top10Count = Math.min(10, accountMetrics.length);
  const top10Revenue = accountMetrics.slice(0, top10Count).reduce((sum, acc) => sum + acc.revenue, 0);
  const top10Percentage = (top10Revenue / totalRevenue) * 100;

  const top20Count = Math.min(20, accountMetrics.length);
  const top20Revenue = accountMetrics.slice(0, top20Count).reduce((sum, acc) => sum + acc.revenue, 0);
  const top20Percentage = (top20Revenue / totalRevenue) * 100;

  const sortedRevenues = accountMetrics.map(a => a.revenue).sort((a, b) => a - b);
  const n = sortedRevenues.length;
  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    numerator += (i + 1) * sortedRevenues[i];
    denominator += sortedRevenues[i];
  }

  const giniCoefficient = denominator > 0
    ? (2 * numerator) / (n * denominator) - (n + 1) / n
    : 0;

  return {
    top10Percentage,
    top20Percentage,
    giniCoefficient,
  };
}

export function calculateDepletionsMetrics(
  accountMetrics: AccountMetrics[],
  monthlyData: MonthlyRevenue[]
): DepletionsMetrics {
  if (monthlyData.length === 0) {
    return {
      totalRevenue: 0,
      growthPercentage: 0,
      status: 'stable',
      monthOverMonthChange: 0,
      accountCount: 0,
    };
  }

  const totalRevenue = monthlyData.reduce((sum, month) => sum + month.revenue, 0);
  const accountCount = accountMetrics.length;

  let growthPercentage = 0;
  let monthOverMonthChange = 0;
  let status: 'strong' | 'growing' | 'stable' | 'declining' = 'stable';

  if (monthlyData.length >= 2) {
    const currentMonth = monthlyData[monthlyData.length - 1];
    const previousMonth = monthlyData[monthlyData.length - 2];

    monthOverMonthChange = currentMonth.revenue - previousMonth.revenue;
    growthPercentage = previousMonth.revenue > 0
      ? ((currentMonth.revenue - previousMonth.revenue) / previousMonth.revenue) * 100
      : 0;

    if (growthPercentage >= 10) {
      status = 'strong';
    } else if (growthPercentage > 0) {
      status = 'growing';
    } else if (growthPercentage > -5) {
      status = 'stable';
    } else {
      status = 'declining';
    }
  }

  return {
    totalRevenue,
    growthPercentage,
    status,
    monthOverMonthChange,
    accountCount,
  };
}

export interface AccountWithMetrics {
  id: string;
  account_name: string;
  total_revenue: number;
  total_orders: number;
  first_order_date: string;
  last_order_date: string;
  average_order_value: number;
  lifetime_revenue?: number;
  lifetime_orders?: number;
  premise_type?: 'on_premise' | 'off_premise' | 'unclassified';
  organization_id?: string;
  organization_name?: string;
  total_cases: number;
  lifetime_cases?: number;
  average_cases_per_order: number;
  average_monthly_cases?: number;
}

export async function getAccountsWithDateFilter(
  organizationId: string,
  startDate?: Date,
  endDate?: Date
): Promise<AccountWithMetrics[]> {
  let query = supabase
    .from('sales_data')
    .select('account_name, revenue, order_date, quantity')
    .eq('organization_id', organizationId)
    .order('order_date', { ascending: true });

  if (startDate) {
    query = query.gte('order_date', startDate.toISOString().split('T')[0]);
  }

  if (endDate) {
    query = query.lte('order_date', endDate.toISOString().split('T')[0]);
  }

  const { data: salesData, error } = await query;

  if (error || !salesData) {
    return [];
  }

  const { data: lifetimeAccounts } = await supabase
    .from('accounts')
    .select('id, account_name, total_revenue, total_orders, premise_type')
    .eq('organization_id', organizationId);

  const { data: lifetimeSalesData } = await supabase
    .from('sales_data')
    .select('account_name, quantity')
    .eq('organization_id', organizationId);

  const lifetimeCasesMap = new Map<string, number>();
  lifetimeSalesData?.forEach(sale => {
    const accountName = sale.account_name;
    const cases = lifetimeCasesMap.get(accountName) || 0;
    lifetimeCasesMap.set(accountName, cases + (Number(sale.quantity) || 0));
  });

  const lifetimeMap = new Map<string, { id: string; revenue: number; orders: number; premise_type: string }>();
  lifetimeAccounts?.forEach(acc => {
    lifetimeMap.set(acc.account_name, {
      id: acc.id,
      revenue: Number(acc.total_revenue),
      orders: acc.total_orders,
      premise_type: acc.premise_type || 'unclassified',
    });
  });

  const accountMap = new Map<string, {
    revenue: number;
    orders: number;
    cases: number;
    firstOrderDate: string;
    lastOrderDate: string;
  }>();

  salesData.forEach((sale) => {
    const existing = accountMap.get(sale.account_name) || {
      revenue: 0,
      orders: 0,
      cases: 0,
      firstOrderDate: sale.order_date,
      lastOrderDate: sale.order_date,
    };

    existing.revenue += Number(sale.revenue);
    existing.orders += 1;
    existing.cases += Number(sale.quantity) || 0;

    if (sale.order_date < existing.firstOrderDate) {
      existing.firstOrderDate = sale.order_date;
    }
    if (sale.order_date > existing.lastOrderDate) {
      existing.lastOrderDate = sale.order_date;
    }

    accountMap.set(sale.account_name, existing);
  });

  const monthsInPeriod = startDate && endDate ? differenceInMonths(endDate, startDate) + 1 : 12;

  return Array.from(accountMap.entries())
    .map(([accountName, data]) => {
      const lifetime = lifetimeMap.get(accountName);
      const lifetimeCases = lifetimeCasesMap.get(accountName) || 0;
      const averageMonthlyCases = monthsInPeriod > 0 ? data.cases / monthsInPeriod : 0;

      return {
        id: lifetime?.id || accountName,
        account_name: accountName,
        total_revenue: data.revenue,
        total_orders: data.orders,
        first_order_date: data.firstOrderDate,
        last_order_date: data.lastOrderDate,
        average_order_value: data.orders > 0 ? data.revenue / data.orders : 0,
        lifetime_revenue: lifetime?.revenue,
        lifetime_orders: lifetime?.orders,
        premise_type: (lifetime?.premise_type as 'on_premise' | 'off_premise' | 'unclassified') || 'unclassified',
        total_cases: data.cases,
        lifetime_cases: lifetimeCases,
        average_cases_per_order: data.orders > 0 ? data.cases / data.orders : 0,
        average_monthly_cases: averageMonthlyCases,
      };
    })
    .sort((a, b) => b.total_cases - a.total_cases);
}

export interface TopAccountLeaderboard {
  accountName: string;
  totalRevenue: number;
  totalOrders: number;
}

export async function getTopAccountsLeaderboard(organizationId: string, limit: number = 5): Promise<TopAccountLeaderboard[]> {
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('account_name, total_revenue, total_orders')
    .eq('organization_id', organizationId)
    .order('total_revenue', { ascending: false })
    .limit(limit);

  if (error || !accounts) {
    return [];
  }

  return accounts.map(account => ({
    accountName: account.account_name,
    totalRevenue: Number(account.total_revenue),
    totalOrders: account.total_orders,
  }));
}

export async function getTotalCasesSold(organizationId: string): Promise<TotalCasesMetrics> {
  try {
    if (!organizationId) {
      console.warn('[RevenueAnalytics] No organizationId provided to getTotalCasesSold');
      return {
        totalCases: 0,
        growthPercentage: 0,
        currentMonthCases: 0,
        previousMonthCases: 0,
      };
    }

    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const previousMonthStart = startOfMonth(subMonths(now, 1));

    // Fetch all records with dates to match Month Over Month page logic
    // Include fields needed for deduplication
    const allTimeQuery = supabase
      .from('sales_data')
      .select('quantity, order_id, order_date, default_period, account_name, product_name, quantity_in_bottles')
      .eq('organization_id', organizationId)
      .not('quantity', 'is', null)
      .or('order_date.not.is.null,default_period.not.is.null');

    const currentMonthQuery = supabase
      .from('sales_data')
      .select('quantity')
      .eq('organization_id', organizationId)
      .not('quantity', 'is', null)
      .not('order_date', 'is', null)
      .gte('order_date', currentMonthStart.toISOString().split('T')[0]);

    const previousMonthQuery = supabase
      .from('sales_data')
      .select('quantity')
      .eq('organization_id', organizationId)
      .not('quantity', 'is', null)
      .not('order_date', 'is', null)
      .gte('order_date', previousMonthStart.toISOString().split('T')[0])
      .lt('order_date', currentMonthStart.toISOString().split('T')[0]);

    const [allTimeResult, currentMonthResult, previousMonthResult] = await Promise.all([
      allTimeQuery,
      currentMonthQuery,
      previousMonthQuery,
    ]);

    if (allTimeResult.error) {
      console.error('[RevenueAnalytics] Error fetching all-time cases:', allTimeResult.error);
      return {
        totalCases: 0,
        growthPercentage: 0,
        currentMonthCases: 0,
        previousMonthCases: 0,
      };
    }

    // Deduplicate records to match Month Over Month page logic
    const deduplicatedRecords = deduplicateSalesRecords(allTimeResult.data || []);
    const totalCases = Math.floor(deduplicatedRecords.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0));
    const currentMonthCases = Math.floor((currentMonthResult.data || []).reduce((sum, row) => sum + (Number(row.quantity) || 0), 0));
    const previousMonthCases = Math.floor((previousMonthResult.data || []).reduce((sum, row) => sum + (Number(row.quantity) || 0), 0));

    const growthPercentage = previousMonthCases > 0
      ? ((currentMonthCases - previousMonthCases) / previousMonthCases) * 100
      : currentMonthCases > 0 ? 100 : 0;

    return {
      totalCases,
      growthPercentage,
      currentMonthCases,
      previousMonthCases,
    };
  } catch (err) {
    console.error('[RevenueAnalytics] Unexpected error in getTotalCasesSold:', err);
    return {
      totalCases: 0,
      growthPercentage: 0,
      currentMonthCases: 0,
      previousMonthCases: 0,
    };
  }
}

export async function getBestMonth(organizationId: string): Promise<BestMonthMetrics> {
  try {
    if (!organizationId) {
      console.warn('[RevenueAnalytics] No organizationId provided to getBestMonth');
      return {
        monthName: 'N/A',
        revenue: 0,
        cases: 0,
      };
    }

    const { data: salesData, error } = await supabase
      .from('sales_data')
      .select('order_date, revenue, quantity, default_period, has_revenue_data')
      .eq('organization_id', organizationId)
      .or('order_date.not.is.null,default_period.not.is.null');

    if (error || !salesData || salesData.length === 0) {
      console.error('[RevenueAnalytics] Error fetching sales data for best month:', error);
      return {
        monthName: 'N/A',
        revenue: 0,
        cases: 0,
      };
    }

    const monthlyData = new Map<string, { revenue: number; cases: number }>();

    salesData.forEach((sale) => {
      let monthKey: string | null = null;

      if (sale.order_date) {
        monthKey = format(parseISO(sale.order_date), 'yyyy-MM');
      } else if (sale.default_period) {
        monthKey = sale.default_period;
      } else {
        return;
      }

      const existing = monthlyData.get(monthKey) || { revenue: 0, cases: 0 };

      if (sale.has_revenue_data && sale.revenue !== null) {
        existing.revenue += Number(sale.revenue) || 0;
      }
      if (sale.quantity !== null) {
        existing.cases += Number(sale.quantity) || 0;
      }

      monthlyData.set(monthKey, existing);
    });

    if (monthlyData.size === 0) {
      return {
        monthName: 'N/A',
        revenue: 0,
        cases: 0,
      };
    }

    let bestMonth = '';
    let bestRevenue = 0;
    let bestCases = 0;

    monthlyData.forEach((data, monthKey) => {
      if (data.revenue > bestRevenue) {
        bestRevenue = data.revenue;
        bestMonth = monthKey;
        bestCases = data.cases;
      }
    });

    const monthName = bestMonth ? format(parseISO(bestMonth + '-01'), 'MMM yyyy') : 'N/A';

    return {
      monthName,
      revenue: bestRevenue,
      cases: bestCases,
    };
  } catch (err) {
    console.error('[RevenueAnalytics] Unexpected error in getBestMonth:', err);
    return {
      monthName: 'N/A',
      revenue: 0,
      cases: 0,
    };
  }
}

export async function getAllOrganizationsAccounts(
  startDate?: Date,
  endDate?: Date
): Promise<AccountWithMetrics[]> {
  try {
    const { data: organizations, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .is('deleted_at', null);

    if (orgError || !organizations || organizations.length === 0) {
      console.error('[RevenueAnalytics] Error fetching organizations:', orgError);
      return [];
    }

    const allAccounts: AccountWithMetrics[] = [];
    const monthsInPeriod = startDate && endDate ? differenceInMonths(endDate, startDate) + 1 : 12;

    for (const org of organizations) {
      const { data: lifetimeAccounts } = await supabase
        .from('accounts')
        .select('id, account_name, total_revenue, total_orders, premise_type')
        .eq('organization_id', org.id);

      const { data: lifetimeSalesData } = await supabase
        .from('sales_data')
        .select('account_name, quantity')
        .eq('organization_id', org.id);

      const lifetimeCasesMap = new Map<string, number>();
      lifetimeSalesData?.forEach(sale => {
        const accountName = sale.account_name;
        const cases = lifetimeCasesMap.get(accountName) || 0;
        lifetimeCasesMap.set(accountName, cases + (Number(sale.quantity) || 0));
      });

      const lifetimeMap = new Map<string, { id: string; revenue: number; orders: number; premise_type: string }>();
      lifetimeAccounts?.forEach(acc => {
        lifetimeMap.set(acc.account_name, {
          id: acc.id,
          revenue: Number(acc.total_revenue),
          orders: acc.total_orders,
          premise_type: acc.premise_type || 'unclassified',
        });
      });

      let query = supabase
        .from('sales_data')
        .select('account_name, revenue, order_date, quantity')
        .eq('organization_id', org.id)
        .order('order_date', { ascending: true });

      if (startDate) {
        query = query.gte('order_date', startDate.toISOString().split('T')[0]);
      }

      if (endDate) {
        query = query.lte('order_date', endDate.toISOString().split('T')[0]);
      }

      const { data: salesData, error: salesError } = await query;

      if (salesError || !salesData) {
        console.error('[RevenueAnalytics] Error fetching sales data for org:', org.id, salesError);
        continue;
      }

      const accountMap = new Map<string, {
        revenue: number;
        orders: number;
        cases: number;
        firstOrderDate: string;
        lastOrderDate: string;
      }>();

      salesData.forEach((sale) => {
        const existing = accountMap.get(sale.account_name) || {
          revenue: 0,
          orders: 0,
          cases: 0,
          firstOrderDate: sale.order_date,
          lastOrderDate: sale.order_date,
        };

        existing.revenue += Number(sale.revenue);
        existing.orders += 1;
        existing.cases += Number(sale.quantity) || 0;

        if (sale.order_date < existing.firstOrderDate) {
          existing.firstOrderDate = sale.order_date;
        }
        if (sale.order_date > existing.lastOrderDate) {
          existing.lastOrderDate = sale.order_date;
        }

        accountMap.set(sale.account_name, existing);
      });

      const orgAccounts = Array.from(accountMap.entries()).map(([accountName, data]) => {
        const lifetime = lifetimeMap.get(accountName);
        const lifetimeCases = lifetimeCasesMap.get(accountName) || 0;
        const averageMonthlyCases = monthsInPeriod > 0 ? data.cases / monthsInPeriod : 0;

        return {
          id: lifetime?.id || accountName,
          account_name: accountName,
          total_revenue: data.revenue,
          total_orders: data.orders,
          first_order_date: data.firstOrderDate,
          last_order_date: data.lastOrderDate,
          average_order_value: data.orders > 0 ? data.revenue / data.orders : 0,
          lifetime_revenue: lifetime?.revenue,
          lifetime_orders: lifetime?.orders,
          premise_type: (lifetime?.premise_type as 'on_premise' | 'off_premise' | 'unclassified') || 'unclassified',
          organization_id: org.id,
          organization_name: org.name,
          total_cases: data.cases,
          lifetime_cases: lifetimeCases,
          average_cases_per_order: data.orders > 0 ? data.cases / data.orders : 0,
          average_monthly_cases: averageMonthlyCases,
        };
      });

      allAccounts.push(...orgAccounts);
    }

    return allAccounts.sort((a, b) => b.total_cases - a.total_cases);
  } catch (err) {
    console.error('[RevenueAnalytics] Unexpected error in getAllOrganizationsAccounts:', err);
    return [];
  }
}

export interface ProductCasesTrend {
  productName: string;
  monthlyCases: { month: string; cases: number }[];
  totalCases: number;
  color: string;
}

const PRODUCT_COLORS = [
  '#0EA5E9',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#14B8A6',
  '#F97316',
  '#06B6D4',
  '#84CC16',
  '#EC4899',
  '#8B5CF6',
];

export async function getMonthlyCasesTrendsByProduct(
  organizationId: string,
  months: number = 12,
  topN: number = 8
): Promise<ProductCasesTrend[]> {
  try {
    if (!organizationId) {
      console.warn('[RevenueAnalytics] No organizationId provided to getMonthlyCasesTrendsByProduct');
      return [];
    }

    const startDate = subMonths(new Date(), months);
    const startDateStr = format(startDate, 'yyyy-MM-dd');

    const { data: salesData, error } = await supabase
      .from('sales_data')
      .select('product_name, quantity, order_date, default_period')
      .eq('organization_id', organizationId)
      .or('order_date.not.is.null,default_period.not.is.null')
      .not('quantity', 'is', null)
      .gte('order_date', startDateStr);

    if (error) {
      console.error('[RevenueAnalytics] Error fetching product cases data:', error);
      return [];
    }

    if (!salesData || salesData.length === 0) {
      console.log('[RevenueAnalytics] No sales data found for organization:', organizationId);
      return [];
    }

    const productTotals = new Map<string, number>();
    const productMonthlyData = new Map<string, Map<string, number>>();

    salesData.forEach((sale) => {
      if (!sale.product_name) return;

      let monthKey: string | null = null;

      if (sale.order_date) {
        monthKey = format(parseISO(sale.order_date), 'yyyy-MM');
      } else if (sale.default_period) {
        monthKey = sale.default_period;
      } else {
        return;
      }

      const cases = Number(sale.quantity) || 0;

      productTotals.set(sale.product_name, (productTotals.get(sale.product_name) || 0) + cases);

      if (!productMonthlyData.has(sale.product_name)) {
        productMonthlyData.set(sale.product_name, new Map());
      }

      const monthlyData = productMonthlyData.get(sale.product_name)!;
      monthlyData.set(monthKey, (monthlyData.get(monthKey) || 0) + cases);
    });

    const topProducts = Array.from(productTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([productName]) => productName);

    const allMonthKeys = new Set<string>();
    salesData.forEach((sale) => {
      let monthKey: string | null = null;

      if (sale.order_date) {
        monthKey = format(parseISO(sale.order_date), 'yyyy-MM');
      } else if (sale.default_period) {
        monthKey = sale.default_period;
      }

      if (monthKey) {
        allMonthKeys.add(monthKey);
      }
    });

    const sortedMonths = Array.from(allMonthKeys).sort().slice(-months);

    return topProducts.map((productName, index) => {
      const monthlyData = productMonthlyData.get(productName)!;

      const monthlyCases = sortedMonths.map((monthKey) => ({
        month: format(parseISO(monthKey + '-01'), 'MMM yyyy'),
        cases: monthlyData.get(monthKey) || 0,
      }));

      return {
        productName,
        monthlyCases,
        totalCases: productTotals.get(productName) || 0,
        color: PRODUCT_COLORS[index % PRODUCT_COLORS.length],
      };
    });
  } catch (err) {
    console.error('[RevenueAnalytics] Unexpected error in getMonthlyCasesTrendsByProduct:', err);
    return [];
  }
}
