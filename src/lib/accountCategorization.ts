import { supabase } from './supabase';
import { getOrganizationOpenAI } from './openai';
import { differenceInDays } from 'date-fns';

export type BlitzCategory = 'large_active' | 'small_active' | 'large_loss' | 'small_loss' | 'one_time' | 'inactive';

export interface AccountMetrics {
  accountName: string;
  baselineAvg: number;
  recentAvg: number;
  trendPercent: number;
  totalOrders: number;
  firstOrderDate: string;
  lastOrderDate: string;
  lastOrderDaysAgo: number;
  uniqueMonthsWithOrders: number;
  monthlyPattern: string;
}

export interface AccountCategorization {
  accountName: string;
  category: BlitzCategory;
  confidence: number;
  reasoning: string;
}

export interface CachedCategorization {
  account_name: string;
  category: BlitzCategory;
  confidence_score: number;
  reasoning: string;
  categorized_at: string;
  baseline_avg: number;
  recent_avg: number;
  trend_percent: number;
  total_orders: number;
  last_order_date: string;
}

const RECATEGORIZATION_DAYS = 30;
const BATCH_SIZE = 50;

export async function shouldRecategorize(organizationId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('account_categorizations')
    .select('categorized_at')
    .eq('organization_id', organizationId)
    .order('categorized_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return true;
  }

  const daysSince = differenceInDays(new Date(), new Date(data.categorized_at));
  return daysSince >= RECATEGORIZATION_DAYS;
}

export async function getCachedCategorizations(
  organizationId: string
): Promise<Map<string, CachedCategorization>> {
  const { data, error } = await supabase
    .from('account_categorizations')
    .select('*')
    .eq('organization_id', organizationId);

  if (error || !data) {
    console.error('Error fetching cached categorizations:', error);
    return new Map();
  }

  const categorizationMap = new Map<string, CachedCategorization>();
  data.forEach(cat => {
    categorizationMap.set(cat.account_name, cat);
  });

  return categorizationMap;
}

export async function saveCategorizations(
  organizationId: string,
  categorizations: Array<AccountCategorization & AccountMetrics>
): Promise<void> {
  const records = categorizations.map(cat => ({
    organization_id: organizationId,
    account_name: cat.accountName,
    category: cat.category,
    confidence_score: cat.confidence,
    reasoning: cat.reasoning,
    categorized_at: new Date().toISOString(),
    baseline_avg: cat.baselineAvg,
    recent_avg: cat.recentAvg,
    trend_percent: cat.trendPercent,
    total_orders: cat.totalOrders,
    last_order_date: cat.lastOrderDate || null,
  }));

  const { error } = await supabase
    .from('account_categorizations')
    .upsert(records, {
      onConflict: 'organization_id,account_name',
    });

  if (error) {
    console.error('Error saving categorizations:', error);
    throw error;
  }
}

export async function categorizeAccountsWithAI(
  organizationId: string,
  accountMetrics: AccountMetrics[],
  largeThreshold: number = 1.0
): Promise<AccountCategorization[]> {
  const aiClient = await getOrganizationOpenAI(organizationId);

  if (!aiClient) {
    console.warn('No OpenAI client available. Falling back to rule-based categorization.');
    return accountMetrics.map(account => ({
      accountName: account.accountName,
      ...getRuleBasedCategory(account, largeThreshold),
    }));
  }

  const categorizations: AccountCategorization[] = [];

  for (let i = 0; i < accountMetrics.length; i += BATCH_SIZE) {
    const batch = accountMetrics.slice(i, i + BATCH_SIZE);

    try {
      const batchResults = await categorizeBatch(aiClient, batch, largeThreshold);
      categorizations.push(...batchResults);
    } catch (error) {
      console.error('Error categorizing batch:', error);
      batch.forEach(account => {
        categorizations.push({
          accountName: account.accountName,
          ...getRuleBasedCategory(account, largeThreshold),
        });
      });
    }
  }

  return categorizations;
}

async function categorizeBatch(
  aiClient: any,
  accounts: AccountMetrics[],
  largeThreshold: number
): Promise<AccountCategorization[]> {
  const prompt = buildCategorizationPrompt(accounts, largeThreshold);

  const response = await aiClient.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are a sales analytics expert specializing in customer account categorization for beverage distribution. Analyze account patterns and categorize them accurately based on their purchasing behavior.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.2,
    response_format: { type: 'json_object' }
  });

  const content = response.choices[0]?.message?.content || '{"categorizations": []}';
  const parsed = JSON.parse(content);
  const categorizations = parsed.categorizations || parsed.accounts || [];

  return categorizations.map((cat: any) => ({
    accountName: cat.accountName || cat.account_name || '',
    category: cat.category as BlitzCategory,
    confidence: parseFloat(cat.confidence) || 0.5,
    reasoning: cat.reasoning || 'AI categorization',
  }));
}

