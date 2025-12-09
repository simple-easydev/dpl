import { supabase } from './supabase';
import { startOfMonth, subMonths, format, parseISO } from 'date-fns';

export interface AggregatedMonthlyRevenue {
  month: string;
  revenue: number;
  orders: number;
  accounts: number;
  growth: number;
  totalCases: number;
  brandCount: number;
}

export interface AggregatedRevenueByCategory {
  category: string;
  revenue: number;
  percentage: number;
  brandName?: string;
}

export interface AggregatedAccountMetrics {
  accountName: string;
  brandName: string;
  revenue: number;
  orders: number;
  lastOrderDate: string;
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
}

export interface AggregatedProductPerformance {
  productName: string;
  brandName: string;
  revenue: number;
  units: number;
  monthlyTrend: number[];
}

export interface AggregatedTopAccountLeaderboard {
  accountName: string;
  brandName: string;
  totalRevenue: number;
  totalOrders: number;
}

export async function checkIsPlatformAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_platform_admin');
  if (error) {
    console.error('Error checking platform admin status:', error);
    return false;
  }
  return data === true;
}

export async function getAggregatedMonthlyRevenueData(months: number = 12): Promise<AggregatedMonthlyRevenue[]> {
  try {
    const isPlatformAdmin = await checkIsPlatformAdmin();
    if (!isPlatformAdmin) {
      console.warn('[AggregatedAnalytics] User is not platform admin');
      return [];
    }

    const { data: salesData, error } = await supabase
      .from('sales_data')
      .select('order_date, revenue, account_name, default_period, has_revenue_data, quantity, organization_id')
      .or('order_date.not.is.null,default_period.not.is.null');

    if (error) {
      console.error('[AggregatedAnalytics] Error fetching aggregated monthly revenue data:', error);
      return [];
    }

    if (!salesData || salesData.length === 0) {
      console.log('[AggregatedAnalytics] No sales data found across all organizations');
      return [];
    }

    const monthlyData = new Map<string, {
      revenue: number;
      orders: number;
      accounts: Set<string>;
      totalCases: number;
      organizations: Set<string>;
    }>();

    salesData.forEach((sale) => {
      let monthKey: string | null = null;

      if (sale.order_date) {
        monthKey = format(parseISO(sale.order_date), 'yyyy-MM');
      } else if (sale.default_period) {
        monthKey = sale.default_period;
      } else {
        return;
      }

      const existing = monthlyData.get(monthKey) || {
        revenue: 0,
        orders: 0,
        accounts: new Set(),
        totalCases: 0,
        organizations: new Set()
      };

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
      if (sale.organization_id) {
        existing.organizations.add(sale.organization_id);
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
        brandCount: current.organizations.size,
      };
    });
  } catch (err) {
    console.error('[AggregatedAnalytics] Unexpected error in getAggregatedMonthlyRevenueData:', err);
    return [];
  }
}

