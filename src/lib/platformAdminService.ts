import { supabase } from './supabase';
import { logAuditEvent } from './auditLog';

export interface BrandInvitation {
  id: string;
  email: string;
  company_name: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  invited_by: string;
  organization_id: string | null;
  welcome_message: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationWithStats {
  id: string;
  name: string;
  created_at: string;
  member_count: number;
  total_revenue: number;
  upload_count: number;
  last_upload_date: string | null;
  created_by_platform_admin: boolean;
  platform_admin_notes: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
}

export async function checkIsPlatformAdmin(): Promise<boolean> {
  console.log('[platformAdminService] Checking platform admin status...');
  const { data, error } = await supabase.rpc('is_platform_admin');
  console.log('[platformAdminService] is_platform_admin RPC result:', { data, error });
  if (error) {
    console.error('[platformAdminService] Error checking platform admin status:', error);
    return false;
  }
  console.log('[platformAdminService] Platform admin check result:', data === true);
  return data === true;
}

export async function getAllOrganizations(includeDeleted = false): Promise<OrganizationWithStats[]> {
  console.log('[platformAdminService] getAllOrganizations called, includeDeleted:', includeDeleted);

  const isPlatformAdmin = await checkIsPlatformAdmin();
  console.log('[platformAdminService] isPlatformAdmin result:', isPlatformAdmin);

  if (!isPlatformAdmin) {
    console.error('[platformAdminService] User is not platform admin, throwing error');
    throw new Error('Unauthorized: Platform admin access required');
  }

  console.log('[platformAdminService] Building organizations query...');
  let query = supabase
    .from('organizations')
    .select('id, name, created_at, created_by_platform_admin, platform_admin_notes, deleted_at, deleted_by');

  if (!includeDeleted) {
    console.log('[platformAdminService] Filtering for non-deleted organizations only');
    query = query.is('deleted_at', null);
  }

  console.log('[platformAdminService] Executing organizations query...');
  const { data: orgs, error: orgsError } = await query.order('name');

  console.log('[platformAdminService] Query result:', { orgsCount: orgs?.length, error: orgsError });

  if (orgsError) {
    console.error('[platformAdminService] Error fetching organizations:', orgsError);
    console.error('[platformAdminService] Error details:', JSON.stringify(orgsError, null, 2));
    return [];
  }

  console.log('[platformAdminService] Organizations fetched:', orgs?.map(o => ({ id: o.id, name: o.name })));

  const orgsWithStats = await Promise.all(
    orgs.map(async (org) => {
      const [memberCountData, revenueData, uploadData] = await Promise.all([
        supabase
          .from('organization_members')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', org.id),
        supabase
          .from('sales_data')
          .select('revenue')
          .eq('organization_id', org.id),
        supabase
          .from('uploads')
          .select('created_at')
          .eq('organization_id', org.id)
          .order('created_at', { ascending: false })
          .limit(1),
      ]);

      const totalRevenue = revenueData.data?.reduce(
        (sum, row) => sum + (row.revenue || 0),
        0
      ) || 0;

      return {
        id: org.id,
        name: org.name,
        created_at: org.created_at,
        member_count: memberCountData.count || 0,
        total_revenue: totalRevenue,
        upload_count: uploadData.data?.length || 0,
        last_upload_date: uploadData.data?.[0]?.created_at || null,
        created_by_platform_admin: org.created_by_platform_admin || false,
        platform_admin_notes: org.platform_admin_notes,
        deleted_at: org.deleted_at,
        deleted_by: org.deleted_by,
      };
    })
  );

  return orgsWithStats;
}

export async function createBrandWithAdmin(params: {
  brandName: string;
  adminEmail: string;
  adminPassword: string;
}): Promise<{ data: { organizationId: string; userId: string } | null; error: any }> {
  const isPlatformAdmin = await checkIsPlatformAdmin();
  if (!isPlatformAdmin) {
    return {
      data: null,
      error: { message: 'Unauthorized: Platform admin access required' },
    };
  }

  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: params.adminEmail,
      password: params.adminPassword,
      options: {
        data: {
          created_by_platform_admin: true,
        },
      },
    });

    if (authError) {
      if (authError.message?.includes('already registered')) {
        return {
          data: null,
          error: { message: 'A user with this email already exists' },
        };
      }
      return { data: null, error: authError };
    }

    if (!authData.user) {
      return { data: null, error: { message: 'Failed to create user' } };
    }

    const { data: orgId, error: orgError } = await supabase.rpc(
      'create_organization_with_admin',
      {
        org_name: params.brandName,
        admin_user_id: authData.user.id,
      }
    );

    if (orgError) {
      return { data: null, error: orgError };
    }

    await logAuditEvent({
      organizationId: orgId,
      action: 'create_brand_with_admin',
      resourceType: 'organization',
      resourceId: orgId,
      metadata: {
        brand_name: params.brandName,
        admin_email: params.adminEmail,
        admin_user_id: authData.user.id,
      },
    });

    return {
      data: {
        organizationId: orgId,
        userId: authData.user.id,
      },
      error: null,
    };
  } catch (error) {
    console.error('Error creating brand with admin:', error);
    return { data: null, error };
  }
}