function buildCategorizationPrompt(accounts: AccountMetrics[], largeThreshold: number): string {
  const accountSummaries = accounts.map(acc => ({
    accountName: acc.accountName,
    baselineAvg: Number(acc.baselineAvg.toFixed(2)),
    recentAvg: Number(acc.recentAvg.toFixed(2)),
    trendPercent: Number(acc.trendPercent.toFixed(1)),
    totalOrders: acc.totalOrders,
    lastOrderDaysAgo: acc.lastOrderDaysAgo,
    uniqueMonthsWithOrders: acc.uniqueMonthsWithOrders,
    monthlyPattern: acc.monthlyPattern,
  }));

  return `Analyze these ${accounts.length} beverage distribution customer accounts and categorize each one.

ACCOUNT DATA:
${JSON.stringify(accountSummaries, null, 2)}

CATEGORY DEFINITIONS:

1. **LARGE_ACTIVE**: High-volume accounts consistently ordering ${largeThreshold}+ cases/month
   - Baseline average ≥ ${largeThreshold} cases/month
   - Recent activity present (recentAvg > 0)
   - Trend not severely declining (trendPercent ≥ -25%)
   - Represents stable, high-value customers

2. **SMALL_ACTIVE**: Lower-volume accounts with consistent ordering
   - Baseline average < ${largeThreshold} cases/month
   - Recent activity present (recentAvg > 0)
   - Trend not severely declining (trendPercent ≥ -50%)
   - Regular ordering pattern maintained

3. **LARGE_LOSS**: Previously high-volume accounts now declining or stopped
   - Baseline average ≥ ${largeThreshold} cases/month (were strong)
   - Either severely declining (trendPercent < -25%) OR no recent orders
   - Critical revenue at risk
   - Requires immediate attention

4. **SMALL_LOSS**: Lower-volume accounts that have declined or stopped
   - Baseline average > 0 but < ${largeThreshold} cases/month
   - Either declining significantly (trendPercent < -50%) OR inactive
   - Had some history but fading away

5. **ONE_TIME**: Accounts that ordered exactly once and never returned
   - uniqueMonthsWithOrders = 1
   - Single purchase, no repeat business
   - May indicate one-time event or dissatisfaction

6. **INACTIVE**: Accounts with no orders in 90+ days
   - lastOrderDaysAgo > 90
   - Either never had significant volume OR dropped off completely
   - May include accounts with zero recent activity

ANALYSIS GUIDELINES:
- Consider the FULL pattern: volume, trend, recency, consistency
- "monthlyPattern" shows which months had orders (e.g., "2024-04, 2024-05, 2024-06")
- Baseline is average from older months, Recent is last 3 months average
- trendPercent shows change: positive = growing, negative = declining
- Balance all factors - don't rely on just one metric
- If an account had only 1 order ever (uniqueMonthsWithOrders=1), it's ONE_TIME
- If lastOrderDaysAgo > 90 and no recent trend, likely INACTIVE
- High baseline + low/zero recent = LOSS category (LARGE or SMALL based on baseline)

Return a JSON object with this structure:
{
  "categorizations": [
    {
      "accountName": "exact account name from input",
      "category": "large_active|small_active|large_loss|small_loss|one_time|inactive",
      "confidence": 0.0-1.0,
      "reasoning": "2-3 sentence explanation considering volume, trend, and recency"
    }
  ]
}

Analyze each account carefully and provide accurate categorizations with confidence scores and clear reasoning.`;
}

function getRuleBasedCategory(
  account: AccountMetrics,
  largeThreshold: number
): { category: BlitzCategory; confidence: number; reasoning: string } {
  const hasRecentActivity = account.recentAvg > 0;

  if (account.uniqueMonthsWithOrders === 0) {
    return {
      category: 'inactive',
      confidence: 1.0,
      reasoning: 'Account has no order history in the analysis period.',
    };
  }

  if (account.uniqueMonthsWithOrders === 1) {
    return {
      category: 'one_time',
      confidence: 1.0,
      reasoning: 'Account ordered only once and never returned, indicating a single transaction.',
    };
  }

  if (!hasRecentActivity && account.lastOrderDaysAgo > 90) {
    return {
      category: 'inactive',
      confidence: 0.9,
      reasoning: `Account has been inactive for ${account.lastOrderDaysAgo} days with no recent orders.`,
    };
  }

  if (account.baselineAvg >= largeThreshold) {
    if (hasRecentActivity && account.trendPercent >= -25) {
      return {
        category: 'large_active',
        confidence: 0.8,
        reasoning: `High-volume account averaging ${account.baselineAvg.toFixed(1)} cases/month with ${account.trendPercent >= 0 ? 'positive' : 'stable'} trend.`,
      };
    } else {
      return {
        category: 'large_loss',
        confidence: 0.85,
        reasoning: `Previously strong account (${account.baselineAvg.toFixed(1)} cases/month baseline) now showing ${account.trendPercent.toFixed(0)}% decline or inactivity.`,
      };
    }
  } else {
    if (hasRecentActivity && account.trendPercent >= -50) {
      return {
        category: 'small_active',
        confidence: 0.75,
        reasoning: `Lower-volume account with consistent activity averaging ${account.baselineAvg.toFixed(1)} cases/month.`,
      };
    } else if (account.baselineAvg > 0) {
      return {
        category: 'small_loss',
        confidence: 0.8,
        reasoning: `Account showing decline from ${account.baselineAvg.toFixed(1)} cases/month baseline with ${account.trendPercent.toFixed(0)}% trend.`,
      };
    } else {
      return {
        category: 'small_active',
        confidence: 0.6,
        reasoning: `Account with minimal baseline but recent activity, averaging ${account.recentAvg.toFixed(1)} cases/month recently.`,
      };
    }
  }
}

export async function forceRecategorization(organizationId: string): Promise<void> {
  const { error } = await supabase
    .from('account_categorizations')
    .delete()
    .eq('organization_id', organizationId);

  if (error) {
    console.error('Error clearing categorizations:', error);
    throw error;
  }
}
