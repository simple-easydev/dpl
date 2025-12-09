# Password Reset Setup Guide

This guide will walk you through configuring the password reset functionality in your Supabase project.

## Overview

The password reset flow consists of:
1. User requests password reset from the login page
2. User receives an email with a secure reset link
3. User clicks the link and is taken to the reset password page
4. User sets a new password and is redirected to login

## Step 1: Configure Supabase Authentication Settings

### Set Site URL

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Authentication** → **URL Configuration**
4. Set the **Site URL** to: `https://dpl-rey8.bolt.host`

### Configure Redirect URLs

In the same URL Configuration section, add the following **Redirect URLs**:

```
https://dpl-rey8.bolt.host/reset-password
https://dpl-rey8.bolt.host/**
http://localhost:5173/reset-password
http://localhost:5173/**
```

These URLs allow Supabase to redirect users after clicking the email link.

### Save Changes

Click **Save** at the bottom of the page.

## Step 2: Configure Password Reset Email Template

1. In Supabase Dashboard, navigate to **Authentication** → **Email Templates**
2. Select **Reset Password** from the template dropdown
3. Replace the default template with the custom HTML below
4. Update the subject line to: `Reset Your Password for DPL`
5. Click **Save**

### Custom Email Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
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
                Reset Your Password
              </h1>
              <p style="margin: 12px 0 0 0; color: #dbeafe; font-size: 16px;">
                Secure your DPL account
              </p>
            </td>
          </tr>

          <!-- Main content -->
          <tr>
            <td style="padding: 40px;">

              <!-- Greeting -->
              <h2 style="margin: 0 0 16px 0; color: #1f2937; font-size: 24px; font-weight: 600;">
                Password Reset Request
              </h2>

              <p style="margin: 0 0 24px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                We received a request to reset your password for your <strong style="color: #1f2937;">DPL</strong> account. Click the button below to choose a new password.
              </p>

              <!-- Important notice -->
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin-bottom: 32px; border-radius: 6px;">
                <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.5;">
                  <strong>⏰ This link will expire in 60 minutes</strong> for your security. If you didn't request this reset, you can safely ignore this email.
                </p>
              </div>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 32px;">
                <tr>
                  <td align="center">
                    <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; padding: 16px 48px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Security notice -->
              <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.5;">
                  <strong style="color: #1f2937;">Security Tip:</strong> Never share your password with anyone. DPL will never ask you for your password via email.
                </p>
              </div>

              <!-- Backup link -->
              <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 13px;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <div style="background-color: #f3f4f6; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb; word-break: break-all;">
                <a href="{{ .ConfirmationURL }}" style="color: #3b82f6; font-size: 12px; text-decoration: none;">
                  {{ .ConfirmationURL }}
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
                If you didn't request a password reset, please ignore this email or contact support if you have concerns.
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

## Step 3: Test the Password Reset Flow

### Testing Locally

1. Start your development server: `npm run dev`
2. Navigate to http://localhost:5173/login
3. Click "Forgot password?"
4. Enter your email address
5. Check your email inbox for the reset link
6. Click the link (should redirect to http://localhost:5173/reset-password)
7. Enter your new password
8. Verify you're redirected to the login page

### Testing in Production

1. Navigate to https://dpl-rey8.bolt.host/login
2. Click "Forgot password?"
3. Enter your email address
4. Check your email inbox for the reset link
5. Click the link (should redirect to https://dpl-rey8.bolt.host/reset-password)
6. Enter your new password
7. Verify you're redirected to the login page

## Template Variables

Supabase provides these template variables you can use:

- `{{ .ConfirmationURL }}` - The password reset link (required)
- `{{ .Token }}` - The reset token
- `{{ .TokenHash }}` - The hashed token
- `{{ .SiteURL }}` - Your site URL
- `{{ .Email }}` - The recipient's email address

## Customization

You can customize the email template by:

- Changing colors (replace hex codes like `#3b82f6`)
- Updating the support email address
- Modifying the header text and styling
- Adding your company logo
- Adjusting padding and spacing

## Security Features

The implementation includes:

- **Token-based authentication**: Reset links contain secure, one-time tokens
- **Time-limited tokens**: Links expire after 60 minutes (Supabase default)
- **Session validation**: Reset page verifies valid session before showing form
- **Password requirements**: Minimum 6 characters enforced
- **Secure redirects**: Only whitelisted URLs are allowed
- **Generic error messages**: Prevents email enumeration attacks

## Troubleshooting

### Email Not Received

1. Check spam/junk folder
2. Verify email address is correct
3. Check Supabase Dashboard logs for errors
4. Ensure SMTP is configured correctly in Supabase

### Reset Link Not Working

1. Verify Site URL is set correctly in Supabase
2. Check that redirect URLs include your domain
3. Ensure the link hasn't expired (60 minute limit)
4. Check browser console for errors

### "Invalid Reset Link" Error

This means:
- The link has expired
- The token has already been used
- The session is invalid

User should request a new reset link.

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Password Reset Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
