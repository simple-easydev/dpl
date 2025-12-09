# Supabase Auth Email Templates

This document contains custom branded email templates for Supabase Auth. These templates create a professional, on-brand experience when inviting team members to your organization.

## Quick Setup (5 minutes)

1. **Log into Supabase Dashboard**: [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. **Select your project**: `bexwcnmwpleoqvvmcwrg`
3. **Navigate to**: Authentication → Email Templates
4. **Select**: "Invite user" from dropdown
5. **Copy & paste**: The HTML template below (lines 11-134)
6. **Update subject**: `🎉 You're invited to join your team on DPL`
7. **Save**: Click Save button at bottom
8. **Test**: Send yourself a test invitation from Settings → Team

That's it! All future invitations will use your branded template.

## Team Member Invitation Template

Go to: **Supabase Dashboard → Authentication → Email Templates → Invite user**

Replace the default template with this custom HTML:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Team Invitation - DPL</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 60px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1e293b; border-radius: 24px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5); overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.1);">

          <!-- Header with gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 48px 40px; text-align: center; position: relative;">
              <div style="background: radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(16, 185, 129, 0.3) 0%, transparent 50%); position: absolute; top: 0; left: 0; right: 0; bottom: 0;"></div>
              <h1 style="margin: 0; color: #ffffff; font-size: 36px; font-weight: 700; letter-spacing: -0.5px; position: relative;">
                You're Invited! 🎉
              </h1>
              <p style="margin: 16px 0 0 0; color: #dbeafe; font-size: 18px; position: relative;">
                Join your team on DPL
              </p>
            </td>
          </tr>

          <!-- Main content -->
          <tr>
            <td style="padding: 48px 40px;">

              <!-- Greeting -->
              <h2 style="margin: 0 0 20px 0; color: #f1f5f9; font-size: 26px; font-weight: 600;">
                Welcome to the Team!
              </h2>

              <p style="margin: 0 0 28px 0; color: #cbd5e1; font-size: 16px; line-height: 1.7;">
                You've been invited to join a team on <strong style="color: #f1f5f9; background: linear-gradient(135deg, #3b82f6, #10b981); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">DPL</strong>, the premium sales analytics platform.
              </p>

              <!-- Features Box -->
              <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); padding: 28px; border-radius: 16px; margin-bottom: 36px;">
                <h3 style="margin: 0 0 20px 0; color: #f1f5f9; font-size: 18px; font-weight: 600;">
                  What you'll get access to:
                </h3>
                <table cellpadding="0" cellspacing="0" style="width: 100%;">
                  <tr>
                    <td style="padding: 10px 0;">
                      <span style="display: inline-block; width: 24px; height: 24px; background: linear-gradient(135deg, #3b82f6, #2563eb); border-radius: 50%; text-align: center; line-height: 24px; color: #ffffff; font-weight: 700; font-size: 14px; margin-right: 12px;">✓</span>
                      <span style="color: #e2e8f0; font-size: 15px; font-weight: 500;">Real-time sales analytics & insights</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0;">
                      <span style="display: inline-block; width: 24px; height: 24px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50%; text-align: center; line-height: 24px; color: #ffffff; font-weight: 700; font-size: 14px; margin-right: 12px;">✓</span>
                      <span style="color: #e2e8f0; font-size: 15px; font-weight: 500;">AI-powered product intelligence</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0;">
                      <span style="display: inline-block; width: 24px; height: 24px; background: linear-gradient(135deg, #8b5cf6, #7c3aed); border-radius: 50%; text-align: center; line-height: 24px; color: #ffffff; font-weight: 700; font-size: 14px; margin-right: 12px;">✓</span>
                      <span style="color: #e2e8f0; font-size: 15px; font-weight: 500;">Seamless team collaboration</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0;">
                      <span style="display: inline-block; width: 24px; height: 24px; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 50%; text-align: center; line-height: 24px; color: #ffffff; font-weight: 700; font-size: 14px; margin-right: 12px;">✓</span>
                      <span style="color: #e2e8f0; font-size: 15px; font-weight: 500;">Custom reports & visualizations</span>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 36px;">
                <tr>
                  <td align="center">
                    <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; padding: 18px 56px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 17px; box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4); border: 1px solid rgba(255, 255, 255, 0.1);">
                      Accept Invitation →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Important Notice -->
              <div style="background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 12px; padding: 20px; margin-bottom: 28px;">
                <p style="margin: 0; color: #fcd34d; font-size: 14px; line-height: 1.6;">
                  <strong style="display: block; margin-bottom: 6px;">⏰ This invitation expires in 7 days</strong>
                  Click the button above to accept and join your team. If you didn't expect this invitation, you can safely ignore this email.
                </p>
              </div>

              <!-- Backup link -->
              <p style="margin: 0 0 10px 0; color: #94a3b8; font-size: 13px;">
                Or copy and paste this link into your browser:
              </p>
              <div style="background-color: #0f172a; padding: 14px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1); word-break: break-all;">
                <a href="{{ .ConfirmationURL }}" style="color: #60a5fa; font-size: 12px; text-decoration: none;">
                  {{ .ConfirmationURL }}
                </a>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0f172a; padding: 28px 40px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
              <p style="margin: 0 0 10px 0; color: #94a3b8; font-size: 13px; text-align: center;">
                Need help? Contact us at <a href="mailto:support@deplete.app" style="color: #60a5fa; text-decoration: none;">support@deplete.app</a>
              </p>
              <p style="margin: 0; color: #64748b; font-size: 12px; text-align: center;">
                © 2025 DPL. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

## Template Variables

Supabase Auth provides these template variables you can use:

