export function generateTeamInvitationEmail(params: {
  organizationName: string;
  inviterName: string;
  role: string;
  inviteLink: string;
  expirationDate: string;
}): string {
  const { organizationName, inviterName, role, inviteLink, expirationDate } = params;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Team Invitation</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); overflow: hidden;">

          <!-- Header with gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 40px 50px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                You're Invited!
              </h1>
              <p style="margin: 12px 0 0 0; color: #d1fae5; font-size: 16px;">
                Join ${organizationName} on DPL
              </p>
            </td>
          </tr>

          <!-- Main content -->
          <tr>
            <td style="padding: 40px;">

              <!-- Greeting -->
              <h2 style="margin: 0 0 16px 0; color: #1f2937; font-size: 24px; font-weight: 600;">
                Welcome to the Team!
              </h2>

              <p style="margin: 0 0 24px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                <strong style="color: #1f2937;">${inviterName}</strong> has invited you to join <strong style="color: #1f2937;">${organizationName}</strong> on DPL as a <strong style="color: #059669;">${role}</strong>.
              </p>

              <!-- Role info -->
              <div style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); padding: 20px; border-radius: 12px; margin-bottom: 24px; border-left: 4px solid #10b981;">
                <p style="margin: 0 0 8px 0; color: #065f46; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                  Your Role
                </p>
                <p style="margin: 0; color: #047857; font-size: 18px; font-weight: 600; text-transform: capitalize;">
                  ${role}
                </p>
              </div>

              <!-- What you can do -->
              <div style="background-color: #f9fafb; padding: 24px; border-radius: 12px; margin-bottom: 32px;">
                <h3 style="margin: 0 0 16px 0; color: #1f2937; font-size: 18px; font-weight: 600;">
                  What you can do:
                </h3>
                <table cellpadding="0" cellspacing="0" style="width: 100%;">
                  ${getRolePermissions(role)}
                </table>
              </div>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
                <tr>
                  <td align="center">
                    <a href="${inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; padding: 16px 48px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); transition: all 0.3s;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Important info -->
              <div style="background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.5;">
                  <strong>⏰ Important:</strong> This invitation will expire on ${expirationDate}. Please accept it before then to join the team.
                </p>
              </div>

              <!-- Backup link -->
              <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 13px;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <div style="background-color: #f3f4f6; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb; word-break: break-all;">
                <a href="${inviteLink}" style="color: #10b981; font-size: 12px; text-decoration: none;">
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
                This invitation was sent to you by ${organizationName}. If you weren't expecting this, you can safely ignore this email.
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

function getRolePermissions(role: string): string {
  const permissions = {
    admin: [
      'Full access to all features',
      'Invite and manage team members',
      'Upload and manage sales data',
      'Configure organization settings',
      'View and export all reports',
    ],
    member: [
      'Upload and manage sales data',
      'View all reports and analytics',
      'Create and manage accounts',
      'Export data and reports',
      'Collaborate with team members',
    ],
    viewer: [
      'View reports and analytics',
      'Access dashboards',
      'View sales data',
      'Export reports',
      'Read-only access',
    ],
  };

  const rolePermissions = permissions[role as keyof typeof permissions] || permissions.member;

  return rolePermissions
    .map(
      (permission) => `
                  <tr>
                    <td style="padding: 8px 0;">
                      <span style="color: #10b981; font-size: 18px; margin-right: 12px;">✓</span>
                      <span style="color: #4b5563; font-size: 15px;">${permission}</span>
                    </td>
                  </tr>
  `
    )
    .join('');
}
