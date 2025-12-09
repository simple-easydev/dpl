# Custom Email Invitations with Resend

This guide explains how to configure custom email invitations for your DPL platform using Resend.

## Overview

DPL supports two types of invitations:
1. **Brand Invitations** - Super Admin invites new organizations to the platform
2. **Team Member Invitations** - Organization admins invite users to their team

Both use custom-styled HTML emails sent through Resend for a professional appearance.

## Setup Steps

### 1. Get Your Resend API Key

1. Sign up for a free account at [resend.com](https://resend.com)
2. Navigate to the API Keys section
3. Create a new API key
4. Copy the API key (starts with `re_`)

### 2. Configure Resend for Brand Invitations

Brand invitations already use Resend directly through the `send-brand-invitation` Edge Function.

The RESEND_API_KEY environment variable is automatically configured in your Supabase Edge Functions.

### 3. Configure Supabase Auth to Use Resend (for Team Invitations)

To use Resend for team member invitations sent through Supabase Auth:

#### Option A: Use Resend's SMTP (Recommended)

1. Go to your [Resend Dashboard](https://resend.com/domains)
2. Add and verify your domain
3. Get your SMTP credentials from the SMTP section
4. Go to your Supabase Dashboard → Authentication → Email Templates
5. Scroll to "SMTP Settings"
6. Configure:
   - Host: `smtp.resend.com`
   - Port: `465` (SSL) or `587` (TLS)
   - Username: `resend`
   - Password: Your Resend API key
   - Sender email: `noreply@yourdomain.com` (must be from your verified domain)

#### Option B: Continue Using Supabase's Email

If you prefer to keep using Supabase's default email provider, you can customize the invitation email template:

1. Go to Supabase Dashboard → Authentication → Email Templates
2. Select "Invite user" template
3. Customize the HTML template to match your branding
4. Use these template variables:
   - `{{ .ConfirmationURL }}` - The invitation acceptance link
   - `{{ .SiteURL }}` - Your site URL
   - `{{ .Token }}` - The invitation token

### 4. Verify Your Sending Domain in Resend

For production use, you must verify your sending domain:

1. Go to [Resend Domains](https://resend.com/domains)
2. Click "Add Domain"
3. Enter your domain (e.g., `yourdomain.com`)
4. Add the provided DNS records to your domain:
   - SPF record
   - DKIM records
   - Return-Path (optional but recommended)
5. Wait for verification (usually takes a few minutes)

### 5. Update the Sender Email

Once your domain is verified, update the sender email in:

**For Brand Invitations:**
- File: `supabase/functions/send-brand-invitation/index.ts`
- Line: `from: 'DPL Platform <noreply@yourdomain.com>'`
- Change to: `from: 'DPL Platform <noreply@your-verified-domain.com>'`

**For Team Invitations:**
- Supabase Dashboard → Authentication → Email Templates
- Update the sender email in SMTP settings

## Email Templates

### Brand Invitation Email

The brand invitation email includes:
- Professional gradient header with DPL branding
- Welcome message with company name
- Optional custom welcome message from the platform admin
- Feature highlights showing what's included
- Prominent call-to-action button
- Expiration warning
- Backup invitation link
- Support contact information

### Team Member Invitation Email

The team invitation email (sent through Supabase Auth) includes:
- Organization name
- Inviter information
- Role assignment
- Accept invitation link
- Expiration date

You can customize this template in the Supabase Dashboard under Authentication → Email Templates.

## Testing Email Delivery

### Test Brand Invitation

1. Log in as a Platform Admin
2. Go to Platform Admin Dashboard
3. Click "Invite New Brand"
4. Enter a test email address and company name
5. Check the recipient's inbox (including spam folder)

### Test Team Invitation

1. Log in as an Organization Admin
2. Go to Settings → Team tab
3. Enter a test email address
4. Select a role and click "Invite"
5. Check the recipient's inbox

### Email Deliverability Tips

- Always use a verified domain for sending
- Configure SPF, DKIM, and DMARC records
- Avoid spam trigger words in email content
- Test emails with [Mail Tester](https://www.mail-tester.com/)
- Monitor your Resend dashboard for bounce rates
- Keep your sending reputation high

## Troubleshooting

### Emails Not Being Sent

1. Check that RESEND_API_KEY is configured in your environment
2. Verify your domain in Resend dashboard
3. Check Supabase Edge Function logs for errors
4. Ensure your Resend account is in good standing

### Emails Going to Spam

1. Verify your domain properly with all DNS records
2. Use a custom domain (not free email providers)
3. Configure DMARC policy
4. Avoid spam trigger words
5. Include an unsubscribe link in footer

### Template Variables Not Working

For Supabase Auth emails:
- Use double curly braces: `{{ .Variable }}`
- Check the official Supabase template documentation
- Test after each change

## Email Sending Limits

Free Resend accounts include:
- 100 emails per day
- 3,000 emails per month

For higher volumes, upgrade to a paid plan at [resend.com/pricing](https://resend.com/pricing).

## Custom Email Templates

To further customize your email templates:

1. Edit the HTML in `supabase/functions/send-brand-invitation/index.ts`
2. Use inline CSS for maximum email client compatibility
3. Test across different email clients (Gmail, Outlook, Apple Mail)
4. Keep the design mobile-responsive
5. Include alt text for images
6. Maintain proper HTML structure

## Support

For issues related to:
- Resend API: [resend.com/docs](https://resend.com/docs)
- Supabase Auth: [supabase.com/docs/guides/auth](https://supabase.com/docs/guides/auth)
- Email deliverability: [postmarkapp.com/guides](https://postmarkapp.com/guides)
