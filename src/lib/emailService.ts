export interface EmailTemplate {
  to: string;
  subject: string;
  html: string;
}

export function getInvitationEmailTemplate(
  organizationName: string,
  inviterName: string,
  acceptUrl: string,
  expiresAt: Date
): EmailTemplate {
  const expiryDate = expiresAt.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return {
    to: '',
    subject: `You've been invited to join ${organizationName}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <title>Team Invitation</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 48px 40px; text-align: center;">
              <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center;">
                <span style="color: white; font-size: 32px;">✨</span>
              </div>
              <h1 style="margin: 0 0 16px; font-size: 28px; font-weight: 700; color: #1e293b;">You're Invited!</h1>
              <p style="margin: 0 0 32px; font-size: 16px; color: #64748b; line-height: 1.6;">
                ${inviterName || 'Someone'} has invited you to join <strong style="color: #1e293b;">${organizationName}</strong> on DPL, a powerful sales analytics platform.
              </p>
              <a href="${acceptUrl}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.25);">
                Accept Invitation
              </a>
              <p style="margin: 32px 0 0; font-size: 14px; color: #94a3b8;">
                This invitation expires on ${expiryDate}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                If you didn't expect this invitation, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  };
}

export function getTrialExpiringEmailTemplate(
  organizationName: string,
  daysLeft: number,
  upgradeUrl: string
): EmailTemplate {
  const urgency = daysLeft <= 1 ? 'urgent' : daysLeft <= 3 ? 'warning' : 'info';
  const color = urgency === 'urgent' ? '#dc2626' : urgency === 'warning' ? '#ea580c' : '#2563eb';

  return {
    to: '',
    subject: `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left in your trial`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <title>Trial Expiring Soon</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 48px 40px; text-align: center;">
              <div style="width: 64px; height: 64px; background-color: ${color}; border-radius: 16px; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center;">
                <span style="color: white; font-size: 32px;">⏰</span>
              </div>
              <h1 style="margin: 0 0 16px; font-size: 28px; font-weight: 700; color: #1e293b;">Your Trial is Ending Soon</h1>
              <p style="margin: 0 0 32px; font-size: 16px; color: #64748b; line-height: 1.6;">
                You have <strong style="color: ${color}; font-size: 20px;">${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}</strong> left in your free trial of <strong style="color: #1e293b;">${organizationName}</strong>.
              </p>
              <p style="margin: 0 0 32px; font-size: 16px; color: #64748b; line-height: 1.6;">
                Upgrade now to continue accessing your sales analytics and insights without interruption.
              </p>
              <a href="${upgradeUrl}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.25);">
                Upgrade to Pro - $500/month
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; border-top: 1px solid #e2e8f0;">
              <h3 style="margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #1e293b;">What You'll Keep:</h3>
              <ul style="margin: 0; padding-left: 24px; color: #64748b; line-height: 1.8;">
                <li>Unlimited sales data uploads</li>
                <li>AI-powered insights and analytics</li>
                <li>Advanced reporting and comparisons</li>
                <li>Team collaboration features</li>
                <li>Priority support</li>
              </ul>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  };
}

export function getPaymentFailedEmailTemplate(
  organizationName: string,
  updatePaymentUrl: string
): EmailTemplate {
  return {
    to: '',
    subject: `Payment failed for ${organizationName}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <title>Payment Failed</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 48px 40px; text-align: center;">
              <div style="width: 64px; height: 64px; background-color: #dc2626; border-radius: 16px; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center;">
                <span style="color: white; font-size: 32px;">⚠️</span>
              </div>
              <h1 style="margin: 0 0 16px; font-size: 28px; font-weight: 700; color: #1e293b;">Payment Failed</h1>
              <p style="margin: 0 0 32px; font-size: 16px; color: #64748b; line-height: 1.6;">
                We couldn't process your payment for <strong style="color: #1e293b;">${organizationName}</strong>. Please update your payment method to avoid service interruption.
              </p>
              <a href="${updatePaymentUrl}" style="display: inline-block; padding: 16px 32px; background-color: #dc2626; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(220, 38, 38, 0.25);">
                Update Payment Method
              </a>
              <p style="margin: 32px 0 0; font-size: 14px; color: #94a3b8;">
                You have 3 days to update your payment before your access is restricted.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                If you have questions, please contact our support team.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  };
}

export function getWelcomeEmailTemplate(
  organizationName: string,
  dashboardUrl: string
): EmailTemplate {
  return {
    to: '',
    subject: `Welcome to DPL!`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <title>Welcome to DPL</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 48px 40px; text-align: center;">
              <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center;">
                <span style="color: white; font-size: 32px;">🎉</span>
              </div>
              <h1 style="margin: 0 0 16px; font-size: 28px; font-weight: 700; color: #1e293b;">Welcome to DPL!</h1>
              <p style="margin: 0 0 32px; font-size: 16px; color: #64748b; line-height: 1.6;">
                Your organization <strong style="color: #1e293b;">${organizationName}</strong> is ready to go! You now have 14 days of free access to explore all features.
              </p>
              <a href="${dashboardUrl}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.25);">
                Go to Dashboard
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; border-top: 1px solid #e2e8f0;">
              <h3 style="margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #1e293b;">Get Started:</h3>
              <ul style="margin: 0; padding-left: 24px; color: #64748b; line-height: 1.8;">
                <li>Upload your first sales data file</li>
                <li>Explore AI-powered insights</li>
                <li>Set up your team members</li>
                <li>Create custom reports</li>
              </ul>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  };
}
