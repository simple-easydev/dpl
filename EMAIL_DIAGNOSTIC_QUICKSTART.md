# Email Diagnostic Quick Start

## Immediate Actions

### 1. Access Diagnostic Tool

Navigate to: **`/diagnostics`**

This tool provides:
- ✅ Supabase connection test
- ✅ Environment variable verification
- ✅ API endpoint health check
- ✅ Live password reset email test
- ✅ Detailed error reporting

### 2. Enhanced Console Logging

Open browser DevTools (F12) and attempt a password reset. Look for:

```
=== Password Reset Request Started ===
Email: test@example.com
Redirect URL: https://dpl-rey8.bolt.host/reset-password
Supabase URL: https://cqztylidsbekbbrkusxg.supabase.co

=== Password Reset Request Successful ===
Duration: 234ms
Email should be sent to: test@example.com
```

**Key Indicators:**
- ✅ **"Successful"** = API call worked, issue is email delivery
- ❌ **"Failed"** = API error, check error details in console
- ⚠️ **Network error** = Connectivity issue

## Priority Checks in Supabase Dashboard

### Critical Settings (Check First)

1. **Authentication → URL Configuration**
   - Site URL: `https://dpl-rey8.bolt.host`
   - Redirect URLs must include: `/reset-password`

2. **Authentication → Email Templates**
   - Template: "Reset Password"
   - Must contain: `{{ .ConfirmationURL }}`
   - Subject line should be set

3. **Authentication → SMTP Settings**
   - If blank = Using Supabase default (may be unreliable)
   - Recommended: Configure Resend SMTP

4. **Authentication → Rate Limits**
   - Check if limits exceeded
   - Default: 3-4 resets per hour per email

5. **Logs → Authentication Logs**
   - Search for: `resetPasswordForEmail`
   - Look for: delivery errors, SMTP failures

## Most Likely Issues (Based on Symptoms)

### Symptom: "Successful" but no email

**Root Cause:** Email delivery configuration

**Fix Priority:**
1. ⭐ Set up Resend SMTP (most reliable)
2. Check email template exists and is correct
3. Review Supabase auth logs for delivery errors
4. Check spam folder

### Symptom: Network errors in console

**Root Cause:** Recent network changes blocking Supabase

**Fix Priority:**
1. ⭐ Whitelist `*.supabase.co` in firewall
2. Test connectivity: `curl https://cqztylidsbekbbrkusxg.supabase.co/auth/v1/health`
3. Check proxy/VPN settings
4. Verify DNS resolution

### Symptom: Rate limit errors

**Root Cause:** Too many requests

**Fix Priority:**
1. ⭐ Wait 10-15 minutes
2. Review rate limit settings in Supabase
3. Consider plan upgrade if frequent issue

## Resend Setup (5 minutes)

**Recommended for reliable email delivery:**

1. Sign up: https://resend.com
2. Get API key (starts with `re_`)
3. In Supabase Dashboard → Auth → Email Templates → SMTP Settings:
   ```
   Host: smtp.resend.com
   Port: 465
   Username: resend
   Password: [Your Resend API Key]
   Sender: noreply@yourdomain.com (or Resend test email)
   ```
4. Save and test

## Testing Workflow

1. ✅ Navigate to `/diagnostics`
2. ✅ Click "Run Diagnostics" → Verify all checks pass
3. ✅ Enter test email → Click "Test Password Reset"
4. ✅ Check console logs for detailed output
5. ✅ Check email inbox (and spam folder)
6. ✅ If no email after 2-3 minutes → Check Supabase auth logs

## Quick Commands

### Test connectivity from terminal:
```bash
# Test DNS
nslookup cqztylidsbekbbrkusxg.supabase.co

# Test API
curl -I https://cqztylidsbekbbrkusxg.supabase.co/auth/v1/health
```

### Check environment:
```bash
# Verify env vars loaded
echo $VITE_SUPABASE_URL
```

## Files Updated

✅ **AuthContext.tsx** - Enhanced logging for password reset
✅ **DiagnosticPage.tsx** - New diagnostic tool at `/diagnostics`
✅ **App.tsx** - Added diagnostic route
✅ **EMAIL_TROUBLESHOOTING_GUIDE.md** - Comprehensive guide
✅ **EMAIL_DIAGNOSTIC_QUICKSTART.md** - This quick reference

## Next Steps

1. **Start Here:** `/diagnostics` page
2. **Check This:** Supabase Dashboard → Authentication settings
3. **Set Up:** Resend SMTP for reliability
4. **Review:** `EMAIL_TROUBLESHOOTING_GUIDE.md` for detailed steps
5. **Test:** Complete flow with diagnostic tool

## Support Resources

- Full Guide: `EMAIL_TROUBLESHOOTING_GUIDE.md`
- Setup Guide: `PASSWORD_RESET_SETUP.md`
- Email Templates: `SUPABASE_EMAIL_TEMPLATES.md`
- Resend Setup: `RESEND_EMAIL_SETUP.md`
- Supabase Docs: https://supabase.com/docs/guides/auth
- Resend Docs: https://resend.com/docs