- `{{ .ConfirmationURL }}` - The invitation acceptance link (required)
- `{{ .Token }}` - The invitation token
- `{{ .TokenHash }}` - The hashed token
- `{{ .SiteURL }}` - Your site URL
- `{{ .Email }}` - The recipient's email address

## Subject Line

For the "Invite user" template, use this subject line:

```
🎉 You're invited to join your team on DPL
```

## Step-by-Step Configuration Guide

### 1. Access Supabase Dashboard

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Log in with your credentials
3. Select your project: **bexwcnmwpleoqvvmcwrg**

### 2. Navigate to Email Templates

1. In the left sidebar, click **Authentication**
2. Click on **Email Templates** in the sub-menu
3. You'll see a dropdown menu at the top

### 3. Select Invite User Template

1. From the template dropdown, select **Invite user**
2. You'll see the current default template
3. This is what gets sent when you invite team members from Settings → Team

### 4. Replace with Branded Template

1. **Select all** the existing HTML in the template editor (Ctrl+A or Cmd+A)
2. **Delete** the default template
3. **Copy** the entire HTML template from above (lines 11-134)
4. **Paste** into the template editor

### 5. Update Subject Line

1. Find the **Subject** field at the top of the template editor
2. Replace the current subject with: `🎉 You're invited to join your team on DPL`
3. The emoji adds a friendly, welcoming touch

### 6. Verify Redirect URLs

1. Navigate to **Authentication** → **URL Configuration**
2. Ensure these URLs are in the **Redirect URLs** list:
   ```
   http://localhost:5173/accept-invite
   http://localhost:5173/**
   https://your-production-domain.com/accept-invite
   https://your-production-domain.com/**
   ```
3. Add any missing URLs
4. Click **Save**

### 7. Save the Template

1. Scroll to the bottom of the Email Templates page
2. Click the **Save** button
3. Wait for the success confirmation
4. Your new branded template is now active!

## Testing the Template

### Quick Test Process

1. **Log in as an Organization Admin**
   - Navigate to your application
   - Log in with admin credentials

2. **Go to Team Settings**
   - Click on **Settings** in the navigation
   - Select the **Team** tab
   - You'll see the "Invite Team Member" form

3. **Send a Test Invitation**
   - Enter your own email address (or a test email)
   - Select a role: **Member** or **Viewer**
   - Click **Invite**
   - Wait for success message

4. **Check Your Email**
   - Open your email inbox (check spam folder too)
   - You should receive an email with subject: "🎉 You're invited to join your team on DPL"
   - The email should have:
     - Dark themed background with gradient
     - Blue gradient header with celebration emoji
     - Four feature bullets with colored gradient icons
     - Blue "Accept Invitation →" button
     - Yellow warning box about expiration
     - Fallback link at the bottom
     - Professional footer with support email

5. **Test the Invitation Link**
   - Click the "Accept Invitation" button
   - You should be redirected to your application's accept-invite page
   - The URL should be: `https://your-domain.com/accept-invite?token=...`
   - If already logged in, you may be automatically added to the team

### Expected Results

✅ **Email arrives within 1-2 minutes**
✅ **Styling renders correctly in your email client**
✅ **Colors match your app's dark theme**
✅ **Button is clickable and prominent**
✅ **Link redirects to correct accept-invite page**
✅ **No broken images or styling issues**

### Troubleshooting Test Issues

**Email not received?**
- Check spam/junk folder
- Verify email service is configured in Supabase Dashboard
- Check Supabase Logs → Authentication for errors
- Wait 5 minutes (emails can be delayed)

**Styling looks broken?**
- Some email clients strip CSS - this is normal
- Test in Gmail, Outlook, and Apple Mail
- The template uses inline styles for maximum compatibility

**Link doesn't work?**
- Verify redirect URLs are configured correctly
- Check that accept-invite page exists in your app
- Ensure the token parameter is being captured

**Already a member error?**
- This is expected if you're testing with your own email
- The invitation system prevents duplicate memberships
- Test with a different email address that's not in the organization

## Customization Tips

- Change colors by replacing hex codes (e.g., `#10b981` for green)
- Update the "Get started with" features list to match your offering
- Add your logo URL in the header section
- Modify the support email address
- Adjust padding and spacing as needed

## SMTP Configuration (Optional)

To send emails through Resend instead of Supabase's default provider:

1. In Supabase Dashboard, go to **Authentication** → **Email Templates**
2. Scroll to **SMTP Settings** at the bottom
3. Configure:
   - Host: `smtp.resend.com`
   - Port: `465` (SSL) or `587` (TLS)
   - Username: `resend`
   - Password: Your Resend API key (starts with `re_`)
   - Sender email: Your verified email (e.g., `noreply@yourdomain.com`)
4. Click **Save**

## Troubleshooting

### Template Variables Not Rendering

Make sure you're using the correct syntax:
- ✅ Correct: `{{ .ConfirmationURL }}`
- ❌ Wrong: `{{.ConfirmationURL}}` (no spaces)
- ❌ Wrong: `${ConfirmationURL}` (wrong syntax)

### Emails Not Sending

1. Check your Supabase project settings
2. Verify SMTP configuration if using custom provider
3. Check the Supabase logs for errors
4. Ensure your domain is verified in Resend

### Styling Issues

- Use inline CSS only (no `<style>` tags)
- Test in multiple email clients (Gmail, Outlook, etc.)
- Use tables for layout structure
- Keep design simple and responsive

## Additional Resources

- [Supabase Auth Email Templates Documentation](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Resend Documentation](https://resend.com/docs)
- [Email HTML Best Practices](https://www.campaignmonitor.com/dev-resources/guides/coding/)
