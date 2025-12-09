import { supabase } from './supabase';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, differenceInMonths } from 'date-fns';
import {
  shouldRecategorize,
  getCachedCategorizations,
  categorizeAccountsWithAI,
  saveCategorizations,
  AccountMetrics,
} from './accountCategorization';

export type BlitzCategory = 'large_active' | 'small_active' | 'large_loss' | 'small_loss' | 'one_time' | 'inactive';

export interface MonthlyAccountData {
  month: string;
  cases: number;
  orders: number;
  revenue: number;
}

export interface BlitzAccount {
  accountId: string;
  accountName: string;
  category: BlitzCategory;
  baselineAvg: number;
  recentAvg: number;
  trendPercent: number;
  totalOrders: number;
  firstOrderDate: string;
  lastOrderDate: string;
  monthlyData: MonthlyAccountData[];
  distributor?: string;
  region?: string;
  lastOrderDaysAgo: number;
  premise_type?: 'on_premise' | 'off_premise' | 'unclassified';
  aiConfidence?: number;
  aiReasoning?: string;
  categorizedAt?: string;
  isAiCategorized: boolean;
}

export interface BlitzFilters {
  search?: string;
  region?: string;
  categories?: BlitzCategory[];
  sortBy?: 'trend' | 'baseline' | 'recent' | 'name';
  sortDirection?: 'asc' | 'desc';
  premiseType?: 'on_premise' | 'off_premise' | 'unclassified';
}

export interface BlitzSummary {
  largeActive: number;
  smallActive: number;
  largeLoss: number;
  smallLoss: number;
  oneTime: number;
  inactive: number;
  totalRevenue: number;
  revenueAtRisk: number;
}