export async function softDeleteOrganization(
  organizationId: string,
  reason?: string
): Promise<{ error: any }> {
  const isPlatformAdmin = await checkIsPlatformAdmin();
  if (!isPlatformAdmin) {
    return { error: { message: 'Unauthorized: Platform admin access required' } };
  }

  const { data, error } = await supabase.rpc('soft_delete_organization', {
    org_id: organizationId,
    deletion_reason: reason || null,
  });

  if (error) {
    console.error('Error soft deleting organization:', error);
    return { error };
  }

  if (!data) {
    return { error: { message: 'Organization not found or already deleted' } };
  }

  return { error: null };
}

export async function restoreOrganization(organizationId: string): Promise<{ error: any }> {
  const isPlatformAdmin = await checkIsPlatformAdmin();
  if (!isPlatformAdmin) {
    return { error: { message: 'Unauthorized: Platform admin access required' } };
  }

  const { data, error } = await supabase.rpc('restore_organization', {
    org_id: organizationId,
  });

  if (error) {
    console.error('Error restoring organization:', error);
    return { error };
  }

  if (!data) {
    return { error: { message: 'Organization not found or not deleted' } };
  }

  return { error: null };
}

export async function getOrganizationDetails(organizationId: string) {
  const isPlatformAdmin = await checkIsPlatformAdmin();
  if (!isPlatformAdmin) {
    throw new Error('Unauthorized: Platform admin access required');
  }

  const { data: org, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', organizationId)
    .maybeSingle();

  if (error || !org) {
    throw new Error('Organization not found');
  }

  const [membersData, salesData, uploadsData, accountsData, productsData] = await Promise.all([
    supabase
      .from('organization_members')
      .select('id, user_id, role, joined_at')
      .eq('organization_id', organizationId),
    supabase
      .from('sales_data')
      .select('id, revenue, created_at')
      .eq('organization_id', organizationId),
    supabase
      .from('uploads')
      .select('id, filename, created_at, status')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('accounts')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId),
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId),
  ]);

  const totalRevenue = salesData.data?.reduce((sum, row) => sum + (row.revenue || 0), 0) || 0;

  return {
    organization: org,
    members: membersData.data || [],
    memberCount: membersData.data?.length || 0,
    totalRevenue,
    salesCount: salesData.data?.length || 0,
    recentUploads: uploadsData.data || [],
    uploadCount: uploadsData.data?.length || 0,
    accountCount: accountsData.count || 0,
    productCount: productsData.count || 0,
  };
}

export async function createBrandInvitation(params: {
  email: string;
  companyName: string;
  welcomeMessage?: string;
}): Promise<{ data: BrandInvitation | null; error: any }> {
  const isPlatformAdmin = await checkIsPlatformAdmin();
  if (!isPlatformAdmin) {
    return {
      data: null,
      error: { message: 'Unauthorized: Platform admin access required' },
    };
  }

  const currentUser = await supabase.auth.getUser();
  if (!currentUser.data.user) {
    return {
      data: null,
      error: { message: 'User not authenticated' },
    };
  }

  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    return {
      data: null,
      error: { message: 'No active session' },
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke('send-brand-invitation', {
      body: {
        email: params.email,
        companyName: params.companyName,
        welcomeMessage: params.welcomeMessage,
      },
      headers: {
        Authorization: `Bearer ${session.session.access_token}`,
      },
    });

    if (error) {
      console.error('Error invoking send-brand-invitation function:', error);
      return { data: null, error };
    }

    return { data: data?.data || null, error: null };
  } catch (err) {
    console.error('Unexpected error sending brand invitation:', err);
    return { data: null, error: err };
  }
}

