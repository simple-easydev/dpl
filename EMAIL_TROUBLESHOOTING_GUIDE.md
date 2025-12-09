# Email Delivery Troubleshooting Guide

## Quick Start Diagnostic Tool

A new diagnostic page has been added to help identify email delivery issues:

**URL:** `/diagnostics`

This tool will:
- Test Supabase connection
- Verify environment variables
- Check authentication endpoints
- Test password reset email delivery
- Provide detailed error messages

## Step-by-Step Troubleshooting

### 1. Check Enhanced Console Logs

The password reset flow now includes detailed logging. Open browser console and look for:

```
=== Password Reset Request Started ===
Email: user@example.com
Timestamp: 2025-11-14T...
Redirect URL: https://...
Supabase URL: https://...
=== Password Reset Request Successful ===
Duration: 234ms
Email should be sent to: user@example.com
```

**If you see "Successful" but no email arrives**, the issue is with email delivery configuration in Supabase.

**If you see "Failed"**, check the error message for:
- `Email rate limit exceeded` - Wait 5-10 minutes and try again
- `Invalid email` - Check email format
- `User not found` - Email doesn't exist in the system
- Network errors - Check internet connection and Supabase status

### 2. Verify Supabase Dashboard Configuration

#### A. Site URL Configuration

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `bexwcnmwpleoqvvmcwrg`
3. Navigate to **Authentication** → **URL Configuration**
4. Verify **Site URL** is set to:
   ```
   https://dpl-rey8.bolt.host
   ```

#### B. Redirect URLs

In the same URL Configuration section, ensure these URLs are added:

```
https://dpl-rey8.bolt.host/reset-password
https://dpl-rey8.bolt.host/**
http://localhost:5173/reset-password
http://localhost:5173/**
```

**Important:** Click **Save** after making changes.

#### C. Email Templates

1. Navigate to **Authentication** → **Email Templates**
2. Select **Reset Password** from the dropdown
3. Verify the template exists and contains `{{ .ConfirmationURL }}`
4. Check the subject line is set (e.g., "Reset Your Password for DPL")

If the template is blank or missing, use the template from `PASSWORD_RESET_SETUP.md`.

### 3. Check SMTP Configuration

#### Option A: Using Supabase Default SMTP

1. In Supabase Dashboard, go to **Authentication** → **Email Templates**
2. Scroll to the bottom to find **SMTP Settings**
3. If using default (no custom SMTP configured), emails are sent through Supabase's provider
4. Check for any error messages or warnings

**Known Issue:** Supabase default SMTP has rate limits and may not deliver reliably to all email providers.

#### Option B: Set Up Resend (Recommended)

For reliable email delivery, configure Resend:

