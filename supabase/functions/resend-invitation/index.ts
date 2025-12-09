import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ResendRequest {
  invitationId: string;
  organizationId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { invitationId, organizationId }: ResendRequest = await req.json();

    if (!invitationId || !organizationId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership || membership.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Only admins can resend invitations' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: invitation } = await supabase
      .from('invitations')
      .select('email, role')
      .eq('id', invitationId)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (!invitation) {
      return new Response(
        JSON.stringify({ error: 'Invitation not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: orgData } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .maybeSingle();

    const redirectUrl = req.headers.get('origin') + '/accept-invite';
    const newExpiryDate = new Date();
    newExpiryDate.setDate(newExpiryDate.getDate() + 7);

    const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
      invitation.email,
      {
        redirectTo: redirectUrl,
        data: {
          organization_id: organizationId,
          organization_name: orgData?.name || 'Unknown Organization',
          role: invitation.role,
          invited_by: user.id,
        },
      }
    );

    if (inviteError) {
      console.error('Error resending invitation:', inviteError);
      return new Response(
        JSON.stringify({ error: `Failed to resend invitation: ${inviteError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: updatedInvitation, error: updateError } = await supabase
      .from('invitations')
      .update({
        expires_at: newExpiryDate.toISOString(),
        status: 'pending',
        email_sent: true,
        email_sent_at: new Date().toISOString(),
      })
      .eq('id', invitationId)
      .eq('organization_id', organizationId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating invitation record:', updateError);
      return new Response(
        JSON.stringify({ error: `Failed to update invitation: ${updateError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ data: updatedInvitation }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
