import OpenAI from 'openai';
import { MonthlyRevenue, AccountMetrics, ProductPerformance, RevenueByCategory } from './revenueAnalytics';
import { differenceInDays, parseISO } from 'date-fns';
import { supabase } from './supabase';

const openai = import.meta.env.VITE_OPENAI_API_KEY ? new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
}) : null;

interface EnhancedAccountDetails {
  representative: string | null;
  topProducts: string[];
  avgOrderValue: number;
  lastOrderDayOfWeek: string | null;
}

async function getEnhancedAccountDetails(organizationId: string, accountName: string): Promise<EnhancedAccountDetails> {
  const { data: salesData, error } = await supabase
    .from('sales_data')
    .select('representative, product_name, revenue, order_date')
    .eq('organization_id', organizationId)
    .eq('account_name', accountName)
    .order('order_date', { ascending: false })
    .limit(50);

  if (error || !salesData || salesData.length === 0) {
    return {
      representative: null,
      topProducts: [],
      avgOrderValue: 0,
      lastOrderDayOfWeek: null,
    };
  }

  const representative = salesData.find(s => s.representative)?.representative || null;

  const productRevenue = new Map<string, number>();
  salesData.forEach(sale => {
    const current = productRevenue.get(sale.product_name) || 0;
    productRevenue.set(sale.product_name, current + (sale.revenue || 0));
  });

  const topProducts = Array.from(productRevenue.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  const totalRevenue = salesData.reduce((sum, s) => sum + (s.revenue || 0), 0);
  const avgOrderValue = totalRevenue / salesData.length;

  const lastOrderDate = salesData[0]?.order_date ? parseISO(salesData[0].order_date) : null;
  const lastOrderDayOfWeek = lastOrderDate ? lastOrderDate.toLocaleDateString('en-US', { weekday: 'long' }) : null;

  return { representative, topProducts, avgOrderValue, lastOrderDayOfWeek };
}

export interface Insight {
  id: string;
  type: 'growth' | 'decline' | 'anomaly' | 'opportunity' | 'risk' | 'seasonal' | 'forecast' | 'account_lapse' | 'account_visit' | 'account_engagement';
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  metrics?: Record<string, number | string>;
  icon: string;
  accountName?: string;
  relatedAccounts?: string[];
  actionItems?: string[];
  representativeName?: string;
  expectedReorderDate?: string;
  topProducts?: string[];
}

export async function generateInsights(
  monthlyData: MonthlyRevenue[],
  accountMetrics: AccountMetrics[],
  productPerformance: ProductPerformance[],
  categoryRevenue: RevenueByCategory[],
  regionRevenue: RevenueByCategory[],
  organizationId?: string
): Promise<Insight[]> {
  const insights: Insight[] = [];

  try {
    if (organizationId) {
      insights.push(...await identifyLapsedAccounts(organizationId));
    }
  } catch (error) {
    console.error('[InsightGenerator] Lapsed accounts analysis failed:', error);
  }

  try {
    insights.push(...identifyAtRiskAccounts(accountMetrics));
  } catch (error) {
    console.error('[InsightGenerator] At-risk accounts analysis failed:', error);
  }

  try {
    if (organizationId) {
      insights.push(...await identifyAccountsNeedingAttention(organizationId, accountMetrics));
    }
  } catch (error) {
    console.error('[InsightGenerator] Accounts needing attention analysis failed:', error);
  }

  try {
    insights.push(...detectGrowthPatterns(monthlyData));
  } catch (error) {
    console.error('[InsightGenerator] Growth patterns analysis failed:', error);
  }

  try {
    insights.push(...detectAnomalies(monthlyData));
  } catch (error) {
    console.error('[InsightGenerator] Anomaly detection failed:', error);
  }

  try {
    insights.push(...analyzeSeasonality(monthlyData));
  } catch (error) {
    console.error('[InsightGenerator] Seasonality analysis failed:', error);
  }

  try {
    const aiInsights = await generateAIInsights(monthlyData, accountMetrics, productPerformance);
    insights.push(...aiInsights);
  } catch (error) {
    console.error('[InsightGenerator] AI insight generation failed:', error);
  }

  return insights.slice(0, 8);
}

function detectGrowthPatterns(monthlyData: MonthlyRevenue[]): Insight[] {
  if (monthlyData.length < 3) return [];

  const insights: Insight[] = [];
  const recentMonths = monthlyData.slice(-3);
  const avgGrowth = recentMonths.reduce((sum, m) => sum + m.growth, 0) / recentMonths.length;

  if (avgGrowth < -10) {
    const latestMonth = monthlyData[monthlyData.length - 1];
    const previousMonth = monthlyData[monthlyData.length - 2];
    const accountDrop = previousMonth.accounts - latestMonth.accounts;

    insights.push({
      id: 'growth-decline',
      type: 'decline',
      title: 'Revenue Declining - Action Needed',
      description: `Revenue has declined by an average of ${Math.abs(avgGrowth).toFixed(1)}% per month over the last 3 months. Active accounts dropped from ${previousMonth.accounts} to ${latestMonth.accounts}${accountDrop > 0 ? ` (${accountDrop} accounts lost)` : ''}. Focus on re-engaging lost customers and securing commitments from existing accounts.`,
      severity: 'high',
      metrics: {
        'Avg Decline': `${avgGrowth.toFixed(1)}%`,
        'Active Accounts': latestMonth.accounts.toString(),
      },
      icon: 'TrendingDown',
    });
  }

  return insights;
}

async function identifyLapsedAccounts(organizationId: string): Promise<Insight[]> {
  const insights: Insight[] = [];

  const thresholdDate = new Date();
  thresholdDate.setMonth(thresholdDate.getMonth() - 3);

  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('account_name, last_order_date, total_revenue, total_orders, first_order_date')
    .eq('organization_id', organizationId)
    .lt('last_order_date', thresholdDate.toISOString().split('T')[0])
    .order('total_revenue', { ascending: false })
    .limit(10);

  if (error || !accounts || accounts.length === 0) {
    return insights;
  }

  const highValueLapsed = accounts.filter(a => a.total_revenue > 5000);

  if (highValueLapsed.length > 0) {
    const topAccount = highValueLapsed[0];
    const daysSinceOrder = differenceInDays(new Date(), parseISO(topAccount.last_order_date));

    const accountDetails = await getEnhancedAccountDetails(organizationId, topAccount.account_name);

    const avgOrderFrequency = topAccount.total_orders > 1 && topAccount.first_order_date
      ? Math.round(differenceInDays(parseISO(topAccount.last_order_date), parseISO(topAccount.first_order_date)) / (topAccount.total_orders - 1))
      : 0;

    const daysOverdue = avgOrderFrequency > 0 ? daysSinceOrder - avgOrderFrequency : daysSinceOrder;
    const projectedLostRevenue = Math.round((topAccount.total_revenue / topAccount.total_orders) * (daysSinceOrder / (avgOrderFrequency || 30)));

    const actionItems = [
      `Call within 48 hours to check on their business and current needs`,
      accountDetails.topProducts.length > 0
        ? `Discuss restocking their favorites: ${accountDetails.topProducts.slice(0, 2).join(', ')}`
        : 'Review their purchase history and suggest reorder items',
      `Offer a tasting appointment for ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} to showcase new arrivals`,
    ];

    if (accountDetails.representative) {
      actionItems.unshift(`Contact ${accountDetails.representative} (assigned rep) for account context before reaching out`);
    }

    const problemStatement = `PROBLEM: High-value account is ${daysOverdue > 0 ? `${daysOverdue} days overdue` : `${daysSinceOrder} days inactive`} for their typical ordering pattern.`;
    const dataStatement = `DATA: ${topAccount.total_orders} lifetime orders averaging $${Math.round(topAccount.total_revenue / topAccount.total_orders).toLocaleString()} per order${avgOrderFrequency > 0 ? `, normally reorders every ${avgOrderFrequency} days` : ''}. Projected lost revenue: $${projectedLostRevenue.toLocaleString()}.`;
    const actionStatement = accountDetails.topProducts.length > 0
      ? `ACTION: Immediate outreach focusing on restocking ${accountDetails.topProducts[0]} and related products they've purchased before.`
      : `ACTION: Immediate outreach to understand why they've stopped ordering and offer targeted promotions.`;

    insights.push({
      id: `account-lapse-${topAccount.account_name}`,
      type: 'account_lapse',
      title: `${topAccount.account_name} - ${daysOverdue > 0 ? `${daysOverdue} Days Overdue` : `${daysSinceOrder} Days Inactive`}`,
      description: `${problemStatement} ${dataStatement} ${actionStatement}`,
      severity: projectedLostRevenue > 2000 ? 'high' : 'medium',
      metrics: {
        'Days Since Order': daysSinceOrder.toString(),
        'Days Overdue': daysOverdue > 0 ? `${daysOverdue}` : 'N/A',
        'Projected Lost Revenue': `$${projectedLostRevenue.toLocaleString()}`,
        'Avg Order Value': `$${Math.round(topAccount.total_revenue / topAccount.total_orders).toLocaleString()}`,
        'Normal Reorder Cycle': avgOrderFrequency > 0 ? `${avgOrderFrequency} days` : 'Unknown',
      },
      icon: 'AlertTriangle',
      accountName: topAccount.account_name,
      actionItems,
      representativeName: accountDetails.representative || undefined,
      topProducts: accountDetails.topProducts,
    });
  }

  if (accounts.length >= 3) {
    const topThree = accounts.slice(0, 3);
    const accountNames = topThree.map(a => a.account_name).join(', ');
    const totalRevenue = accounts.reduce((sum, a) => sum + a.total_revenue, 0);
    const avgRevenue = totalRevenue / accounts.length;
    const totalOrders = accounts.reduce((sum, a) => sum + a.total_orders, 0);
    const avgDaysSinceOrder = Math.round(
      accounts.reduce((sum, a) => sum + differenceInDays(new Date(), parseISO(a.last_order_date)), 0) / accounts.length
    );

    const accountsList = topThree.map((a, idx) => {
      const days = differenceInDays(new Date(), parseISO(a.last_order_date));
      return `${idx + 1}. ${a.account_name} (${days} days, $${a.total_revenue.toLocaleString()} lifetime value)`;
    }).join('; ');

    const problemStatement = `PROBLEM: ${accounts.length} previously active accounts have stopped ordering (avg ${avgDaysSinceOrder} days inactive).`;
    const dataStatement = `DATA: Combined lifetime revenue of $${totalRevenue.toLocaleString()} across ${totalOrders} historical orders. Average account value: $${Math.round(avgRevenue).toLocaleString()}.`;
    const actionStatement = `ACTION: Execute coordinated outreach campaign this week. Priority accounts: ${accountsList}. Consider territory visit for geographic efficiency.`;

    insights.push({
      id: 'multiple-accounts-lapsed',
      type: 'account_lapse',
      title: `${accounts.length} High-Value Accounts Require Immediate Outreach`,
      description: `${problemStatement} ${dataStatement} ${actionStatement}`,
      severity: 'medium',
      metrics: {
        'Total Accounts': accounts.length.toString(),
        'Combined Lifetime Revenue': `$${totalRevenue.toLocaleString()}`,
        'Avg Days Inactive': avgDaysSinceOrder.toString(),
        'Potential Monthly Loss': `$${Math.round(totalRevenue / totalOrders * 30 / avgDaysSinceOrder).toLocaleString()}`,
      },
      icon: 'Users',
      relatedAccounts: accounts.map(a => a.account_name),
      actionItems: [
        `Schedule calls with all ${accounts.length} accounts within next 3 business days`,
        `Prepare personalized offers based on each account's purchase history`,
        `Consider planning territory visit to meet multiple accounts efficiently`,
      ],
    });
  }

  return insights;
}

function identifyAtRiskAccounts(accountMetrics: AccountMetrics[]): Insight[] {
  const insights: Insight[] = [];

  const decliningAccounts = accountMetrics.filter(a => a.trend === 'down' && a.changePercent < -30);

  if (decliningAccounts.length > 0) {
    const topDecline = decliningAccounts[0];
    const daysSinceOrder = differenceInDays(new Date(), parseISO(topDecline.lastOrderDate));

    const previousRevenue = topDecline.revenue / (1 + topDecline.changePercent / 100);
    const revenueLost = previousRevenue - topDecline.revenue;
    const churnRisk = Math.min(95, Math.abs(topDecline.changePercent) + (daysSinceOrder > 30 ? 20 : 0));

    const problemStatement = `PROBLEM: Critical revenue decline of ${Math.abs(topDecline.changePercent).toFixed(0)}% detected - account at ${churnRisk.toFixed(0)}% churn risk.`;
    const dataStatement = `DATA: Revenue dropped from $${previousRevenue.toLocaleString()} to $${topDecline.revenue.toLocaleString()} (loss of $${revenueLost.toLocaleString()}). Last order ${daysSinceOrder} days ago.`;
    const actionStatement = `ACTION: Urgent call required within 24 hours. Focus on understanding pain points, competitive pressures, and service gaps. Offer special retention pricing or exclusive products.`;

    const actionItems = [
      `Schedule urgent call within 24 hours to discuss recent decline`,
      `Prepare retention offer: 10-15% discount or exclusive product access`,
      `Research competitors in their area to understand potential switching`,
      `Review service quality metrics (delivery times, order accuracy, support response)`,
      `Consider escalating to senior sales leadership if account value warrants`,
    ];

    insights.push({
      id: `account-declining-${topDecline.accountName}`,
      type: 'decline',
      title: `${topDecline.accountName} - Critical: ${Math.abs(topDecline.changePercent).toFixed(0)}% Revenue Decline`,
      description: `${problemStatement} ${dataStatement} ${actionStatement}`,
      severity: churnRisk > 70 ? 'high' : 'medium',
      metrics: {
        'Revenue Decline': `${topDecline.changePercent.toFixed(0)}%`,
        'Revenue Lost': `$${revenueLost.toLocaleString()}`,
        'Churn Risk': `${churnRisk.toFixed(0)}%`,
        'Current Revenue': `$${topDecline.revenue.toLocaleString()}`,
        'Days Since Order': daysSinceOrder.toString(),
      },
      icon: 'TrendingDown',
      accountName: topDecline.accountName,
      actionItems,
    });
  }

  const topGrowingAccounts = accountMetrics.filter(a => a.trend === 'up' && a.changePercent > 30);

  if (topGrowingAccounts.length > 0) {
    const topGrowth = topGrowingAccounts[0];
    const previousRevenue = topGrowth.revenue / (1 + topGrowth.changePercent / 100);
    const revenueGained = topGrowth.revenue - previousRevenue;
    const projectedAnnualGrowth = revenueGained * 12;

    const problemStatement = `OPPORTUNITY: High-momentum account showing ${topGrowth.changePercent.toFixed(0)}% growth - prime for expansion.`;
    const dataStatement = `DATA: Revenue increased from $${previousRevenue.toLocaleString()} to $${topGrowth.revenue.toLocaleString()} (+$${revenueGained.toLocaleString()} monthly). Projected annual growth: $${projectedAnnualGrowth.toLocaleString()}.`;
    const actionStatement = `ACTION: Strike while hot - schedule strategic account review within 1 week. Introduce premium products, discuss volume commitments, and explore exclusive partnership opportunities.`;

    const actionItems = [
      `Schedule account review meeting within 7 days to discuss growth and future needs`,
      `Prepare premium product portfolio and exclusive offerings for presentation`,
      `Propose volume discount structure to incentivize larger orders`,
      `Discuss case study or testimonial opportunity (if applicable)`,
      `Consider account exclusivity or preferred pricing tier`,
    ];

    insights.push({
      id: `account-growing-${topGrowth.accountName}`,
      type: 'growth',
      title: `${topGrowth.accountName} - High-Growth Account: ${topGrowth.changePercent.toFixed(0)}% Increase`,
      description: `${problemStatement} ${dataStatement} ${actionStatement}`,
      severity: 'medium',
      metrics: {
        'Growth Rate': `+${topGrowth.changePercent.toFixed(0)}%`,
        'Revenue Gained': `$${revenueGained.toLocaleString()}`,
        'Current Monthly': `$${topGrowth.revenue.toLocaleString()}`,
        'Projected Annual Growth': `$${projectedAnnualGrowth.toLocaleString()}`,
      },
      icon: 'UserCheck',
      accountName: topGrowth.accountName,
      actionItems,
    });
  }

  return insights;
}

async function identifyAccountsNeedingAttention(organizationId: string, accountMetrics: AccountMetrics[]): Promise<Insight[]> {
  const insights: Insight[] = [];

  const { data: recentAccounts, error } = await supabase
    .from('accounts')
    .select('account_name, first_order_date, last_order_date, total_orders, total_revenue')
    .eq('organization_id', organizationId)
    .order('first_order_date', { ascending: true });

  if (error || !recentAccounts) {
    return insights;
  }

  const earlyAdopters = recentAccounts.filter(a => {
    const firstOrder = parseISO(a.first_order_date);
    const lastOrder = parseISO(a.last_order_date);
    const daysSinceFirst = differenceInDays(new Date(), firstOrder);
    const daysSinceLast = differenceInDays(new Date(), lastOrder);
    return daysSinceFirst > 180 && daysSinceLast > 60 && a.total_revenue > 1000;
  });

  if (earlyAdopters.length > 0) {
    const account = earlyAdopters[0];
    const daysSinceLast = differenceInDays(new Date(), parseISO(account.last_order_date));

    insights.push({
      id: `early-adopter-${account.account_name}`,
      type: 'account_visit',
      title: `${account.account_name} - Early Customer Needing Attention`,
      description: `This account ordered early on but hasn't ordered in ${daysSinceLast} days. They have ${account.total_orders} lifetime orders worth $${account.total_revenue.toLocaleString()}. Schedule a visit or tasting to reconnect.`,
      severity: 'high',
      metrics: {
        'Days Inactive': daysSinceLast.toString(),
        'Lifetime Orders': account.total_orders.toString(),
        'Lifetime Revenue': `$${account.total_revenue.toLocaleString()}`,
      },
      icon: 'Clock',
      accountName: account.account_name,
    });
  }

  const irregularOrdering = recentAccounts.filter(a => {
    const lastOrder = parseISO(a.last_order_date);
    const daysSinceLast = differenceInDays(new Date(), lastOrder);
    const averageDaysBetweenOrders = a.total_orders > 1 ?
      differenceInDays(lastOrder, parseISO(a.first_order_date)) / (a.total_orders - 1) : 0;

    return daysSinceLast > averageDaysBetweenOrders * 1.5 &&
           daysSinceLast > 30 &&
           daysSinceLast < 90 &&
           a.total_revenue > 2000;
  });

  if (irregularOrdering.length > 0) {
    const account = irregularOrdering[0];
    const lastOrder = parseISO(account.last_order_date);
    const daysSinceLast = differenceInDays(new Date(), lastOrder);
    const averageDaysBetweenOrders = account.total_orders > 1 ?
      differenceInDays(lastOrder, parseISO(account.first_order_date)) / (account.total_orders - 1) : 0;

    const daysOverdue = daysSinceLast - averageDaysBetweenOrders;
    const avgOrderValue = account.total_revenue / account.total_orders;
    const expectedNextOrderDate = new Date(lastOrder.getTime() + averageDaysBetweenOrders * 24 * 60 * 60 * 1000);

    const problemStatement = `PROBLEM: Account is ${Math.round(daysOverdue)} days past their typical ${Math.round(averageDaysBetweenOrders)}-day reorder cycle.`;
    const dataStatement = `DATA: ${account.total_orders} lifetime orders averaging $${Math.round(avgOrderValue).toLocaleString()} each. Expected reorder date was ${expectedNextOrderDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`;
    const actionStatement = `ACTION: Proactive call this week to check inventory levels and secure next order. Mention best-selling items from their purchase history.`;

    insights.push({
      id: `irregular-ordering-${account.account_name}`,
      type: 'account_engagement',
      title: `${account.account_name} - ${Math.round(daysOverdue)} Days Past Reorder Window`,
      description: `${problemStatement} ${dataStatement} ${actionStatement}`,
      severity: daysOverdue > 20 ? 'high' : 'medium',
      metrics: {
        'Days Overdue': Math.round(daysOverdue).toString(),
        'Expected Reorder': expectedNextOrderDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        'Avg Order Value': `$${Math.round(avgOrderValue).toLocaleString()}`,
        'Normal Cycle': `${Math.round(averageDaysBetweenOrders)} days`,
      },
      icon: 'Calendar',
      accountName: account.account_name,
      actionItems: [
        `Call within 2 business days to check current inventory and needs`,
        `Remind them of their typical reorder pattern and suggest restocking`,
        `Offer limited-time promotion to incentivize immediate order`,
      ],
    });
  }

  return insights;
}


function detectAnomalies(monthlyData: MonthlyRevenue[]): Insight[] {
  if (monthlyData.length < 4) return [];

  const insights: Insight[] = [];
  const revenues = monthlyData.map(m => m.revenue);
  const mean = revenues.reduce((a, b) => a + b, 0) / revenues.length;
  const variance = revenues.reduce((sum, rev) => sum + Math.pow(rev - mean, 2), 0) / revenues.length;
  const stdDev = Math.sqrt(variance);

  const latestMonth = monthlyData[monthlyData.length - 1];

  if (Math.abs(latestMonth.revenue - mean) > 2 * stdDev) {
    const isHigh = latestMonth.revenue > mean;

    if (!isHigh) {
      insights.push({
        id: 'anomaly-detected',
        type: 'anomaly',
        title: `Urgent Need to Reassess Marketing Strategy`,
        description: `The sales revenue plummeted sharply from $${monthlyData[monthlyData.length - 2]?.revenue.toLocaleString() || 'N/A'} to just $${latestMonth.revenue.toLocaleString()} in ${latestMonth.month}, indicating a staggering decline of ${((Math.abs(latestMonth.revenue - mean) / mean) * 100).toFixed(1)}%. To reverse this trend, we should immediately focus on re-engaging lost customers and increasing marketing efforts targeting the top-performing product.`,
        severity: 'high',
        metrics: {
          'Current': `$${latestMonth.revenue.toLocaleString()}`,
          'Previous': `$${monthlyData[monthlyData.length - 2]?.revenue.toLocaleString() || 'N/A'}`,
          'Active Accounts': `${latestMonth.accounts}`,
        },
        icon: 'Zap',
      });
    }
  }

  return insights;
}


function analyzeSeasonality(monthlyData: MonthlyRevenue[]): Insight[] {
  if (monthlyData.length < 12) return [];

  const insights: Insight[] = [];

  const monthlyAverages = new Map<string, number[]>();
  monthlyData.forEach(data => {
    const monthName = data.month.split(' ')[0];
    if (!monthlyAverages.has(monthName)) {
      monthlyAverages.set(monthName, []);
    }
    monthlyAverages.get(monthName)!.push(data.revenue);
  });

  const avgByMonth = Array.from(monthlyAverages.entries()).map(([month, revenues]) => ({
    month,
    avgRevenue: revenues.reduce((a, b) => a + b, 0) / revenues.length,
  }));

  if (avgByMonth.length >= 12) {
    const sorted = [...avgByMonth].sort((a, b) => b.avgRevenue - a.avgRevenue);
    const bestMonth = sorted[0];
    const worstMonth = sorted[sorted.length - 1];

    if (bestMonth.avgRevenue > worstMonth.avgRevenue * 1.3) {
      insights.push({
        id: 'seasonality-pattern',
        type: 'seasonal',
        title: 'Seasonal Pattern Detected',
        description: `Historical data shows ${bestMonth.month} is typically your strongest month ($${bestMonth.avgRevenue.toLocaleString()} avg), while ${worstMonth.month} is weakest ($${worstMonth.avgRevenue.toLocaleString()} avg). Plan inventory and campaigns accordingly.`,
        severity: 'low',
        metrics: {
          'Best Month': bestMonth.month,
          'Worst Month': worstMonth.month,
        },
        icon: 'Calendar',
      });
    }
  }

  return insights;
}

async function generateAIInsights(
  monthlyData: MonthlyRevenue[],
  accountMetrics: AccountMetrics[],
  productPerformance: ProductPerformance[]
): Promise<Insight[]> {
  if (!import.meta.env.VITE_OPENAI_API_KEY || !openai) {
    console.log('[InsightGenerator] OpenAI API key not configured, skipping AI insights');
    return [];
  }

  try {
    const recentMonths = monthlyData.slice(-6);
    const topAccounts = accountMetrics.slice(0, 10);
    const topProducts = productPerformance.slice(0, 10);

    const prompt = `Analyze this sales data and provide ONE highly specific, actionable insight using the Problem-Data-Action format:

Monthly Revenue Trends (last 6 months):
${recentMonths.map(m => `${m.month}: $${m.revenue.toLocaleString()} (${m.orders} orders, ${m.accounts} accounts, ${m.growth.toFixed(1)}% growth)`).join('\n')}

Top Accounts Performance:
${topAccounts.map(a => `${a.accountName}: $${a.revenue.toLocaleString()} (${a.trend} ${a.changePercent.toFixed(0)}%, last order: ${a.lastOrderDate})`).join('\n')}

CRITICAL REQUIREMENTS:
- Mention specific account names from the data above
- Include exact dollar amounts and percentages from the data
- Provide concrete actions with specific timeframes (e.g., "within 3 days", "by Friday")
- Identify patterns across multiple accounts if relevant
- Calculate potential revenue impact or opportunity size
- NO generic advice - every recommendation must be data-specific

Use this exact format:
Title: [Specific title with account name(s) and key metric]
Description: PROBLEM: [One sentence stating the specific issue with numbers]. DATA: [One sentence with relevant metrics, trends, and calculations]. ACTION: [One sentence with specific, immediate next steps including timeframe and expected outcome].
Actions: [Bullet list of 3-4 concrete action items]
Severity: [high/medium/low based on revenue impact]`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a sales operations analyst specializing in account management. You must be extremely specific, citing exact account names, dollar amounts, and percentages from the provided data. Every insight must include concrete next steps with specific timeframes. Never provide generic advice.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 400,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || '';

    const titleMatch = content.match(/Title:\s*(.+?)(?:\n|$)/);
    const descMatch = content.match(/Description:\s*(.+?)(?=Actions:|Severity:|$)/s);
    const actionsMatch = content.match(/Actions:\s*(.+?)(?=Severity:|$)/s);
    const severityMatch = content.match(/Severity:\s*(high|medium|low)/i);

    if (titleMatch && descMatch) {
      const actionItems = actionsMatch
        ? actionsMatch[1].trim().split('\n').filter(line => line.trim().startsWith('-') || line.trim().startsWith('•')).map(line => line.replace(/^[-•]\s*/, '').trim())
        : undefined;

      return [{
        id: 'ai-insight',
        type: 'opportunity',
        title: titleMatch[1].trim(),
        description: descMatch[1].trim(),
        severity: (severityMatch?.[1]?.toLowerCase() as 'high' | 'medium' | 'low') || 'medium',
        icon: 'Sparkles',
        actionItems: actionItems && actionItems.length > 0 ? actionItems : undefined,
      }];
    }
  } catch (error) {
    console.error('AI insight generation error:', error);
  }

  return [];
}
