import { Insight } from './insightGenerator';
import { TaskInsert, createTask, createAlert, getRepresentativeFromAccount } from './taskService';
import { supabase } from './supabase';
import { addDays, addWeeks } from 'date-fns';

export interface TaskGenerationOptions {
  organizationId: string;
  userId: string;
  autoAssign?: boolean;
}

export async function generateTaskFromInsight(
  insight: Insight,
  options: TaskGenerationOptions
): Promise<string | null> {
  const { organizationId, userId, autoAssign = true } = options;

  let assignedTo: string | null = null;
  let dueDate: Date | null = null;
  let description = insight.description;

  if (autoAssign && insight.metrics && 'ACCOUNT' in insight.metrics) {
    const accountName = insight.metrics['ACCOUNT'] as string;
    const representative = await getRepresentativeFromAccount(organizationId, accountName);

    if (representative) {
      const { data: repUser } = await supabase
        .from('sales_data')
        .select('representative')
        .eq('organization_id', organizationId)
        .eq('representative', representative)
        .limit(1)
        .maybeSingle();

      if (repUser) {
        description = `${description}\n\nAssigned to: ${representative}`;
      }
    }
  }

  const priority = mapSeverityToPriority(insight.severity);
  dueDate = calculateDueDateFromInsight(insight);

  const taskData: TaskInsert = {
    organization_id: organizationId,
    user_id: userId,
    assigned_to: assignedTo,
    title: insight.title,
    description,
    status: 'pending',
    priority,
    insight_id: insight.id,
    related_account: extractAccountFromInsight(insight),
    related_product: extractProductFromInsight(insight),
    related_revenue: extractRevenueFromInsight(insight),
    due_date: dueDate?.toISOString() || null,
    auto_generated: true,
    tags: [insight.type],
    metadata: {
      insightType: insight.type,
      insightSeverity: insight.severity,
      metrics: insight.metrics || {},
    },
  };

  try {
    const task = await createTask(taskData);
    return task.id;
  } catch (error) {
    console.error('[TaskGenerator] Error creating task from insight:', error);
    return null;
  }
}

export async function detectAndCreateAccountLapseTasks(
  organizationId: string,
  userId: string,
  daysThreshold = 90
): Promise<string[]> {
  const thresholdDate = addDays(new Date(), -daysThreshold).toISOString();

  const { data: lapsedAccounts, error } = await supabase
    .from('accounts')
    .select('account_name, last_order_date, total_revenue')
    .eq('organization_id', organizationId)
    .lt('last_order_date', thresholdDate)
    .order('total_revenue', { ascending: false });

  if (error || !lapsedAccounts) {
    console.error('[TaskGenerator] Error fetching lapsed accounts:', error);
    return [];
  }

  const taskIds: string[] = [];

  for (const account of lapsedAccounts.slice(0, 10)) {
    const representative = await getRepresentativeFromAccount(organizationId, account.account_name);
    const daysSinceLastOrder = Math.floor(
      (Date.now() - new Date(account.last_order_date || 0).getTime()) / (1000 * 60 * 60 * 24)
    );

    const taskData: TaskInsert = {
      organization_id: organizationId,
      user_id: userId,
      title: `Follow up with ${account.account_name} - ${daysSinceLastOrder} days inactive`,
      description: `Account "${account.account_name}" has not placed an order in ${daysSinceLastOrder} days. Last order was on ${new Date(account.last_order_date || '').toLocaleDateString()}. Total account value: $${account.total_revenue.toLocaleString()}.\n\nSuggested actions:\n- Call the account to check in\n- Offer promotions or new products\n- Verify contact information is current${representative ? `\n- Contact representative: ${representative}` : ''}`,
      status: 'pending',
      priority: account.total_revenue > 10000 ? 'high' : account.total_revenue > 5000 ? 'medium' : 'low',
      related_account: account.account_name,
      related_revenue: account.total_revenue,
      due_date: addWeeks(new Date(), 1).toISOString(),
      auto_generated: true,
      tags: ['account_lapse', 'follow_up'],
      metadata: {
        daysSinceLastOrder,
        lastOrderDate: account.last_order_date,
        representative,
      },
    };

    try {
      const task = await createTask(taskData);
      taskIds.push(task.id);

      await createAlert({
        organization_id: organizationId,
        alert_type: 'account_lapse',
        severity: taskData.priority === 'high' ? 'high' : 'medium',
        title: `Account Inactive: ${account.account_name}`,
        description: `${account.account_name} has been inactive for ${daysSinceLastOrder} days`,
        trigger_data: {
          accountName: account.account_name,
          daysSinceLastOrder,
          totalRevenue: account.total_revenue,
        },
        related_task_id: task.id,
      });
    } catch (error) {
      console.error('[TaskGenerator] Error creating lapsed account task:', error);
    }
  }

  return taskIds;
}