export async function createBulkBrandInvitations(params: {
  invitations: Array<{ email: string; companyName: string }>;
  welcomeMessage?: string;
}): Promise<{ data: { successCount: number; failCount: number; results: any[] } | null; error: any }> {
  const isPlatformAdmin = await checkIsPlatformAdmin();
  if (!isPlatformAdmin) {
    return {
      data: null,
      error: { message: 'Unauthorized: Platform admin access required' },
    };
  }

  const currentUser = await supabase.auth.getUser();
  if (!currentUser.data.user) {
    return {
      data: null,
      error: { message: 'User not authenticated' },
    };
  }

  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    return {
      data: null,
      error: { message: 'No active session' },
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke('send-brand-invitation', {
      body: {
        bulk: true,
        invitations: params.invitations,
        welcomeMessage: params.welcomeMessage,
      },
      headers: {
        Authorization: `Bearer ${session.session.access_token}`,
      },
    });

    if (error) {
      console.error('Error invoking send-brand-invitation function:', error);
      return { data: null, error };
    }

    return { data: data || null, error: null };
  } catch (err) {
    console.error('Unexpected error sending bulk brand invitations:', err);
    return { data: null, error: err };
  }
}

export async function getBrandInvitations(): Promise<BrandInvitation[]> {
  const isPlatformAdmin = await checkIsPlatformAdmin();
  if (!isPlatformAdmin) {
    return [];
  }

  const { data, error } = await supabase
    .from('brand_invitations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching brand invitations:', error);
    return [];
  }

  return data || [];
}

export async function revokeBrandInvitation(invitationId: string): Promise<{ error: any }> {
  const isPlatformAdmin = await checkIsPlatformAdmin();
  if (!isPlatformAdmin) {
    return { error: { message: 'Unauthorized: Platform admin access required' } };
  }

  const { error } = await supabase
    .from('brand_invitations')
    .update({ status: 'revoked', updated_at: new Date().toISOString() })
    .eq('id', invitationId);

  if (!error) {
    await logAuditEvent({
      organizationId: 'platform',
      action: 'revoke_brand_invitation',
      resourceType: 'brand_invitation',
      resourceId: invitationId,
    });
  }

  return { error };
}

export async function updateOrganizationNotes(
  organizationId: string,
  notes: string
): Promise<{ error: any }> {
  const isPlatformAdmin = await checkIsPlatformAdmin();
  if (!isPlatformAdmin) {
    return { error: { message: 'Unauthorized: Platform admin access required' } };
  }

  const { error } = await supabase
    .from('organizations')
    .update({ platform_admin_notes: notes })
    .eq('id', organizationId);

  if (!error) {
    await logAuditEvent({
      organizationId,
      action: 'update_organization_notes',
      resourceType: 'organization',
      resourceId: organizationId,
    });
  }

  return { error };
}

export async function getPlatformStats() {
  const isPlatformAdmin = await checkIsPlatformAdmin();
  if (!isPlatformAdmin) {
    throw new Error('Unauthorized: Platform admin access required');
  }

  const [orgsData, usersData, salesData, uploadsData] = await Promise.all([
    supabase.from('organizations').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('organization_members').select('user_id', { count: 'exact', head: true }),
    supabase.from('sales_data').select('revenue'),
    supabase
      .from('uploads')
      .select('created_at')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  const totalRevenue = salesData.data?.reduce((sum, row) => sum + (row.revenue || 0), 0) || 0;

  return {
    totalOrganizations: orgsData.count || 0,
    totalUsers: usersData.count || 0,
    totalRevenue,
    recentUploads: uploadsData.data?.length || 0,
  };
}
