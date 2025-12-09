# Supabase Password Reset Configuration Guide

This guide provides step-by-step instructions to configure password reset functionality in your Supabase project.

## Current Status

Your application code is working correctly. The Supabase API successfully receives password reset requests, but emails are not being delivered because the email service is not properly configured in your Supabase dashboard.

## Configuration Steps

### Step 1: Access Your Supabase Dashboard

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Log in to your account
3. Select your project: `bexwcnmwpleoqvvmcwrg`

### Step 2: Configure URL Settings

1. In the left sidebar, click **Authentication**
2. Click on **URL Configuration**
3. Configure the following settings:

#### Site URL
Set this to your primary application URL:
```
https://your-production-domain.com
```

For development, you can use:
```
http://localhost:5173
```

#### Redirect URLs
Add these URLs to the allowed redirect URLs list (one per line):

```
http://localhost:5173/reset-password
http://localhost:5173/**
https://your-production-domain.com/reset-password
https://your-production-domain.com/**
```

**Important:** Replace `your-production-domain.com` with your actual production domain.

4. Click **Save** at the bottom of the page

### Step 3: Verify Email Service Status

1. In the **Authentication** section, look for **Providers** or **Email**
2. Ensure that **Email** authentication is **enabled**
3. Check the status of your email service:
   - **Built-in Supabase Email**: Should be enabled by default for new projects
   - **Custom SMTP**: If configured, verify the settings are correct

#### If Using Supabase's Built-in Email Service:

Supabase provides a built-in email service that should work out of the box. However, it has limitations:
- Limited to 3 emails per hour during development
- May have deliverability issues with some email providers
- Not recommended for production use

#### If You Need Custom SMTP (Recommended for Production):

1. Go to **Authentication** → **Email Templates**
2. Scroll down to **SMTP Settings**
3. Configure your SMTP provider (recommended: Resend, SendGrid, or AWS SES)

**Example with Resend:**
- **Host:** `smtp.resend.com`
- **Port:** `465` (SSL) or `587` (TLS)
- **Username:** `resend`
- **Password:** Your Resend API key (get one at [resend.com](https://resend.com))
- **Sender Email:** Your verified email address (e.g., `noreply@yourdomain.com`)
- **Sender Name:** Your company name (e.g., `DPL`)

4. Click **Save**

### Step 4: Configure Password Reset Email Template

1. In **Authentication**, click **Email Templates**
2. Select **Reset Password** (or **Recovery**) from the dropdown
3. Update the **Subject Line**:
```
Reset Your Password for DPL
```

4. Optionally customize the HTML template. Here's a basic template:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">

          <tr>
            <td style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 40px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                Reset Your Password
              </h1>
            </td>
          </tr>

          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px 0; color: #1f2937; font-size: 20px;">
                Password Reset Request
              </h2>

              <p style="margin: 0 0 24px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                We received a request to reset your password. Click the button below to create a new password.
              </p>

              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
                <p style="margin: 0; color: #92400e; font-size: 14px;">
                  <strong>This link will expire in 60 minutes</strong>. If you didn't request this reset, you can safely ignore this email.
                </p>
              </div>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td align="center">
                    <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 13px;">
                If the button doesn't work, copy and paste this link:
              </p>
              <div style="background-color: #f3f4f6; padding: 12px; border-radius: 4px; word-break: break-all;">
                <a href="{{ .ConfirmationURL }}" style="color: #3b82f6; font-size: 12px;">
                  {{ .ConfirmationURL }}
                </a>
              </div>
            </td>
          </tr>

          <tr>
            <td style="background-color: #f9fafb; padding: 24px; border-top: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; color: #6b7280; font-size: 13px; text-align: center;">
                If you have any questions, contact us at support@deplete.app
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

5. Click **Save**

### Step 5: Check Email Rate Limits

1. In **Authentication**, look for **Rate Limits** settings
2. Verify that password reset rate limits are reasonable:
   - Default: 3 emails per hour (development)
   - Recommended for production: 5-10 emails per hour per user

### Step 6: Test the Configuration

#### Testing Checklist:

1. **Test on Localhost:**
   - Navigate to `http://localhost:5173/login`
   - Click "Forgot password?"
   - Enter a valid email address (use your own email)
   - Click "Send Reset Link"
   - Check your email inbox and spam folder

2. **Verify Email Delivery:**
   - Check if the email arrives within 1-2 minutes
   - Open the email and verify it's formatted correctly
   - Click the "Reset Password" button

3. **Test Reset Flow:**
   - Verify the link takes you to `http://localhost:5173/reset-password`
   - Enter a new password (at least 6 characters)
   - Confirm the password
   - Click "Update Password"
   - Verify you're redirected to the login page

4. **Test Login:**
   - Try logging in with your new password
   - Verify you can access the dashboard

5. **Test on Production:**
   - Repeat the same process on your production domain
   - Verify redirect URLs work correctly

### Step 7: Monitor and Debug

If emails are not being sent, check the following:

1. **Supabase Logs:**
   - Go to your Supabase dashboard
   - Click on **Logs** in the left sidebar
   - Look for any email-related errors

2. **Email Provider Dashboard:**
   - If using custom SMTP, check your email provider's dashboard
   - Look for failed sends or bounces

3. **Common Issues:**

   **Issue:** Email not received
   - Check spam/junk folder
   - Verify email service is enabled
   - Check rate limits
   - Verify SMTP credentials (if using custom SMTP)

   **Issue:** Link doesn't work
   - Verify redirect URLs are configured correctly
   - Check that the link hasn't expired (60 minutes)
   - Ensure Site URL is set correctly

   **Issue:** "Invalid reset link" error
   - Link may have expired
   - Token may have already been used
   - Request a new reset link

## Security Considerations

1. **Rate Limiting:** Supabase automatically rate limits password reset requests to prevent abuse
2. **Token Expiration:** Reset links expire after 60 minutes
3. **One-Time Use:** Each reset token can only be used once
4. **Secure Redirects:** Only whitelisted URLs are allowed for redirects
5. **Email Verification:** Supabase verifies the user exists before sending reset emails (but returns success to prevent email enumeration)

## Production Recommendations

1. **Use Custom SMTP:** Set up Resend, SendGrid, or AWS SES for reliable email delivery
2. **Verify Domain:** Add SPF, DKIM, and DMARC records for your sending domain
3. **Monitor Logs:** Regularly check Supabase logs for email delivery issues
4. **Test Regularly:** Periodically test the password reset flow to ensure it works
5. **Update Templates:** Customize email templates with your branding
6. **Set Up Alerts:** Configure monitoring to alert you if email sending fails

## Next Steps

After completing this configuration:

1. Test the password reset flow on localhost
2. Test on your production environment
3. Update your documentation with any custom configuration
4. Train your support team on troubleshooting password reset issues
5. Monitor email delivery rates and adjust as needed

## Need Help?

If you're still experiencing issues:

1. Check the [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
2. Review the [Supabase Email Templates Guide](https://supabase.com/docs/guides/auth/auth-email-templates)
3. Contact Supabase support through your dashboard
4. Check the Supabase Discord community for help

## Summary

Your application code is working correctly. The password reset functionality will work once you:

1. Configure redirect URLs in Supabase dashboard
2. Ensure email service is enabled and configured
3. Optionally customize the email template
4. Test the complete flow from request to password update

The Supabase API is successfully processing password reset requests, but emails cannot be delivered until the email service is properly configured in your dashboard.