1. Sign up at [resend.com](https://resend.com)
2. Get your API key (starts with `re_`)
3. In Supabase Dashboard → **Authentication** → **Email Templates** → **SMTP Settings**:
   - **Host:** `smtp.resend.com`
   - **Port:** `465` (SSL) or `587` (TLS)
   - **Username:** `resend`
   - **Password:** Your Resend API key
   - **Sender Email:** Your verified email (e.g., `noreply@yourdomain.com`)
4. Click **Save**

**Note:** You need to verify your domain in Resend for custom sender emails.

### 4. Check Email Rate Limits

Supabase has rate limits for authentication emails:

- **Default:** 3-4 password reset emails per hour per email address
- **Global:** Varies by plan (check your Supabase plan details)

**If rate limited:**
1. Wait 10-15 minutes before trying again
2. Check Supabase Dashboard → **Authentication** → **Rate Limits**
3. Consider upgrading your Supabase plan if hitting limits frequently

### 5. Review Supabase Logs

Check for email delivery errors:

1. Go to Supabase Dashboard
2. Navigate to **Logs** → **Authentication Logs**
3. Look for entries related to `auth.resetPasswordForEmail`
4. Check for error messages or warnings

Common log messages:
- ✅ `Password reset email sent` - Email was queued successfully
- ❌ `SMTP error` - Email delivery failed
- ⚠️ `Rate limit exceeded` - Too many requests
- ⚠️ `Invalid recipient` - Email address issue

### 6. Test Email Delivery

#### A. Use Diagnostic Tool

1. Navigate to `/diagnostics` in your application
2. Click "Run Diagnostics" to test connectivity
3. Enter a test email address
4. Click "Test Password Reset"
5. Review the detailed results

#### B. Check Spam Folder

Password reset emails often land in spam due to:
- New sender domain
- No SPF/DKIM/DMARC configured
- Generic content
- High volume sending

**Solution:** Set up proper email authentication or use Resend with verified domain.

#### C. Test with Different Email Providers

Try requesting password reset with different email providers:
- ✉️ Gmail
- ✉️ Outlook/Hotmail
- ✉️ Yahoo
- ✉️ ProtonMail
- ✉️ Custom domain

Some providers are more strict than others.

### 7. Network Connectivity Issues

Based on your console errors showing "ERR_INTERNET_DISCONNECTED":

#### A. Check Recent Network Changes

You mentioned potential network changes. Verify:
- ✅ Firewall rules allow outbound HTTPS to `*.supabase.co`
- ✅ Proxy settings aren't blocking Supabase APIs
- ✅ VPN isn't interfering with connections
- ✅ DNS can resolve `cqztylidsbekbbrkusxg.supabase.co`

#### B. Test Direct Connectivity

From terminal/command prompt:

```bash
# Test DNS resolution
nslookup cqztylidsbekbbrkusxg.supabase.co

# Test HTTPS connection
curl -I https://cqztylidsbekbbrkusxg.supabase.co/auth/v1/health

# Expected response: HTTP 200 OK
```

#### C. Check Supabase Status

Visit [Supabase Status Page](https://status.supabase.com/) to verify there are no ongoing incidents.

### 8. Verify Environment Variables

Check that `.env` file has correct values:

```bash
VITE_SUPABASE_URL=https://cqztylidsbekbbrkusxg.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Important:**
- No extra spaces or quotes
- No trailing slashes on URL
- Anon key must be current (not rotated)

After changing `.env`, restart the development server.

### 9. Common Error Messages and Solutions

| Error Message | Cause | Solution |
|--------------|-------|----------|
| `Email rate limit exceeded` | Too many requests | Wait 10-15 minutes, reduce frequency |
| `Invalid email` | Malformed email address | Verify email format |
| `User not found` | Email not in auth.users | User must sign up first |
| `SMTP error` | Email provider issue | Check SMTP settings, switch to Resend |
| `ERR_INTERNET_DISCONNECTED` | Network connectivity | Check firewall, proxy, VPN settings |
| `Failed to fetch` | API unreachable | Verify Supabase URL, check network |
| `Invalid redirect URL` | URL not whitelisted | Add to Redirect URLs in Supabase |

### 10. Testing Checklist

Use this checklist to systematically verify everything:

- [ ] Environment variables are correct in `.env`
- [ ] Supabase project is active (not paused)
- [ ] Site URL is set correctly in Supabase Dashboard
- [ ] Redirect URLs include reset-password path
- [ ] Email template exists and contains ConfirmationURL
- [ ] SMTP is configured (preferably Resend)
- [ ] Rate limits are not exceeded
- [ ] Network allows connections to Supabase
- [ ] DNS resolves Supabase domain correctly
- [ ] Test email sent using `/diagnostics` tool
- [ ] Checked both inbox and spam folder
- [ ] Console logs show "Successful" message
- [ ] Supabase logs don't show errors

## Quick Fix: Most Common Issues

### Issue 1: API Call Succeeds But No Email Received

**Diagnosis:** Console shows "Password reset request successful" but no email arrives.

**Root Cause:** SMTP not configured or email delivery failing at Supabase level.

**Solution:**
1. Set up Resend SMTP in Supabase Dashboard
2. Verify email template is configured correctly
3. Check Supabase authentication logs for delivery errors

### Issue 2: Network Errors in Console

**Diagnosis:** Console shows "ERR_INTERNET_DISCONNECTED" or "Failed to fetch".

**Root Cause:** Firewall, proxy, or VPN blocking Supabase connections.

**Solution:**
1. Identify recent network changes that were made
2. Whitelist `*.supabase.co` in firewall
3. Test direct connectivity with curl
4. Temporarily disable VPN to test

### Issue 3: Rate Limit Errors

**Diagnosis:** Console shows "Email rate limit exceeded".

**Root Cause:** Too many password reset requests in short time.

**Solution:**
1. Wait 10-15 minutes before trying again
2. Review Supabase rate limit settings
3. Consider upgrading Supabase plan if hitting limits frequently

## Getting Help

If you've tried all troubleshooting steps and still have issues:

1. **Collect Diagnostic Information:**
   - Run `/diagnostics` and screenshot results
   - Copy console logs from password reset attempt
   - Note exact error messages
   - Document recent changes (network, config, etc.)

2. **Check Supabase Support:**
   - [Supabase Documentation](https://supabase.com/docs)
   - [Supabase Discord](https://discord.supabase.com)
   - [Supabase GitHub Issues](https://github.com/supabase/supabase/issues)

3. **Review This Project's Documentation:**
   - `PASSWORD_RESET_SETUP.md` - Setup instructions
   - `SUPABASE_EMAIL_TEMPLATES.md` - Email template details
   - `RESEND_EMAIL_SETUP.md` - Resend configuration

## Additional Resources

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Supabase Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Resend Documentation](https://resend.com/docs)
- [Email Authentication Best Practices](https://www.mailgun.com/blog/email-authentication-dkim-spf-dmarc/)