export async function getAggregatedRevenueByRepresentative(limit: number = 15): Promise<AggregatedRevenueByCategory[]> {
  const isPlatformAdmin = await checkIsPlatformAdmin();
  if (!isPlatformAdmin) {
    return [];
  }

  const { data: salesData, error } = await supabase
    .from('sales_data')
    .select('representative, revenue, has_revenue_data, organization_id, order_date')
    .eq('has_revenue_data', true)
    .not('revenue', 'is', null)
    .or('order_date.not.is.null,default_period.not.is.null');

  if (error || !salesData) {
    return [];
  }

  const repMap = new Map<string, number>();
  let totalRevenue = 0;

  salesData.forEach((sale) => {
    if (sale.revenue !== null) {
      const rep = sale.representative || 'Unassigned';
      repMap.set(rep, (repMap.get(rep) || 0) + Number(sale.revenue));
      totalRevenue += Number(sale.revenue);
    }
  });

  return Array.from(repMap.entries())
    .map(([category, revenue]) => ({
      category,
      revenue,
      percentage: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export async function getAggregatedRevenueByRegion(monthsBack: number = 3): Promise<AggregatedRevenueByCategory[]> {
  const isPlatformAdmin = await checkIsPlatformAdmin();
  if (!isPlatformAdmin) {
    return [];
  }

  const { data: salesData, error } = await supabase
    .from('sales_data')
    .select('account_state, revenue, has_revenue_data, order_date')
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
    if (sale.revenue !== null) {
      const state = sale.account_state || 'Unknown';
      stateMap.set(state, (stateMap.get(state) || 0) + Number(sale.revenue));
      totalRevenue += Number(sale.revenue);
    }
  });

  return Array.from(stateMap.entries())
    .map(([category, revenue]) => ({
      category,
      revenue,
      percentage: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
}

export async function getAggregatedTopAccountsLeaderboard(limit: number = 10): Promise<AggregatedTopAccountLeaderboard[]> {
  const isPlatformAdmin = await checkIsPlatformAdmin();
  if (!isPlatformAdmin) {
    return [];
  }

  const { data: salesData, error: salesError } = await supabase
    .from('sales_data')
    .select('account_name, revenue, has_revenue_data, organization_id')
    .eq('has_revenue_data', true)
    .not('revenue', 'is', null)
    .not('account_name', 'is', null);

  if (salesError || !salesData) {
    console.error('[AggregatedAnalytics] Error fetching account data:', salesError);
    return [];
  }

  const { data: orgsData, error: orgsError } = await supabase
    .from('organizations')
    .select('id, name');

  if (orgsError || !orgsData) {
    console.error('[AggregatedAnalytics] Error fetching organizations:', orgsError);
    return [];
  }

  const orgMap = new Map(orgsData.map(org => [org.id, org.name]));

  const accountMap = new Map<string, { revenue: number; orders: number; organizationId: string }>();

  salesData.forEach((sale) => {
    if (sale.account_name && sale.revenue !== null) {
      const key = `${sale.account_name}|${sale.organization_id}`;
      const existing = accountMap.get(key) || { revenue: 0, orders: 0, organizationId: sale.organization_id };
      existing.revenue += Number(sale.revenue);
      existing.orders += 1;
      accountMap.set(key, existing);
    }
  });

  return Array.from(accountMap.entries())
    .map(([key, data]) => {
      const [accountName] = key.split('|');
      return {
        accountName,
        brandName: orgMap.get(data.organizationId) || 'Unknown',
        totalRevenue: data.revenue,
        totalOrders: data.orders,
      };
    })
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, limit);
}

export async function getAggregatedTopProducts(limit: number = 10): Promise<AggregatedProductPerformance[]> {
  const isPlatformAdmin = await checkIsPlatformAdmin();
  if (!isPlatformAdmin) {
    return [];
  }

  const now = new Date();
  const startDate = subMonths(startOfMonth(now), 6);

  const { data: salesData, error: salesError } = await supabase
    .from('sales_data')
    .select('product_name, revenue, quantity, order_date, organization_id, has_revenue_data')
    .eq('has_revenue_data', true)
    .not('revenue', 'is', null)
    .not('product_name', 'is', null)
    .not('order_date', 'is', null)
    .gte('order_date', startDate.toISOString().split('T')[0]);

  if (salesError || !salesData) {
    return [];
  }

  const { data: orgsData, error: orgsError } = await supabase
    .from('organizations')
    .select('id, name');

  if (orgsError || !orgsData) {
    return [];
  }

  const orgMap = new Map(orgsData.map(org => [org.id, org.name]));

  const productMap = new Map<string, {
    revenue: number;
    units: number;
    monthlyData: Map<string, number>;
    organizationId: string;
  }>();

  salesData.forEach((sale) => {
    if (sale.product_name && sale.revenue !== null) {
      const key = `${sale.product_name}|${sale.organization_id}`;
      const monthKey = format(parseISO(sale.order_date), 'yyyy-MM');

      const existing = productMap.get(key) || {
        revenue: 0,
        units: 0,
        monthlyData: new Map(),
        organizationId: sale.organization_id,
      };

      existing.revenue += Number(sale.revenue);
      existing.units += Number(sale.quantity) || 0;
      existing.monthlyData.set(
        monthKey,
        (existing.monthlyData.get(monthKey) || 0) + Number(sale.revenue)
      );

      productMap.set(key, existing);
    }
  });

  const results = Array.from(productMap.entries())
    .map(([key, data]) => {
      const [productName] = key.split('|');
      const sortedMonths = Array.from(data.monthlyData.keys()).sort();
      const monthlyTrend = sortedMonths.slice(-6).map(month => data.monthlyData.get(month) || 0);

      return {
        productName,
        brandName: orgMap.get(data.organizationId) || 'Unknown',
        revenue: data.revenue,
        units: data.units,
        monthlyTrend,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);

  return results;
}

export async function getAggregatedTotalCases(): Promise<{ totalCases: number; growthPercentage: number }> {
  const isPlatformAdmin = await checkIsPlatformAdmin();
  if (!isPlatformAdmin) {
    return { totalCases: 0, growthPercentage: 0 };
  }

  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  const previousMonthStart = subMonths(currentMonthStart, 1);

  // Fetch all-time data with date filter to match Month Over Month logic
  const { data: allTimeData, error: allTimeError } = await supabase
    .from('sales_data')
    .select('quantity, order_id, order_date, default_period, account_name, product_name, quantity_in_bottles')
    .not('quantity', 'is', null)
    .or('order_date.not.is.null,default_period.not.is.null');

  const { data: currentMonthData, error: currentError } = await supabase
    .from('sales_data')
    .select('quantity')
    .gte('order_date', currentMonthStart.toISOString().split('T')[0])
    .not('quantity', 'is', null);

  const { data: previousMonthData, error: previousError } = await supabase
    .from('sales_data')
    .select('quantity')
    .gte('order_date', previousMonthStart.toISOString().split('T')[0])
    .lt('order_date', currentMonthStart.toISOString().split('T')[0])
    .not('quantity', 'is', null);

  if (allTimeError || currentError || previousError) {
    return { totalCases: 0, growthPercentage: 0 };
  }

  // Deduplicate all-time records to match Month Over Month logic
  const deduplicatedAllTime = deduplicateRecords(allTimeData || []);
  const totalCases = Math.floor(deduplicatedAllTime.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0));

  const currentMonthCases = currentMonthData?.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0) || 0;
  const previousMonthCases = previousMonthData?.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0) || 0;

  const growthPercentage = previousMonthCases > 0
    ? ((currentMonthCases - previousMonthCases) / previousMonthCases) * 100
    : currentMonthCases > 0 ? 100 : 0;

  return {
    totalCases,
    growthPercentage,
  };
}

// Helper function to deduplicate records
function deduplicateRecords<T extends {
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

export async function checkHasAggregatedRevenueData(): Promise<boolean> {
  const isPlatformAdmin = await checkIsPlatformAdmin();
  if (!isPlatformAdmin) {
    return false;
  }

  const { data, error } = await supabase
    .from('sales_data')
    .select('has_revenue_data')
    .eq('has_revenue_data', true)
    .limit(1);

  if (error || !data) {
    return false;
  }

  return data.length > 0;
}

export interface AggregatedProductCasesTrend {
  productName: string;
  brandName: string;
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

export async function getAggregatedMonthlyCasesTrendsByProduct(
  months: number = 12,
  topN: number = 8
): Promise<AggregatedProductCasesTrend[]> {
  try {
    const isPlatformAdmin = await checkIsPlatformAdmin();
    if (!isPlatformAdmin) {
      console.warn('[AggregatedAnalytics] User is not platform admin');
      return [];
    }

    const startDate = subMonths(new Date(), months);
    const startDateStr = format(startDate, 'yyyy-MM-dd');

    const { data: salesData, error } = await supabase
      .from('sales_data')
      .select('product_name, quantity, order_date, default_period, organization_id')
      .or('order_date.not.is.null,default_period.not.is.null')
      .not('quantity', 'is', null)
      .gte('order_date', startDateStr);

    if (error) {
      console.error('[AggregatedAnalytics] Error fetching aggregated product cases data:', error);
      return [];
    }

    if (!salesData || salesData.length === 0) {
      console.log('[AggregatedAnalytics] No sales data found across all organizations');
      return [];
    }

    const { data: orgsData, error: orgsError } = await supabase
      .from('organizations')
      .select('id, name');

    if (orgsError || !orgsData) {
      return [];
    }

    const orgMap = new Map(orgsData.map(org => [org.id, org.name]));

    const productTotals = new Map<string, { total: number; organizationId: string }>();
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
      const key = `${sale.product_name}|${sale.organization_id}`;

      const existing = productTotals.get(key) || { total: 0, organizationId: sale.organization_id };
      existing.total += cases;
      productTotals.set(key, existing);

      if (!productMonthlyData.has(key)) {
        productMonthlyData.set(key, new Map());
      }

      const monthlyData = productMonthlyData.get(key)!;
      monthlyData.set(monthKey, (monthlyData.get(monthKey) || 0) + cases);
    });

    const topProducts = Array.from(productTotals.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, topN)
      .map(([key]) => key);

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

    return topProducts.map((key, index) => {
      const [productName, orgId] = key.split('|');
      const monthlyData = productMonthlyData.get(key)!;
      const totals = productTotals.get(key)!;

      const monthlyCases = sortedMonths.map((monthKey) => ({
        month: format(parseISO(monthKey + '-01'), 'MMM yyyy'),
        cases: monthlyData.get(monthKey) || 0,
      }));

      return {
        productName,
        brandName: orgMap.get(orgId) || 'Unknown',
        monthlyCases,
        totalCases: totals.total,
        color: PRODUCT_COLORS[index % PRODUCT_COLORS.length],
      };
    });
  } catch (err) {
    console.error('[AggregatedAnalytics] Unexpected error in getAggregatedMonthlyCasesTrendsByProduct:', err);
    return [];
  }
}
