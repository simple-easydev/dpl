import { supabase } from './supabase';
import { logAuditEvent } from './auditLog';

interface CreateInvitationParams {
  organizationId: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
}

export async function createInvitation({
  organizationId,
  email,
  role,
}: CreateInvitationParams) {
  const currentUser = await supabase.auth.getUser();
  if (!currentUser.data.user) {
    return {
      error: { message: 'User not authenticated' },
      data: null,
    };
  }

  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    return {
      error: { message: 'No active session' },
      data: null,
    };
  }

  try {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invitation`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.data.session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organizationId,
        email,
        role,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        error: { message: result.error || 'Failed to send invitation' },
        data: null,
      };
    }

    return { data: result.data, error: null };
  } catch (err: any) {
    return {
      error: { message: `Failed to send invitation: ${err.message}` },
      data: null,
    };
  }
}

export async function getInvitationByToken(token: string) {
  const { data, error } = await supabase
    .from('invitations')
    .select(`
      *,
      organizations (
        id,
        name
      )
    `)
    .eq('token', token)
    .eq('status', 'pending')
    .maybeSingle();

  if (error || !data) {
    return { data: null, error: error || { message: 'Invitation not found' } };
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    await supabase
      .from('invitations')
      .update({ status: 'expired' })
      .eq('id', data.id);

    return { data: null, error: { message: 'Invitation has expired' } };
  }

  return { data, error: null };
}

export async function acceptInvitation(token: string, userId: string) {
  const { data: invitation, error: inviteError } = await getInvitationByToken(token);

  if (inviteError || !invitation) {
    return { error: inviteError || { message: 'Invalid invitation' } };
  }

  const { data: existingMember } = await supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', invitation.organization_id)
    .eq('user_id', userId)
    .maybeSingle();

  if (existingMember) {
    await supabase
      .from('invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', invitation.id);

    return { error: { message: 'You are already a member of this organization' } };
  }

  const { error: memberError } = await supabase
    .from('organization_members')
    .insert({
      organization_id: invitation.organization_id,
      user_id: userId,
      role: invitation.role,
      invited_by: invitation.invited_by,
    });

  if (memberError) {
    return { error: memberError };
  }

  const { error: updateError } = await supabase
    .from('invitations')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', invitation.id);

  if (updateError) {
    console.error('Failed to update invitation status:', updateError);
  }

  await logAuditEvent({
    organizationId: invitation.organization_id,
    action: 'accept_invitation',
    resourceType: 'invitation',
    resourceId: invitation.id,
    metadata: { email: invitation.email, role: invitation.role },
  });

  return { error: null };
}

export async function revokeInvitation(invitationId: string, organizationId: string) {
  const { error } = await supabase
    .from('invitations')
    .update({ status: 'revoked' })
    .eq('id', invitationId)
    .eq('organization_id', organizationId);

  if (!error) {
    await logAuditEvent({
      organizationId,
      action: 'revoke_invitation',
      resourceType: 'invitation',
      resourceId: invitationId,
    });
  }

  return { error };
}

export async function resendInvitation(invitationId: string, organizationId: string) {
  const currentUser = await supabase.auth.getUser();
  if (!currentUser.data.user) {
    return {
      error: { message: 'User not authenticated' },
      data: null,
    };
  }

  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    return {
      error: { message: 'No active session' },
      data: null,
    };
  }

  try {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resend-invitation`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.data.session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        invitationId,
        organizationId,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        error: { message: result.error || 'Failed to resend invitation' },
        data: null,
      };
    }

    return { data: result.data, error: null };
  } catch (err: any) {
    return {
      error: { message: `Failed to resend invitation: ${err.message}` },
      data: null,
    };
  }
}

export async function getOrganizationInvitations(organizationId: string) {
  const { data, error } = await supabase
    .from('invitations')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  return { data: data || [], error };
}