export async function detectDecliningAccountTasks(
  organizationId: string,
  userId: string,
  declineThreshold = -20
): Promise<string[]> {
  const { data: salesData, error } = await supabase
    .from('sales_data')
    .select('account_name, order_date, revenue, representative')
    .eq('organization_id', organizationId)
    .order('order_date', { ascending: false });

  if (error || !salesData) {
    console.error('[TaskGenerator] Error fetching sales data for decline analysis:', error);
    return [];
  }

  const accountPerformance = new Map<string, { currentMonth: number; previousMonth: number; representative: string | null }>();

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  salesData.forEach(sale => {
    const orderDate = new Date(sale.order_date);
    const accountData = accountPerformance.get(sale.account_name) || {
      currentMonth: 0,
      previousMonth: 0,
      representative: sale.representative,
    };

    if (orderDate >= currentMonthStart) {
      accountData.currentMonth += sale.revenue;
    } else if (orderDate >= previousMonthStart && orderDate <= previousMonthEnd) {
      accountData.previousMonth += sale.revenue;
    }

    accountPerformance.set(sale.account_name, accountData);
  });

  const taskIds: string[] = [];

  for (const [accountName, data] of accountPerformance) {
    if (data.previousMonth > 0) {
      const changePercent = ((data.currentMonth - data.previousMonth) / data.previousMonth) * 100;

      if (changePercent < declineThreshold) {
        const taskData: TaskInsert = {
          organization_id: organizationId,
          user_id: userId,
          title: `Declining Account: ${accountName} (${changePercent.toFixed(0)}% decline)`,
          description: `Account "${accountName}" has experienced a ${Math.abs(changePercent).toFixed(0)}% revenue decline this month.\n\nRevenue:\n- Previous Month: $${data.previousMonth.toLocaleString()}\n- Current Month: $${data.currentMonth.toLocaleString()}\n\nSuggested actions:\n- Schedule a call to understand challenges\n- Review pricing and product satisfaction\n- Identify opportunities to win back business${data.representative ? `\n- Contact representative: ${data.representative}` : ''}`,
          status: 'pending',
          priority: Math.abs(changePercent) > 50 ? 'urgent' : 'high',
          related_account: accountName,
          related_revenue: data.currentMonth,
          due_date: addDays(new Date(), 3).toISOString(),
          auto_generated: true,
          tags: ['revenue_decline', 'urgent_action'],
          metadata: {
            changePercent,
            currentMonthRevenue: data.currentMonth,
            previousMonthRevenue: data.previousMonth,
            representative: data.representative,
          },
        };

        try {
          const task = await createTask(taskData);
          taskIds.push(task.id);

          await createAlert({
            organization_id: organizationId,
            alert_type: 'revenue_decline',
            severity: 'high',
            title: `Revenue Decline Alert: ${accountName}`,
            description: `${Math.abs(changePercent).toFixed(0)}% decline detected`,
            trigger_data: {
              accountName,
              changePercent,
              currentRevenue: data.currentMonth,
              previousRevenue: data.previousMonth,
            },
            related_task_id: task.id,
          });
        } catch (error) {
          console.error('[TaskGenerator] Error creating declining account task:', error);
        }
      }
    }
  }

  return taskIds;
}

function mapSeverityToPriority(severity: 'low' | 'medium' | 'high'): 'low' | 'medium' | 'high' | 'urgent' {
  const mapping = {
    low: 'low' as const,
    medium: 'medium' as const,
    high: 'high' as const,
  };
  return mapping[severity];
}

function calculateDueDateFromInsight(insight: Insight): Date | null {
  switch (insight.severity) {
    case 'high':
      return addDays(new Date(), 3);
    case 'medium':
      return addWeeks(new Date(), 1);
    case 'low':
      return addWeeks(new Date(), 2);
    default:
      return addWeeks(new Date(), 1);
  }
}

function extractAccountFromInsight(insight: Insight): string | null {
  if (insight.metrics) {
    if ('ACCOUNT' in insight.metrics) {
      return insight.metrics['ACCOUNT'] as string;
    }

    const accountMatch = insight.description.match(/[Aa]ccount[s]?:?\s+"?([^",.]+)"?/);
    if (accountMatch) {
      return accountMatch[1].trim();
    }
  }
  return null;
}

function extractProductFromInsight(insight: Insight): string | null {
  if (insight.type === 'risk' || insight.type === 'decline') {
    const productMatch = insight.title.match(/^(.+?)\s*-/);
    if (productMatch) {
      return productMatch[1].trim();
    }
  }
  return null;
}

function extractRevenueFromInsight(insight: Insight): number | null {
  if (insight.metrics) {
    if ('Revenue' in insight.metrics || 'REVENUE' in insight.metrics) {
      const revenueStr = (insight.metrics['Revenue'] || insight.metrics['REVENUE']) as string;
      const revenueMatch = revenueStr.match(/\$?([\d,]+)/);
      if (revenueMatch) {
        return parseFloat(revenueMatch[1].replace(/,/g, ''));
      }
    }

    if ('Revenue Impact' in insight.metrics) {
      const revenueStr = insight.metrics['Revenue Impact'] as string;
      const revenueMatch = revenueStr.match(/\$?([\d,]+)/);
      if (revenueMatch) {
        return parseFloat(revenueMatch[1].replace(/,/g, ''));
      }
    }
  }
  return null;
}
