import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { Resend } from 'npm:resend@6.1.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface BrandInviteRequest {
  email?: string;
  companyName?: string;
  welcomeMessage?: string;
  bulk?: boolean;
  invitations?: Array<{ email: string; companyName: string }>;
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
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

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

    const { data: isPlatformAdminData } = await supabase.rpc('is_platform_admin');
    if (!isPlatformAdminData) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Platform admin access required' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { email, companyName, welcomeMessage, bulk, invitations }: BrandInviteRequest = await req.json();

    if (bulk && invitations) {
      if (!Array.isArray(invitations) || invitations.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Invalid invitations array' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const results = [];
      let successCount = 0;
      let failCount = 0;

      for (const invite of invitations) {
        try {
          const { data: existingInvite } = await supabase
            .from('brand_invitations')
            .select('id, status')
            .eq('email', invite.email)
            .eq('status', 'pending')
            .maybeSingle();

          if (existingInvite) {
            results.push({ email: invite.email, success: false, error: 'Already invited' });
            failCount++;
            continue;
          }

          const { data: invitation, error: inviteError } = await supabase
            .from('brand_invitations')
            .insert({
              email: invite.email,
              company_name: invite.companyName,
              invited_by: user.id,
              welcome_message: welcomeMessage || null,
              expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            })
            .select()
            .single();

          if (inviteError) {
            results.push({ email: invite.email, success: false, error: inviteError.message });
            failCount++;
            continue;
          }

          if (resendApiKey) {
            try {
              const resend = new Resend(resendApiKey);
              const origin = req.headers.get('origin') || supabaseUrl;
              const inviteLink = `${origin}/signup?token=${invitation.token}`;

              const emailHtml = generateEmailTemplate(invite.companyName, welcomeMessage, inviteLink);

              await resend.emails.send({
                from: 'DPL Platform <noreply@yourdomain.com>',
                to: invite.email,
                subject: `You're invited to join ${invite.companyName} on DPL`,
                html: emailHtml,
              });
            } catch (emailError) {
              console.error('Error sending email:', emailError);
            }
          }

          await supabase
            .from('audit_logs')
            .insert({
              organization_id: 'platform',
              user_id: user.id,
              action: 'create_brand_invitation',
              resource_type: 'brand_invitation',
              resource_id: invitation.id,
              metadata: { email: invite.email, company_name: invite.companyName },
            });

          results.push({ email: invite.email, success: true });
          successCount++;
        } catch (error) {
          results.push({ email: invite.email, success: false, error: error.message });
          failCount++;
        }
      }

      return new Response(
        JSON.stringify({ successCount, failCount, results }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!email || !companyName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: existingInvite } = await supabase
      .from('brand_invitations')
      .select('id, status')
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

    const { data: invitation, error: inviteError } = await supabase
      .from('brand_invitations')
      .insert({
        email,
        company_name: companyName,
        invited_by: user.id,
        welcome_message: welcomeMessage || null,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (inviteError) {
      console.error('Error creating invitation:', inviteError);
      return new Response(
        JSON.stringify({ error: `Failed to create invitation: ${inviteError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);
        const origin = req.headers.get('origin') || supabaseUrl;
        const inviteLink = `${origin}/signup?token=${invitation.token}`;

        const emailHtml = generateEmailTemplate(companyName, welcomeMessage, inviteLink);

        await resend.emails.send({
          from: 'DPL Platform <noreply@yourdomain.com>',
          to: email,
          subject: `You're invited to join ${companyName} on DPL`,
          html: emailHtml,
        });

        console.log('Brand invitation email sent successfully');
      } catch (emailError) {
        console.error('Error sending email:', emailError);
      }
    }

    await supabase
      .from('audit_logs')
      .insert({
        organization_id: 'platform',
        user_id: user.id,
        action: 'create_brand_invitation',
        resource_type: 'brand_invitation',
        resource_id: invitation.id,
        metadata: { email, company_name: companyName },
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

function generateEmailTemplate(companyName: string, welcomeMessage: string | undefined, inviteLink: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to DPL</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden;">

          <!-- Header with gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 40px 40px 50px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                Welcome to DPL
              </h1>
              <p style="margin: 12px 0 0 0; color: #dbeafe; font-size: 16px;">
                Sales Analytics Platform
              </p>
            </td>
          </tr>

          <!-- Main content -->
          <tr>
            <td style="padding: 40px;">

              <!-- Greeting -->
              <h2 style="margin: 0 0 16px 0; color: #1f2937; font-size: 24px; font-weight: 600;">
                You're Invited!
              </h2>

              <p style="margin: 0 0 24px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                You've been invited to join DPL as <strong style="color: #1f2937;">${companyName}</strong>. We're excited to have you on board!
              </p>

              ${welcomeMessage ? `
              <!-- Custom welcome message -->
              <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); padding: 20px; border-radius: 12px; margin-bottom: 24px; border-left: 4px solid #3b82f6;">
                <p style="margin: 0; color: #1e40af; font-size: 15px; line-height: 1.6; font-style: italic;">
                  "${welcomeMessage}"
                </p>
              </div>
              ` : ''}

              <!-- What's included -->
              <div style="background-color: #f9fafb; padding: 24px; border-radius: 12px; margin-bottom: 32px;">
                <h3 style="margin: 0 0 16px 0; color: #1f2937; font-size: 18px; font-weight: 600;">
                  What's included:
                </h3>
                <table cellpadding="0" cellspacing="0" style="width: 100%;">
                  <tr>
                    <td style="padding: 8px 0;">
                      <span style="color: #10b981; font-size: 18px; margin-right: 12px;">✓</span>
                      <span style="color: #4b5563; font-size: 15px;">Advanced sales analytics and insights</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <span style="color: #10b981; font-size: 18px; margin-right: 12px;">✓</span>
                      <span style="color: #4b5563; font-size: 15px;">AI-powered data processing</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <span style="color: #10b981; font-size: 18px; margin-right: 12px;">✓</span>
                      <span style="color: #4b5563; font-size: 15px;">Team collaboration tools</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <span style="color: #10b981; font-size: 18px; margin-right: 12px;">✓</span>
                      <span style="color: #4b5563; font-size: 15px;">Custom reporting and dashboards</span>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
                <tr>
                  <td align="center">
                    <a href="${inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; padding: 16px 48px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); transition: all 0.3s;">
                      Create Your Account
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Important info -->
              <div style="background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.5;">
                  <strong>⏰ Important:</strong> This invitation will expire in 7 days. Please accept it before then to set up your organization.
                </p>
              </div>

              <!-- Backup link -->
              <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 13px;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <div style="background-color: #f3f4f6; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb; word-break: break-all;">
                <a href="${inviteLink}" style="color: #3b82f6; font-size: 12px; text-decoration: none;">
                  ${inviteLink}
                </a>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 40px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 13px; text-align: center;">
                Need help? Contact us at support@deplete.app
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                This is an automated email from DPL. Please do not reply directly to this message.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}