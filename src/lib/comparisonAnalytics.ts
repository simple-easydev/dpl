import { supabase } from './supabase';
import { startOfDay, endOfDay, format, parseISO, differenceInDays, addDays } from 'date-fns';

export interface PeriodRange {
  startDate: Date;
  endDate: Date;
  label: string;
}

export interface ComparisonMetrics {
  revenue: number;
  orders: number;
  uniqueAccounts: number;
  averageOrderValue: number;
  revenuePerDay: number;
  newAccounts: number;
  topProducts: ProductComparison[];
  topAccounts: AccountComparison[];
  categoryBreakdown: CategoryComparison[];
  representativePerformance: RepresentativeComparison[];
  regionPerformance: RegionComparison[];
  dailyTrend: DailyMetric[];
  organizationId?: string;
  organizationName?: string;
}

export interface ProductComparison {
  productName: string;
  revenue: number;
  quantity: number;
  orders: number;
  percentOfTotal: number;
}

export interface AccountComparison {
  accountName: string;
  revenue: number;
  orders: number;
  percentOfTotal: number;
}

export interface CategoryComparison {
  category: string;
  revenue: number;
  percentOfTotal: number;
}

export interface RepresentativeComparison {
  representative: string;
  revenue: number;
  orders: number;
  percentOfTotal: number;
}

export interface RegionComparison {
  region: string;
  revenue: number;
  percentOfTotal: number;
}

export interface DailyMetric {
  date: string;
  revenue: number;
  orders: number;
}

export interface ComparisonInsight {
  type: 'positive' | 'negative' | 'neutral';
  title: string;
  description: string;
  metric: string;
  change: number;
}

