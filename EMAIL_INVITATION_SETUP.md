# Email Invitation Template - Quick Start Guide

This guide will help you set up branded email invitations for your DPL application in 5 minutes.

## What This Does

When you invite a team member through **Settings → Team**, they'll receive a beautifully branded email that matches your application's design instead of Supabase's default template.

## Preview

Your branded invitation email includes:
- 🎨 Dark theme matching your app
- 🎉 Welcoming header with celebration emoji
- ✨ Gradient buttons and feature highlights
- 📧 Professional layout that works in all email clients
- 🔒 Clear security information and expiration notice

## Step-by-Step Setup

### Step 1: Access Supabase Dashboard

1. Open [https://supabase.com/dashboard](https://supabase.com/dashboard) in your browser
2. Log in with your Supabase credentials
3. Click on your project: **bexwcnmwpleoqvvmcwrg**

### Step 2: Open Email Templates

1. In the left sidebar, click **Authentication**
2. In the Authentication menu, click **Email Templates**
3. You'll see a template selector dropdown at the top

### Step 3: Select Invite Template

1. Click the template dropdown
2. Select **Invite user** from the list
3. You'll see Supabase's default invitation template

### Step 4: Copy the Branded Template

1. Open the file: `SUPABASE_EMAIL_TEMPLATES.md`
2. Find the HTML template (lines 23-146)
3. Select all the HTML code (from `<!DOCTYPE html>` to `</html>`)
4. Copy it to your clipboard (Ctrl+C or Cmd+C)

### Step 5: Paste into Supabase

1. Back in the Supabase Email Templates page
2. Select all the existing template code (Ctrl+A or Cmd+A)
3. Paste your new template (Ctrl+V or Cmd+V)

### Step 6: Update the Subject Line

1. Find the **Subject** field at the top of the page
2. Replace the current text with:
   ```
   🎉 You're invited to join your team on DPL
   ```

### Step 7: Verify Redirect URLs

1. Click **URL Configuration** in the Authentication menu
2. Check that these URLs are in the **Redirect URLs** list:
   ```
   http://localhost:5173/accept-invite
   http://localhost:5173/**
   https://your-production-domain.com/accept-invite
   https://your-production-domain.com/**
   ```
3. Add any missing URLs
4. Click **Save**

### Step 8: Save Your Template

1. Scroll to the bottom of the Email Templates page
2. Click the **Save** button
3. Wait for the green success message
4. Your template is now live!

## Testing Your Template

### Send a Test Invitation

1. Log into your DPL application as an admin
2. Go to **Settings**
3. Click the **Team** tab
4. Enter a test email address (use your own email)
5. Select a role (Member or Viewer)
6. Click **Invite**

### Check the Email

1. Open your email inbox (check spam folder)
2. Look for: "🎉 You're invited to join your team on DPL"
3. The email should have:
   - Dark background with gradient
   - Blue header with celebration message
   - Four feature items with colored icons
   - Prominent blue "Accept Invitation →" button
   - Yellow expiration warning box
   - Backup link at the bottom

### Test the Link

1. Click the "Accept Invitation" button in the email
2. You should be redirected to the accept-invite page
3. If already a member, you'll see a friendly message
4. If not a member, you'll be added to the team

## What's Included in the Template

### Design Features

- **Dark Mode Theme**: Matches your application's modern dark interface
- **Gradient Accents**: Blue gradients for headers and buttons
- **Professional Layout**: Clean, spacious design with proper hierarchy
- **Mobile Responsive**: Works perfectly on all screen sizes
- **Email Client Compatible**: Tested in Gmail, Outlook, Apple Mail

### Content Sections

1. **Header**: Eye-catching gradient with invitation message
2. **Welcome Message**: Personal greeting to the new team member
3. **Features List**: Four key benefits with gradient icon badges
4. **Call to Action**: Large, prominent acceptance button
5. **Expiration Notice**: Clear warning about 7-day expiration
6. **Backup Link**: Plain text link for email clients that block buttons
7. **Footer**: Support contact and copyright information

### Security Features

- Uses Supabase's secure token system
- Links expire after 7 days
- Clear messaging about unexpected invitations
- One-time use invitation tokens

## Customization Options

If you want to customize the template:

### Change Colors

Replace these hex codes in the template:
- **Primary Blue**: `#3b82f6` → Your brand color
- **Accent Green**: `#10b981` → Your accent color
- **Background Dark**: `#0f172a` → Your background
- **Text Light**: `#f1f5f9` → Your text color

### Update Features List

Edit the four feature items (lines 57-81):
- Change the text to match your offering
- Update gradient colors for the checkmark badges
- Add or remove features as needed

### Modify Support Email

Change `support@deplete.app` to your support email address (line 132)

### Add Your Logo

Add an image tag in the header section:
```html
<img src="https://your-domain.com/logo.png" alt="Logo" style="max-width: 120px; margin-bottom: 16px;">
```

## Troubleshooting

### Email Not Received

**Problem**: Invited user doesn't receive the email

**Solutions**:
1. Check spam/junk folder
2. Verify email provider is configured in Supabase
3. Check Supabase Logs → Authentication for errors
4. Confirm redirect URLs are set correctly
5. Wait 5-10 minutes (emails can be delayed)

### Styling Issues

**Problem**: Email looks broken or plain

**Solutions**:
1. This is normal in some email clients (they strip CSS)
2. The template uses inline styles for maximum compatibility
3. Test in multiple email clients (Gmail, Outlook, Apple Mail)
4. Ensure you copied the entire template including all style attributes

### Link Not Working

**Problem**: Accept invitation button doesn't work

**Solutions**:
1. Verify redirect URLs include `/accept-invite`
2. Check that the accept-invite page exists in your app
3. Ensure Supabase can reach your application
4. Try the backup text link instead
5. Check browser console for errors

### Already a Member

**Problem**: "Already a member" error when testing

**Solutions**:
1. This is expected if you're testing with your own email
2. The system prevents duplicate memberships
3. Use a different test email address
4. Or remove yourself from the organization first

## How It Works

When you send an invitation:

1. **Admin Action**: Admin enters email and role in Settings → Team
2. **Edge Function**: Your app calls the `send-invitation` edge function
3. **Supabase Auth**: Edge function uses `admin.inviteUserByEmail()`
4. **Email Service**: Supabase sends the email using your template
5. **User Receives**: User gets beautifully branded invitation email
6. **User Clicks**: Link redirects to your accept-invite page
7. **Account Created**: User creates account or logs in
8. **Team Added**: User is automatically added to the organization

## Technical Details

### Template Variables

The template uses Supabase's built-in variables:
- `{{ .ConfirmationURL }}` - The invitation acceptance link
- `{{ .SiteURL }}` - Your application URL
- `{{ .Email }}` - Recipient's email address
- `{{ .Token }}` - Invitation token
- `{{ .TokenHash }}` - Hashed token

### Email Provider

By default, Supabase uses its built-in email service. For production:
1. Consider setting up custom SMTP (Resend, SendGrid)
2. Verify your sending domain
3. Configure SPF, DKIM, and DMARC records
4. Monitor delivery rates in your email provider dashboard

### Security

- Invitations expire after 7 days
- Tokens are single-use only
- Links are cryptographically secure
- Rate limiting prevents abuse
- Only admins can send invitations

## Next Steps

After setting up your branded invitation template:

1. ✅ Test with multiple email addresses
2. ✅ Verify styling in different email clients
3. ✅ Confirm links work correctly
4. ✅ Send real invitations to your team
5. ✅ Monitor Supabase logs for any issues

## Support

If you need help:
- Check `SUPABASE_EMAIL_TEMPLATES.md` for the full template code
- Review `EMAIL_TROUBLESHOOTING_GUIDE.md` for common issues
- Check Supabase documentation: [Auth Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- Contact Supabase support through your dashboard

## Summary

You now have a professional, branded email invitation system! Every time you invite a team member, they'll receive a beautiful email that matches your application's design and creates a great first impression.

The template is:
- ✅ Production-ready
- ✅ Mobile responsive
- ✅ Email client compatible
- ✅ Secure and compliant
- ✅ Easy to customize

Enjoy your new branded invitations! 🎉
