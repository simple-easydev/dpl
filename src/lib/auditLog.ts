import { supabase } from './supabase';

export type AuditAction =
  | 'upload_file'
  | 'delete_data'
  | 'invite_user'
  | 'revoke_invitation'
  | 'accept_invitation'
  | 'remove_member'
  | 'update_role'
  | 'update_api_key'
  | 'delete_api_key'
  | 'update_organization'
  | 'create_task'
  | 'update_task'
  | 'delete_task'
  | 'export_data';

export type ResourceType =
  | 'upload'
  | 'sales_data'
  | 'invitation'
  | 'organization_member'
  | 'api_key'
  | 'organization'
  | 'task'
  | 'account'
  | 'product';

interface LogAuditEventParams {
  organizationId: string;
  action: AuditAction;
  resourceType: ResourceType;
  resourceId?: string;
  metadata?: Record<string, any>;
}

export async function logAuditEvent({
  organizationId,
  action,
  resourceType,
  resourceId,
  metadata = {},
}: LogAuditEventParams): Promise<void> {
  try {
    const { error } = await supabase.rpc('log_audit_event', {
      p_organization_id: organizationId,
      p_action: action,
      p_resource_type: resourceType,
      p_resource_id: resourceId || null,
      p_metadata: metadata,
    });

    if (error) {
      console.error('Failed to log audit event:', error);
    }
  } catch (err) {
    console.error('Error logging audit event:', err);
  }
}

export async function getAuditLogs(organizationId: string, limit = 50) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch audit logs:', error);
    return [];
  }

  return data || [];
}