export async function calculateBlitzAccounts(
  organizationId: string,
  baselineMonths: number = 8,
  recentMonths: number = 3,
  largeThreshold: number = 1.0
): Promise<BlitzAccount[]> {
  if (!organizationId) {
    return [];
  }

  const now = new Date();
  const totalMonths = baselineMonths + recentMonths;
  const startDate = subMonths(startOfMonth(now), totalMonths - 1);

  const baselineStart = startDate;
  const baselineEnd = endOfMonth(subMonths(startOfMonth(now), recentMonths));
  const recentStart = startOfMonth(subMonths(now, recentMonths - 1));
  const recentEnd = endOfMonth(now);

  const [depletionsResult, salesDataResult, accountsResult] = await Promise.all([
    supabase
      .from('inventory_transactions')
      .select('id, quantity_change, created_at, reference_id')
      .eq('organization_id', organizationId)
      .eq('transaction_type', 'auto_depletion')
      .gte('created_at', format(startDate, 'yyyy-MM-dd')),
    supabase
      .from('sales_data')
      .select('id, account_name, order_date, revenue, distributor, region, default_period')
      .eq('organization_id', organizationId),
    supabase
      .from('accounts')
      .select('id, account_name, first_order_date, last_order_date, total_orders, premise_type')
      .eq('organization_id', organizationId)
  ]);

  const { data: depletions, error: depletionsError } = depletionsResult;
  const { data: salesData, error: salesError } = salesDataResult;
  const { data: accounts } = accountsResult;

  if (depletionsError) {
    console.error('[SalesBlitzAnalytics] Error fetching depletion data:', depletionsError);
  }

  if (salesError) {
    console.error('[SalesBlitzAnalytics] Error fetching sales data:', salesError);
  }

  console.log('[SalesBlitzAnalytics] Depletions count:', depletions?.length);
  console.log('[SalesBlitzAnalytics] Sales data count:', salesData?.length);

  if (!accounts || accounts.length === 0) {
    console.error('[SalesBlitzAnalytics] No accounts found');
    return [];
  }

  if (!salesData || salesData.length === 0) {
    console.warn('[SalesBlitzAnalytics] No sales data found');
    return [];
  }

  const accountLookup = new Map<string, { id: string; firstOrderDate: string; lastOrderDate: string; totalOrders: number; premiseType: 'on_premise' | 'off_premise' | 'unclassified' }>();
  accounts.forEach(acc => {
    accountLookup.set(acc.account_name, {
      id: acc.id,
      firstOrderDate: acc.first_order_date,
      lastOrderDate: acc.last_order_date,
      totalOrders: acc.total_orders || 0,
      premiseType: (acc.premise_type as 'on_premise' | 'off_premise' | 'unclassified') || 'unclassified',
    });
  });

  const salesDataLookup = new Map<string, { account_name: string; order_date: string | null; revenue: number | null; distributor: string | null; region: string | null; default_period: string | null }>();
  salesData.forEach(sale => {
    salesDataLookup.set(sale.id, {
      account_name: sale.account_name,
      order_date: sale.order_date,
      revenue: sale.revenue,
      distributor: sale.distributor,
      region: sale.region,
      default_period: sale.default_period,
    });
  });

  const accountData = new Map<string, {
    monthlyData: Map<string, { cases: number; orders: number; revenue: number; orderIds: Set<string> }>;
    distributor?: string;
    region?: string;
  }>();

  if (depletions && depletions.length > 0) {
    const orderDepletionMap = new Map<string, {
      accountName: string;
      monthKey: string;
      totalCases: number;
      revenue: number;
      distributor?: string;
      region?: string;
    }>();

    depletions.forEach(depletion => {
      if (!depletion.reference_id) {
        return;
      }

      const saleData = salesDataLookup.get(depletion.reference_id);
      if (!saleData || !saleData.account_name) {
        return;
      }

      let monthKey: string | null = null;

      if (saleData.order_date) {
        monthKey = format(parseISO(saleData.order_date), 'yyyy-MM');
      } else if (saleData.default_period) {
        monthKey = saleData.default_period;
      } else {
        return;
      }

      const periodDate = parseISO(monthKey + '-01');
      if (periodDate < startDate) {
        return;
      }

      if (!orderDepletionMap.has(depletion.reference_id)) {
        orderDepletionMap.set(depletion.reference_id, {
          accountName: saleData.account_name,
          monthKey,
          totalCases: 0,
          revenue: Number(saleData.revenue) || 0,
          distributor: saleData.distributor || undefined,
          region: saleData.region || undefined,
        });
      }

      const orderData = orderDepletionMap.get(depletion.reference_id)!;
      orderData.totalCases += Math.abs(Number(depletion.quantity_change)) || 0;
    });

    orderDepletionMap.forEach((orderData, referenceId) => {
      const accountKey = orderData.accountName;

      if (!accountData.has(accountKey)) {
        accountData.set(accountKey, {
          monthlyData: new Map(),
          distributor: orderData.distributor,
          region: orderData.region,
        });
      }

      const accData = accountData.get(accountKey)!;
      const monthData = accData.monthlyData.get(orderData.monthKey) || { cases: 0, orders: 0, revenue: 0, orderIds: new Set() };

      monthData.cases += orderData.totalCases;
      if (!monthData.orderIds.has(referenceId)) {
        monthData.orders += 1;
        monthData.orderIds.add(referenceId);
      }
      monthData.revenue += orderData.revenue;

      accData.monthlyData.set(orderData.monthKey, monthData);
    });
  }

  const needsRecategorization = await shouldRecategorize(organizationId);
  const cachedCategorizations = needsRecategorization ? new Map() : await getCachedCategorizations(organizationId);

  const accountMetrics: AccountMetrics[] = [];
  const accountMetricsMap = new Map<string, AccountMetrics>();

  accounts.forEach(account => {
    const accountName = account.account_name;
    const data = accountData.get(accountName);

    // Skip accounts that have no case depletion data
    if (!data || !data.monthlyData || data.monthlyData.size === 0) {
      return;
    }

    const monthlyDataArray: MonthlyAccountData[] = [];
    let baselineCases = 0;
    let baselineMonthCount = 0;
    let recentCases = 0;
    let recentMonthCount = 0;
    let totalOrdersInPeriod = 0;

    data.monthlyData.forEach((monthData, monthKey) => {
      const monthDate = parseISO(monthKey + '-01');

      monthlyDataArray.push({
        month: format(monthDate, 'MMM yyyy'),
        cases: monthData.cases,
        orders: monthData.orders,
        revenue: monthData.revenue,
      });

      totalOrdersInPeriod += monthData.orders;

      if (monthDate >= baselineStart && monthDate <= baselineEnd) {
        baselineCases += monthData.cases;
        baselineMonthCount++;
      }

      if (monthDate >= recentStart && monthDate <= recentEnd) {
        recentCases += monthData.cases;
        recentMonthCount++;
      }
    });

    monthlyDataArray.sort((a, b) => {
      const dateA = parseISO(a.month);
      const dateB = parseISO(b.month);
      return dateA.getTime() - dateB.getTime();
    });

    const baselineAvg = baselineMonthCount > 0 ? baselineCases / baselineMonthCount : 0;
    const recentAvg = recentMonthCount > 0 ? recentCases / recentMonthCount : 0;

    let trendPercent = 0;
    if (baselineAvg > 0) {
      trendPercent = ((recentAvg - baselineAvg) / baselineAvg) * 100;
    } else if (recentAvg > 0) {
      trendPercent = 100;
    }

    const accountInfo = accountLookup.get(accountName);
    const lastOrderDate = accountInfo?.lastOrderDate || '';
    const lastOrderDaysAgo = lastOrderDate
      ? Math.floor((now.getTime() - parseISO(lastOrderDate).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    const uniqueMonthsWithOrders = data.monthlyData.size;
    const lifetimeTotalOrders = accountInfo?.totalOrders || 0;

    const monthlyPattern = Array.from(data.monthlyData.keys()).sort().join(', ');

    const metrics: AccountMetrics = {
      accountName,
      baselineAvg,
      recentAvg,
      trendPercent,
      totalOrders: lifetimeTotalOrders,
      firstOrderDate: accountInfo?.firstOrderDate || '',
      lastOrderDate,
      lastOrderDaysAgo,
      uniqueMonthsWithOrders,
      monthlyPattern,
    };

    accountMetrics.push(metrics);
    accountMetricsMap.set(accountName, metrics);
  });

  let categorizations: Array<{ accountName: string; category: BlitzCategory; confidence: number; reasoning: string; }>;
  let isAiCategorized = false;
  let categorizationDate: string | undefined;

  if (needsRecategorization) {
    console.log('[SalesBlitzAnalytics] Performing AI categorization...');
    categorizations = await categorizeAccountsWithAI(organizationId, accountMetrics, largeThreshold);

    const fullCategorizations = categorizations.map(cat => {
      const metrics = accountMetricsMap.get(cat.accountName)!;
      return { ...cat, ...metrics };
    });

    await saveCategorizations(organizationId, fullCategorizations);
    isAiCategorized = true;
    categorizationDate = new Date().toISOString();
    console.log('[SalesBlitzAnalytics] AI categorization complete and saved');
  } else {
    console.log('[SalesBlitzAnalytics] Using cached categorizations');
    categorizations = accountMetrics.map(metrics => {
      const cached = cachedCategorizations.get(metrics.accountName);
      if (cached) {
        isAiCategorized = true;
        categorizationDate = cached.categorized_at;
        return {
          accountName: metrics.accountName,
          category: cached.category,
          confidence: cached.confidence_score || 0,
          reasoning: cached.reasoning || '',
        };
      }
      return {
        accountName: metrics.accountName,
        category: 'inactive' as BlitzCategory,
        confidence: 0,
        reasoning: 'No categorization available',
      };
    });
  }

  const categorizationMap = new Map(categorizations.map(c => [c.accountName, c]));

  const blitzAccounts: BlitzAccount[] = [];

  accounts.forEach(account => {
    const accountName = account.account_name;
    const data = accountData.get(accountName);

    // Skip accounts that have no case depletion data
    if (!data || !data.monthlyData || data.monthlyData.size === 0) {
      return;
    }

    const monthlyDataArray: MonthlyAccountData[] = [];
    let baselineCases = 0;
    let baselineMonthCount = 0;
    let recentCases = 0;
    let recentMonthCount = 0;
    let totalOrdersInPeriod = 0;

    data.monthlyData.forEach((monthData, monthKey) => {
      const monthDate = parseISO(monthKey + '-01');

      monthlyDataArray.push({
        month: format(monthDate, 'MMM yyyy'),
        cases: monthData.cases,
        orders: monthData.orders,
        revenue: monthData.revenue,
      });

      totalOrdersInPeriod += monthData.orders;

      if (monthDate >= baselineStart && monthDate <= baselineEnd) {
        baselineCases += monthData.cases;
        baselineMonthCount++;
      }

      if (monthDate >= recentStart && monthDate <= recentEnd) {
        recentCases += monthData.cases;
        recentMonthCount++;
      }
    });

    monthlyDataArray.sort((a, b) => {
      const dateA = parseISO(a.month);
      const dateB = parseISO(b.month);
      return dateA.getTime() - dateB.getTime();
    });

    const baselineAvg = baselineMonthCount > 0 ? baselineCases / baselineMonthCount : 0;
    const recentAvg = recentMonthCount > 0 ? recentCases / recentMonthCount : 0;

    let trendPercent = 0;
    if (baselineAvg > 0) {
      trendPercent = ((recentAvg - baselineAvg) / baselineAvg) * 100;
    } else if (recentAvg > 0) {
      trendPercent = 100;
    }

    const accountInfo = accountLookup.get(accountName);
    const lastOrderDate = accountInfo?.lastOrderDate || '';
    const lastOrderDaysAgo = lastOrderDate
      ? Math.floor((now.getTime() - parseISO(lastOrderDate).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    const lifetimeTotalOrders = accountInfo?.totalOrders || 0;

    const categorization = categorizationMap.get(accountName);

    blitzAccounts.push({
      accountId: accountInfo?.id || accountName,
      accountName,
      category: categorization?.category || 'inactive',
      baselineAvg,
      recentAvg,
      trendPercent,
      totalOrders: lifetimeTotalOrders,
      firstOrderDate: accountInfo?.firstOrderDate || '',
      lastOrderDate,
      monthlyData: monthlyDataArray,
      distributor: data.distributor,
      region: data.region,
      lastOrderDaysAgo,
      premise_type: accountInfo?.premiseType || 'unclassified',
      aiConfidence: categorization?.confidence,
      aiReasoning: categorization?.reasoning,
      categorizedAt: categorizationDate,
      isAiCategorized,
    });
  });

  return blitzAccounts.sort((a, b) => b.baselineAvg - a.baselineAvg);
}

export function filterBlitzAccounts(accounts: BlitzAccount[], filters: BlitzFilters): BlitzAccount[] {
  let filtered = [...accounts];

  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter(acc =>
      acc.accountName.toLowerCase().includes(searchLower)
    );
  }

  if (filters.region) {
    filtered = filtered.filter(acc => acc.region === filters.region);
  }

  if (filters.premiseType) {
    filtered = filtered.filter(acc => acc.premise_type === filters.premiseType);
  }

  if (filters.categories && filters.categories.length > 0) {
    filtered = filtered.filter(acc => filters.categories!.includes(acc.category));
  }

  if (filters.sortBy) {
    const direction = filters.sortDirection === 'desc' ? -1 : 1;
    filtered.sort((a, b) => {
      let valA: number | string = 0;
      let valB: number | string = 0;

      switch (filters.sortBy) {
        case 'trend':
          valA = a.trendPercent;
          valB = b.trendPercent;
          break;
        case 'baseline':
          valA = a.baselineAvg;
          valB = b.baselineAvg;
          break;
        case 'recent':
          valA = a.recentAvg;
          valB = b.recentAvg;
          break;
        case 'name':
          valA = a.accountName;
          valB = b.accountName;
          break;
      }

      if (typeof valA === 'string') {
        return valA.localeCompare(valB as string) * direction;
      }
      return ((valA as number) - (valB as number)) * direction;
    });
  }

  return filtered;
}

export function calculateBlitzSummary(accounts: BlitzAccount[]): BlitzSummary {
  const summary: BlitzSummary = {
    largeActive: 0,
    smallActive: 0,
    largeLoss: 0,
    smallLoss: 0,
    oneTime: 0,
    inactive: 0,
    totalRevenue: 0,
    revenueAtRisk: 0,
  };

  accounts.forEach(acc => {
    switch (acc.category) {
      case 'large_active':
        summary.largeActive++;
        break;
      case 'small_active':
        summary.smallActive++;
        break;
      case 'large_loss':
        summary.largeLoss++;
        const lossRevenue = acc.monthlyData.reduce((sum, m) => sum + m.revenue, 0);
        summary.revenueAtRisk += lossRevenue;
        break;
      case 'small_loss':
        summary.smallLoss++;
        const smallLossRevenue = acc.monthlyData.reduce((sum, m) => sum + m.revenue, 0);
        summary.revenueAtRisk += smallLossRevenue * 0.5;
        break;
      case 'one_time':
        summary.oneTime++;
        break;
      case 'inactive':
        summary.inactive++;
        break;
    }

    const totalRevenue = acc.monthlyData.reduce((sum, m) => sum + m.revenue, 0);
    summary.totalRevenue += totalRevenue;
  });

  return summary;
}

export async function getDistributorsList(organizationId: string): Promise<string[]> {
  const [transactionsResult, salesDataResult] = await Promise.all([
    supabase
      .from('inventory_transactions')
      .select('reference_id')
      .eq('organization_id', organizationId)
      .eq('transaction_type', 'auto_depletion'),
    supabase
      .from('sales_data')
      .select('id, distributor')
      .eq('organization_id', organizationId)
      .not('distributor', 'is', null)
  ]);

  if (!transactionsResult.data || !salesDataResult.data) return [];

  const salesDataMap = new Map<string, string>();
  salesDataResult.data.forEach(sale => {
    if (sale.distributor) {
      salesDataMap.set(sale.id, sale.distributor);
    }
  });

  const distributors = new Set<string>();
  transactionsResult.data.forEach(txn => {
    if (txn.reference_id) {
      const distributor = salesDataMap.get(txn.reference_id);
      if (distributor) {
        distributors.add(distributor);
      }
    }
  });

  return Array.from(distributors).sort();
}

export async function getRegionsList(organizationId: string): Promise<string[]> {
  const [transactionsResult, salesDataResult] = await Promise.all([
    supabase
      .from('inventory_transactions')
      .select('reference_id')
      .eq('organization_id', organizationId)
      .eq('transaction_type', 'auto_depletion'),
    supabase
      .from('sales_data')
      .select('id, region')
      .eq('organization_id', organizationId)
      .not('region', 'is', null)
  ]);

  if (!transactionsResult.data || !salesDataResult.data) return [];

  const salesDataMap = new Map<string, string>();
  salesDataResult.data.forEach(sale => {
    if (sale.region) {
      salesDataMap.set(sale.id, sale.region);
    }
  });

  const regions = new Set<string>();
  transactionsResult.data.forEach(txn => {
    if (txn.reference_id) {
      const region = salesDataMap.get(txn.reference_id);
      if (region) {
        regions.add(region);
      }
    }
  });

  return Array.from(regions).sort();
}
