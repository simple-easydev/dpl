import { supabase } from './supabase';
import { Database } from './database.types';

export type Task = Database['public']['Tables']['tasks']['Row'];
export type TaskInsert = Database['public']['Tables']['tasks']['Insert'];
export type TaskUpdate = Database['public']['Tables']['tasks']['Update'];
export type Alert = Database['public']['Tables']['alerts']['Row'];
export type AlertInsert = Database['public']['Tables']['alerts']['Insert'];

export interface TaskFilters {
  status?: Task['status'];
  priority?: Task['priority'];
  assignedTo?: string;
  relatedAccount?: string;
  dueDateBefore?: string;
  dueDateAfter?: string;
}

export async function getTasks(organizationId: string, filters?: TaskFilters): Promise<Task[]> {
  let query = supabase
    .from('tasks')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.priority) {
    query = query.eq('priority', filters.priority);
  }

  if (filters?.assignedTo) {
    query = query.eq('assigned_to', filters.assignedTo);
  }

  if (filters?.relatedAccount) {
    query = query.eq('related_account', filters.relatedAccount);
  }

  if (filters?.dueDateBefore) {
    query = query.lte('due_date', filters.dueDateBefore);
  }

  if (filters?.dueDateAfter) {
    query = query.gte('due_date', filters.dueDateAfter);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[TaskService] Error fetching tasks:', error);
    throw error;
  }

  return data || [];
}

export async function getTaskById(taskId: string): Promise<Task | null> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .maybeSingle();

  if (error) {
    console.error('[TaskService] Error fetching task:', error);
    throw error;
  }

  return data;
}

export async function createTask(task: TaskInsert): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert(task)
    .select()
    .single();

  if (error) {
    console.error('[TaskService] Error creating task:', error);
    throw error;
  }

  return data;
}

export async function updateTask(taskId: string, updates: TaskUpdate): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', taskId)
    .select()
    .single();

  if (error) {
    console.error('[TaskService] Error updating task:', error);
    throw error;
  }

  return data;
}

export async function deleteTask(taskId: string): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId);

  if (error) {
    console.error('[TaskService] Error deleting task:', error);
    throw error;
  }
}

export async function completeTask(taskId: string): Promise<Task> {
  return updateTask(taskId, {
    status: 'completed',
    completed_at: new Date().toISOString(),
  });
}

export async function getTasksByInsight(organizationId: string, insightId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('insight_id', insightId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[TaskService] Error fetching tasks by insight:', error);
    throw error;
  }

  return data || [];
}

export async function getTaskStats(organizationId: string): Promise<{
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
  highPriority: number;
}> {
  const { data, error } = await supabase
    .from('tasks')
    .select('status, priority, due_date')
    .eq('organization_id', organizationId);

  if (error) {
    console.error('[TaskService] Error fetching task stats:', error);
    throw error;
  }

  const tasks = data || [];
  const now = new Date().toISOString();

  return {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    overdue: tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled' && t.due_date && t.due_date < now).length,
    highPriority: tasks.filter(t => (t.priority === 'high' || t.priority === 'urgent') && t.status !== 'completed' && t.status !== 'cancelled').length,
  };
}

export async function createAlert(alert: AlertInsert): Promise<Alert> {
  const { data, error } = await supabase
    .from('alerts')
    .insert(alert)
    .select()
    .single();

  if (error) {
    console.error('[TaskService] Error creating alert:', error);
    throw error;
  }

  return data;
}

export async function getAlerts(organizationId: string, unacknowledgedOnly = false): Promise<Alert[]> {
  let query = supabase
    .from('alerts')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  if (unacknowledgedOnly) {
    query = query.eq('acknowledged', false);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[TaskService] Error fetching alerts:', error);
    throw error;
  }

  return data || [];
}

export async function acknowledgeAlert(alertId: string): Promise<Alert> {
  const { data, error } = await supabase
    .from('alerts')
    .update({
      acknowledged: true,
      acknowledged_at: new Date().toISOString(),
    })
    .eq('id', alertId)
    .select()
    .single();

  if (error) {
    console.error('[TaskService] Error acknowledging alert:', error);
    throw error;
  }

  return data;
}

export async function getRepresentativeFromAccount(
  organizationId: string,
  accountName: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('sales_data')
    .select('representative')
    .eq('organization_id', organizationId)
    .eq('account_name', accountName)
    .not('representative', 'is', null)
    .order('order_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[TaskService] Error fetching representative:', error);
    return null;
  }

  return data?.representative || null;
}

export async function getOrganizationMembers(organizationId: string): Promise<Array<{ user_id: string; email: string }>> {
  const { data: members, error: membersError } = await supabase
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', organizationId);

  if (membersError || !members) {
    console.error('[TaskService] Error fetching organization members:', membersError);
    return [];
  }

  const userIds = members.map(m => m.user_id);

  if (userIds.length === 0) return [];

  const { data: users, error: usersError } = await supabase
    .rpc('get_user_emails', { user_ids: userIds });

  if (usersError) {
    console.error('[TaskService] Error fetching user details:', usersError);
    return [];
  }

  return users || [];
}
