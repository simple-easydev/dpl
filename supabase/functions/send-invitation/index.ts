import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface InviteRequest {
  organizationId: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
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

    const { organizationId, email, role }: InviteRequest = await req.json();

    if (!organizationId || !email || !role) {
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
        JSON.stringify({ error: 'Only admins can send invitations' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: existingInvite } = await supabase
      .from('invitations')
      .select('id, status')
      .eq('organization_id', organizationId)
      .eq('email', email)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingInvite) {
      return new Response(
        JSON.stringify({ error: 'An invitation has already been sent to this email' }),
        {
          status: 400,
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

    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: redirectUrl,
        data: {
          organization_id: organizationId,
          organization_name: orgData?.name || 'Unknown Organization',
          role: role,
          invited_by: user.id,
        },
      }
    );

    if (inviteError) {
      console.error('Error sending invitation:', inviteError);
      return new Response(
        JSON.stringify({ error: `Failed to send invitation: ${inviteError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: invitation, error: dbError } = await supabase
      .from('invitations')
      .insert({
        organization_id: organizationId,
        email,
        role,
        invited_by: user.id,
        email_sent: true,
        email_sent_at: new Date().toISOString(),
        supabase_user_id: inviteData?.user?.id || null,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Error creating invitation record:', dbError);
      return new Response(
        JSON.stringify({ error: `Failed to create invitation record: ${dbError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    await supabase
      .from('audit_logs')
      .insert({
        organization_id: organizationId,
        user_id: user.id,
        action: 'invite_user',
        resource_type: 'invitation',
        resource_id: invitation.id,
        metadata: { email, role, email_sent: true },
      });

    return new Response(
      JSON.stringify({ data: invitation }),
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