export async function getAggregateComparisonMetrics(
  period: PeriodRange
): Promise<ComparisonMetrics> {
  const startDateStr = format(period.startDate, 'yyyy-MM-dd');
  const endDateStr = format(period.endDate, 'yyyy-MM-dd');

  const { data: salesData, error } = await supabase
    .from('sales_data')
    .select('*')
    .gte('order_date', startDateStr)
    .lte('order_date', endDateStr);

  if (error || !salesData) {
    return createEmptyMetrics();
  }

  const totalRevenue = salesData.reduce((sum, d) => sum + Number(d.revenue), 0);
  const orders = salesData.length;
  const uniqueAccountsSet = new Set(salesData.map(d => d.account_name));
  const uniqueAccounts = uniqueAccountsSet.size;
  const daysInPeriod = Math.max(1, differenceInDays(period.endDate, period.startDate) + 1);

  const allAccountsQuery = await supabase
    .from('sales_data')
    .select('account_name')
    .lt('order_date', startDateStr);

  const existingAccounts = new Set(
    allAccountsQuery.data?.map(d => d.account_name) || []
  );

  const newAccounts = Array.from(uniqueAccountsSet).filter(
    account => !existingAccounts.has(account)
  ).length;

  const productMap = new Map<string, { revenue: number; quantity: number; orders: number }>();
  const accountMap = new Map<string, { revenue: number; orders: number }>();
  const categoryMap = new Map<string, number>();
  const representativeMap = new Map<string, { revenue: number; orders: number }>();
  const regionMap = new Map<string, number>();
  const dailyMap = new Map<string, { revenue: number; orders: number }>();

  salesData.forEach(sale => {
    const product = sale.product_name;
    const existing = productMap.get(product) || { revenue: 0, quantity: 0, orders: 0 };
    existing.revenue += Number(sale.revenue);
    existing.quantity += Number(sale.quantity || 0);
    existing.orders += 1;
    productMap.set(product, existing);

    const account = sale.account_name;
    const accountData = accountMap.get(account) || { revenue: 0, orders: 0 };
    accountData.revenue += Number(sale.revenue);
    accountData.orders += 1;
    accountMap.set(account, accountData);

    const category = sale.category || 'Uncategorized';
    categoryMap.set(category, (categoryMap.get(category) || 0) + Number(sale.revenue));

    const representative = sale.representative || 'Unknown';
    const repData = representativeMap.get(representative) || { revenue: 0, orders: 0 };
    repData.revenue += Number(sale.revenue);
    repData.orders += 1;
    representativeMap.set(representative, repData);

    const region = sale.region || 'Unknown';
    regionMap.set(region, (regionMap.get(region) || 0) + Number(sale.revenue));

    const dateKey = sale.order_date;
    const dailyData = dailyMap.get(dateKey) || { revenue: 0, orders: 0 };
    dailyData.revenue += Number(sale.revenue);
    dailyData.orders += 1;
    dailyMap.set(dateKey, dailyData);
  });

  const topProducts: ProductComparison[] = Array.from(productMap.entries())
    .map(([productName, data]) => ({
      productName,
      revenue: data.revenue,
      quantity: data.quantity,
      orders: data.orders,
      percentOfTotal: (data.revenue / totalRevenue) * 100,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const topAccounts: AccountComparison[] = Array.from(accountMap.entries())
    .map(([accountName, data]) => ({
      accountName,
      revenue: data.revenue,
      orders: data.orders,
      percentOfTotal: (data.revenue / totalRevenue) * 100,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const categoryBreakdown: CategoryComparison[] = Array.from(categoryMap.entries())
    .map(([category, revenue]) => ({
      category,
      revenue,
      percentOfTotal: (revenue / totalRevenue) * 100,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const representativePerformance: RepresentativeComparison[] = Array.from(
    representativeMap.entries()
  )
    .map(([representative, data]) => ({
      representative,
      revenue: data.revenue,
      orders: data.orders,
      percentOfTotal: (data.revenue / totalRevenue) * 100,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const regionPerformance: RegionComparison[] = Array.from(regionMap.entries())
    .map(([region, revenue]) => ({
      region,
      revenue,
      percentOfTotal: (revenue / totalRevenue) * 100,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const completeDailyTrend: DailyMetric[] = [];
  let currentDate = new Date(period.startDate);
  const endDate = new Date(period.endDate);

  while (currentDate <= endDate) {
    const dateKey = format(currentDate, 'yyyy-MM-dd');
    const dayData = dailyMap.get(dateKey);

    completeDailyTrend.push({
      date: dateKey,
      revenue: dayData?.revenue || 0,
      orders: dayData?.orders || 0,
    });

    currentDate = addDays(currentDate, 1);
  }

  return {
    revenue: totalRevenue,
    orders,
    uniqueAccounts,
    averageOrderValue: orders > 0 ? totalRevenue / orders : 0,
    revenuePerDay: totalRevenue / daysInPeriod,
    newAccounts,
    topProducts,
    topAccounts,
    categoryBreakdown,
    representativePerformance,
    regionPerformance,
    dailyTrend: completeDailyTrend,
    organizationName: 'All Brands',
  };
}

export async function getComparisonMetrics(
  organizationId: string,
  period: PeriodRange
): Promise<ComparisonMetrics> {
  const startDateStr = format(period.startDate, 'yyyy-MM-dd');
  const endDateStr = format(period.endDate, 'yyyy-MM-dd');

  const { data: salesData, error } = await supabase
    .from('sales_data')
    .select('*')
    .eq('organization_id', organizationId)
    .gte('order_date', startDateStr)
    .lte('order_date', endDateStr);

  if (error || !salesData) {
    return createEmptyMetrics();
  }

  const totalRevenue = salesData.reduce((sum, d) => sum + Number(d.revenue), 0);
  const orders = salesData.length;
  const uniqueAccountsSet = new Set(salesData.map(d => d.account_name));
  const uniqueAccounts = uniqueAccountsSet.size;
  const daysInPeriod = Math.max(1, differenceInDays(period.endDate, period.startDate) + 1);

  const allAccountsQuery = await supabase
    .from('sales_data')
    .select('account_name')
    .eq('organization_id', organizationId)
    .lt('order_date', startDateStr);

  const existingAccounts = new Set(
    allAccountsQuery.data?.map(d => d.account_name) || []
  );

  const newAccounts = Array.from(uniqueAccountsSet).filter(
    account => !existingAccounts.has(account)
  ).length;

  const productMap = new Map<string, { revenue: number; quantity: number; orders: number }>();
  const accountMap = new Map<string, { revenue: number; orders: number }>();
  const categoryMap = new Map<string, number>();
  const representativeMap = new Map<string, { revenue: number; orders: number }>();
  const regionMap = new Map<string, number>();
  const dailyMap = new Map<string, { revenue: number; orders: number }>();

  salesData.forEach(sale => {
    const product = sale.product_name;
    const existing = productMap.get(product) || { revenue: 0, quantity: 0, orders: 0 };
    existing.revenue += Number(sale.revenue);
    existing.quantity += Number(sale.quantity || 0);
    existing.orders += 1;
    productMap.set(product, existing);

    const account = sale.account_name;
    const accountData = accountMap.get(account) || { revenue: 0, orders: 0 };
    accountData.revenue += Number(sale.revenue);
    accountData.orders += 1;
    accountMap.set(account, accountData);

    const category = sale.category || 'Uncategorized';
    categoryMap.set(category, (categoryMap.get(category) || 0) + Number(sale.revenue));

    const representative = sale.representative || 'Unknown';
    const repData = representativeMap.get(representative) || { revenue: 0, orders: 0 };
    repData.revenue += Number(sale.revenue);
    repData.orders += 1;
    representativeMap.set(representative, repData);

    const region = sale.region || 'Unknown';
    regionMap.set(region, (regionMap.get(region) || 0) + Number(sale.revenue));

    const dateKey = sale.order_date;
    const dailyData = dailyMap.get(dateKey) || { revenue: 0, orders: 0 };
    dailyData.revenue += Number(sale.revenue);
    dailyData.orders += 1;
    dailyMap.set(dateKey, dailyData);
  });

  const topProducts: ProductComparison[] = Array.from(productMap.entries())
    .map(([productName, data]) => ({
      productName,
      revenue: data.revenue,
      quantity: data.quantity,
      orders: data.orders,
      percentOfTotal: (data.revenue / totalRevenue) * 100,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const topAccounts: AccountComparison[] = Array.from(accountMap.entries())
    .map(([accountName, data]) => ({
      accountName,
      revenue: data.revenue,
      orders: data.orders,
      percentOfTotal: (data.revenue / totalRevenue) * 100,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const categoryBreakdown: CategoryComparison[] = Array.from(categoryMap.entries())
    .map(([category, revenue]) => ({
      category,
      revenue,
      percentOfTotal: (revenue / totalRevenue) * 100,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const representativePerformance: RepresentativeComparison[] = Array.from(
    representativeMap.entries()
  )
    .map(([representative, data]) => ({
      representative,
      revenue: data.revenue,
      orders: data.orders,
      percentOfTotal: (data.revenue / totalRevenue) * 100,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const regionPerformance: RegionComparison[] = Array.from(regionMap.entries())
    .map(([region, revenue]) => ({
      region,
      revenue,
      percentOfTotal: (revenue / totalRevenue) * 100,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const completeDailyTrend: DailyMetric[] = [];
  let currentDate = new Date(period.startDate);
  const endDate = new Date(period.endDate);

  while (currentDate <= endDate) {
    const dateKey = format(currentDate, 'yyyy-MM-dd');
    const dayData = dailyMap.get(dateKey);

    completeDailyTrend.push({
      date: dateKey,
      revenue: dayData?.revenue || 0,
      orders: dayData?.orders || 0,
    });

    currentDate = addDays(currentDate, 1);
  }

  return {
    revenue: totalRevenue,
    orders,
    uniqueAccounts,
    averageOrderValue: orders > 0 ? totalRevenue / orders : 0,
    revenuePerDay: totalRevenue / daysInPeriod,
    newAccounts,
    topProducts,
    topAccounts,
    categoryBreakdown,
    representativePerformance,
    regionPerformance,
    dailyTrend: completeDailyTrend,
  };
}

function createEmptyMetrics(): ComparisonMetrics {
  return {
    revenue: 0,
    orders: 0,
    uniqueAccounts: 0,
    averageOrderValue: 0,
    revenuePerDay: 0,
    newAccounts: 0,
    topProducts: [],
    topAccounts: [],
    categoryBreakdown: [],
    representativePerformance: [],
    regionPerformance: [],
    dailyTrend: [],
  };
}

export function calculateChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function generateComparisonInsights(
  current: ComparisonMetrics,
  previous: ComparisonMetrics
): ComparisonInsight[] {
  const insights: ComparisonInsight[] = [];

  const revenueChange = calculateChange(current.revenue, previous.revenue);
  if (Math.abs(revenueChange) > 5) {
    insights.push({
      type: revenueChange > 0 ? 'positive' : 'negative',
      title: revenueChange > 0 ? 'Revenue Growth' : 'Revenue Decline',
      description: `Revenue ${revenueChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(
        revenueChange
      ).toFixed(1)}% compared to the previous period.`,
      metric: 'revenue',
      change: revenueChange,
    });
  }

  const ordersChange = calculateChange(current.orders, previous.orders);
  if (Math.abs(ordersChange) > 10) {
    insights.push({
      type: ordersChange > 0 ? 'positive' : 'negative',
      title: ordersChange > 0 ? 'Order Volume Up' : 'Order Volume Down',
      description: `Total orders ${ordersChange > 0 ? 'grew' : 'declined'} by ${Math.abs(
        ordersChange
      ).toFixed(1)}%, indicating ${
        ordersChange > 0 ? 'increased sales activity' : 'reduced customer engagement'
      }.`,
      metric: 'orders',
      change: ordersChange,
    });
  }

  const aovChange = calculateChange(current.averageOrderValue, previous.averageOrderValue);
  if (Math.abs(aovChange) > 8) {
    insights.push({
      type: aovChange > 0 ? 'positive' : 'negative',
      title: 'Average Order Value Shift',
      description: `Average order value ${aovChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(
        aovChange
      ).toFixed(1)}%, suggesting customers are ${
        aovChange > 0 ? 'buying more per transaction' : 'purchasing less per order'
      }.`,
      metric: 'aov',
      change: aovChange,
    });
  }

  const accountsChange = calculateChange(current.uniqueAccounts, previous.uniqueAccounts);
  if (Math.abs(accountsChange) > 5) {
    insights.push({
      type: accountsChange > 0 ? 'positive' : 'negative',
      title: 'Customer Base Change',
      description: `Active accounts ${accountsChange > 0 ? 'expanded' : 'contracted'} by ${Math.abs(
        accountsChange
      ).toFixed(1)}%, with ${current.newAccounts} new customer${
        current.newAccounts === 1 ? '' : 's'
      } acquired this period.`,
      metric: 'accounts',
      change: accountsChange,
    });
  }

  if (current.topProducts.length > 0 && previous.topProducts.length > 0) {
    const currentTopProduct = current.topProducts[0];
    const previousTopProduct = previous.topProducts[0];

    if (currentTopProduct.productName !== previousTopProduct.productName) {
      insights.push({
        type: 'neutral',
        title: 'Top Product Changed',
        description: `"${currentTopProduct.productName}" became the best-selling product, generating $${currentTopProduct.revenue.toLocaleString(
          undefined,
          { maximumFractionDigits: 0 }
        )}.`,
        metric: 'products',
        change: 0,
      });
    }
  }

  return insights.slice(0, 6);
}

export function findTopGainersAndLosers(
  current: ComparisonMetrics,
  previous: ComparisonMetrics
): {
  productGainers: Array<{ name: string; change: number; currentRevenue: number }>;
  productLosers: Array<{ name: string; change: number; currentRevenue: number }>;
  accountGainers: Array<{ name: string; change: number; currentRevenue: number }>;
  accountLosers: Array<{ name: string; change: number; currentRevenue: number }>;
} {
  const productChanges = new Map<string, { current: number; previous: number }>();

  current.topProducts.forEach(p => {
    productChanges.set(p.productName, { current: p.revenue, previous: 0 });
  });

  previous.topProducts.forEach(p => {
    const existing = productChanges.get(p.productName) || { current: 0, previous: 0 };
    existing.previous = p.revenue;
    productChanges.set(p.productName, existing);
  });

  const productDiffs = Array.from(productChanges.entries())
    .map(([name, data]) => ({
      name,
      change: calculateChange(data.current, data.previous),
      currentRevenue: data.current,
    }))
    .filter(p => p.currentRevenue > 0 || p.change !== 100);

  const productGainers = productDiffs
    .filter(p => p.change > 0)
    .sort((a, b) => b.change - a.change)
    .slice(0, 5);

  const productLosers = productDiffs
    .filter(p => p.change < 0)
    .sort((a, b) => a.change - b.change)
    .slice(0, 5);

  const accountChanges = new Map<string, { current: number; previous: number }>();

  current.topAccounts.forEach(a => {
    accountChanges.set(a.accountName, { current: a.revenue, previous: 0 });
  });

  previous.topAccounts.forEach(a => {
    const existing = accountChanges.get(a.accountName) || { current: 0, previous: 0 };
    existing.previous = a.revenue;
    accountChanges.set(a.accountName, existing);
  });

  const accountDiffs = Array.from(accountChanges.entries())
    .map(([name, data]) => ({
      name,
      change: calculateChange(data.current, data.previous),
      currentRevenue: data.current,
    }))
    .filter(a => a.currentRevenue > 0 || a.change !== 100);

  const accountGainers = accountDiffs
    .filter(a => a.change > 0)
    .sort((a, b) => b.change - a.change)
    .slice(0, 5);

  const accountLosers = accountDiffs
    .filter(a => a.change < 0)
    .sort((a, b) => a.change - b.change)
    .slice(0, 5);

  return {
    productGainers,
    productLosers,
    accountGainers,
    accountLosers,
  };
}

export async function getBrandComparisonMetrics(
  organizationIdA: string,
  organizationIdB: string,
  period: PeriodRange
): Promise<{ brandA: ComparisonMetrics; brandB: ComparisonMetrics }> {
  const [orgAData, orgBData] = await Promise.all([
    supabase.from('organizations').select('name').eq('id', organizationIdA).maybeSingle(),
    supabase.from('organizations').select('name').eq('id', organizationIdB).maybeSingle(),
  ]);

  const [brandAMetrics, brandBMetrics] = await Promise.all([
    getComparisonMetrics(organizationIdA, period),
    getComparisonMetrics(organizationIdB, period),
  ]);

  return {
    brandA: {
      ...brandAMetrics,
      organizationId: organizationIdA,
      organizationName: orgAData.data?.name || 'Brand A',
    },
    brandB: {
      ...brandBMetrics,
      organizationId: organizationIdB,
      organizationName: orgBData.data?.name || 'Brand B',
    },
  };
}

export function generateBrandComparisonInsights(
  brandA: ComparisonMetrics,
  brandB: ComparisonMetrics
): ComparisonInsight[] {
  const insights: ComparisonInsight[] = [];
  const brandAName = brandA.organizationName || 'Brand A';
  const brandBName = brandB.organizationName || 'Brand B';

  const revenueChange = calculateChange(brandA.revenue, brandB.revenue);
  if (Math.abs(revenueChange) > 5) {
    const leader = revenueChange > 0 ? brandAName : brandBName;
    const follower = revenueChange > 0 ? brandBName : brandAName;
    insights.push({
      type: 'neutral',
      title: 'Revenue Leader',
      description: `${leader} generated ${Math.abs(revenueChange).toFixed(1)}% more revenue than ${follower} during this period.`,
      metric: 'revenue',
      change: revenueChange,
    });
  }

  const aovChange = calculateChange(brandA.averageOrderValue, brandB.averageOrderValue);
  if (Math.abs(aovChange) > 8) {
    const leader = aovChange > 0 ? brandAName : brandBName;
    const follower = aovChange > 0 ? brandBName : brandAName;
    insights.push({
      type: 'neutral',
      title: 'Average Order Value Difference',
      description: `${leader} has ${Math.abs(aovChange).toFixed(1)}% higher average order value compared to ${follower}.`,
      metric: 'aov',
      change: aovChange,
    });
  }

  const ordersChange = calculateChange(brandA.orders, brandB.orders);
  if (Math.abs(ordersChange) > 10) {
    const leader = ordersChange > 0 ? brandAName : brandBName;
    insights.push({
      type: 'neutral',
      title: 'Order Volume Difference',
      description: `${leader} processed ${Math.abs(ordersChange).toFixed(1)}% more orders, indicating higher transaction activity.`,
      metric: 'orders',
      change: ordersChange,
    });
  }

  const accountsChange = calculateChange(brandA.uniqueAccounts, brandB.uniqueAccounts);
  if (Math.abs(accountsChange) > 5) {
    const leader = accountsChange > 0 ? brandAName : brandBName;
    insights.push({
      type: 'neutral',
      title: 'Customer Base Size',
      description: `${leader} has ${Math.abs(accountsChange).toFixed(1)}% more active accounts than the other brand.`,
      metric: 'accounts',
      change: accountsChange,
    });
  }

  const revenuePerDayChange = calculateChange(brandA.revenuePerDay, brandB.revenuePerDay);
  if (Math.abs(revenuePerDayChange) > 10) {
    const leader = revenuePerDayChange > 0 ? brandAName : brandBName;
    insights.push({
      type: 'neutral',
      title: 'Daily Revenue Performance',
      description: `${leader} generates ${Math.abs(revenuePerDayChange).toFixed(1)}% more revenue per day on average.`,
      metric: 'revenuePerDay',
      change: revenuePerDayChange,
    });
  }

  if (brandA.topProducts.length > 0 && brandB.topProducts.length > 0) {
    const topProductA = brandA.topProducts[0];
    const topProductB = brandB.topProducts[0];

    insights.push({
      type: 'neutral',
      title: 'Top Products',
      description: `${brandAName}'s top product is "${topProductA.productName}" ($${topProductA.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}) while ${brandBName} leads with "${topProductB.productName}" ($${topProductB.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}).`,
      metric: 'products',
      change: 0,
    });
  }

  return insights.slice(0, 6);
}

export async function logBrandComparison(
  adminUserId: string,
  organizationIdA: string,
  organizationIdB: string,
  period: PeriodRange
): Promise<void> {
  await supabase.from('audit_logs').insert({
    user_id: adminUserId,
    action: 'brand_comparison',
    details: {
      organization_a: organizationIdA,
      organization_b: organizationIdB,
      period_start: format(period.startDate, 'yyyy-MM-dd'),
      period_end: format(period.endDate, 'yyyy-MM-dd'),
    },
  });
}
