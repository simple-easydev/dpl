# Authentication Debug Guide

This guide explains how to use the comprehensive logging that has been added to diagnose your authentication issues.

## Overview

Extensive console logging has been added throughout the authentication flow to help identify exactly where things are breaking:

1. **Password Reset Flow** - ForgotPassword page and AuthContext
2. **Login Flow** - Login page and AuthContext
3. **Session Detection** - AuthContext initialization and state changes
4. **Protected Routes** - Route authentication checks
5. **Reset Password Page** - URL parameter detection

## How to Debug

### 1. Open Browser Console

1. Visit your deployed site: `https://dpl-rey8.bolt.host`
2. Open Developer Tools (F12 or Right-click → Inspect)
3. Go to the **Console** tab
4. Clear any existing logs

### 2. Testing Password Reset (Send Reset Link Button)

**Steps:**
1. Navigate to `/login`
2. Click "Forgot password?"
3. Enter your email address
4. Click "Send Reset Link"
5. **Watch the console carefully**

**What to look for:**

```
=== FORGOT PASSWORD: Form submitted ===
FORGOT PASSWORD: Email validation passed: your@email.com
FORGOT PASSWORD: Requesting password reset for: your@email.com
FORGOT PASSWORD: Current URL: https://dpl-rey8.bolt.host/forgot-password

=== AUTH CONTEXT: requestPasswordReset called ===
AUTH CONTEXT: Email received: your@email.com
AUTH CONTEXT: Is localhost? false
AUTH CONTEXT: Redirect URL constructed: https://dpl-rey8.bolt.host/reset-password
AUTH CONTEXT: Calling supabase.auth.resetPasswordForEmail...
AUTH CONTEXT: Supabase response received
AUTH CONTEXT: Data: [object or null]
AUTH CONTEXT: Error: [error object or null]
```

**Diagnosis:**

- **If you see nothing after clicking the button**: The click handler isn't firing (possible React issue)
- **If you see "Form submitted" but nothing after**: Email validation failed or form submission blocked
- **If you see an error from Supabase**: The error message will tell you what's wrong
  - "Email rate limit exceeded" = Too many attempts, wait a few minutes
  - "Invalid email" = Email format issue
  - Network errors = Connection problem to Supabase
- **If you see "Success! Email should be sent"**: The request worked! Check your email (and spam folder)

### 3. Testing Password Reset Link (Email Link Click)

**Steps:**
1. Check your email for the password reset link
2. Click the link in the email
3. **Watch the console immediately**

**What to look for:**

```
=== AUTH STATE CHANGE ===
AUTH STATE CHANGE: Event: RECOVERY
AUTH STATE CHANGE: Session exists? YES
AUTH STATE CHANGE: Session user: your@email.com
AUTH STATE CHANGE: Current URL: https://dpl-rey8.bolt.host/reset-password#...
AUTH STATE CHANGE: URL hash: #access_token=...&type=recovery&...

=== RESET PASSWORD: Checking session ===
RESET PASSWORD: Full hash: #access_token=...&type=recovery&...
RESET PASSWORD: Hash params parsed: {
  accessToken: 'PRESENT',
  type: 'recovery',
  refreshToken: 'PRESENT'
}
RESET PASSWORD: Password recovery token detected in URL!
RESET PASSWORD: Token type is "recovery" - valid reset link
```

**Diagnosis:**

- **If the URL shows `/login` instead of `/reset-password`**:
  - **ROOT CAUSE**: Supabase redirect URL is misconfigured
  - **FIX**: Go to Supabase Dashboard → Authentication → URL Configuration
    - Site URL should be: `https://dpl-rey8.bolt.host` (NOT `/login`)
    - Redirect URLs should include: `https://dpl-rey8.bolt.host/reset-password`

- **If you reach `/reset-password` but see "Invalid or expired link"**:
  - Check if `type: 'recovery'` appears in the logs
  - Check if `accessToken: 'PRESENT'` appears in the logs
  - If missing, the URL is not including the proper hash parameters

- **If the page keeps redirecting**: Check for redirect loops in the console

### 4. Testing Login Flow

**Steps:**
1. Go to `/login`
2. Enter your email and password
3. Click "Sign In"
4. **Watch the console**

**What to look for:**

```
=== LOGIN: Form submitted ===
LOGIN: Email: your@email.com
LOGIN: Calling signIn...

=== AUTH CONTEXT: signIn called ===
AUTH CONTEXT signIn: Email: your@email.com
AUTH CONTEXT signIn: Response received
AUTH CONTEXT signIn: Error? NO
AUTH CONTEXT signIn: Session created: {
  user: 'your@email.com',
  expiresAt: '2024-...'
}

LOGIN: Sign in successful!
LOGIN: Checking current session...
LOGIN: Current session: EXISTS
LOGIN: Session user: your@email.com
LOGIN: Navigating to /dashboard

=== PROTECTED ROUTE: Checking authentication ===
PROTECTED ROUTE: Loading? false
PROTECTED ROUTE: User? EXISTS
PROTECTED ROUTE: User email: your@email.com
PROTECTED ROUTE: User authenticated, rendering protected content
```

**Diagnosis:**

- **If "Sign in successful" appears but then you're back at login**:
  - Look for "PROTECTED ROUTE: No user found, redirecting to /login"
  - This means the session exists during login but disappears before reaching dashboard
  - Check "AUTH STATE CHANGE" logs to see if session is being cleared
  - **Possible causes**:
    - Session not persisting between route changes
    - Auth state not being set properly
    - Race condition between navigation and session setup

- **If "Error? YES" appears**:
  - Check the error details logged below
  - Common errors:
    - "Invalid login credentials" = Wrong password
    - "Email not confirmed" = Email verification required
    - Network errors = Connection issues

- **If you see repeated PROTECTED ROUTE logs**:
  - You're in a redirect loop
  - User state is probably null when it shouldn't be

### 5. Testing Session Persistence

**Steps:**
1. Successfully log in
2. Refresh the page (F5)
3. **Watch the console**

**What to look for:**

```
=== AUTH CONTEXT: Initial setup ===
AUTH CONTEXT: Fetching initial session...
AUTH CONTEXT: Initial session fetched
AUTH CONTEXT: Session exists? YES
AUTH CONTEXT: Session user: your@email.com
AUTH CONTEXT: Setting loading to false

=== PROTECTED ROUTE: Checking authentication ===
PROTECTED ROUTE: Loading? false
PROTECTED ROUTE: User? EXISTS
PROTECTED ROUTE: User authenticated, rendering protected content
```

**Diagnosis:**

- **If "Session exists? NO" after refresh**: Session is not persisting
  - Check browser storage (Application tab → Local Storage)
  - Look for `sb-bexwcnmwpleoqvvmcwrg-auth-token`
  - If missing, sessions aren't being saved

- **If loading stays true forever**: Auth initialization is stuck

## Common Issues and Solutions

### Issue 1: "Send Reset Link" Button Does Nothing

**Symptoms:**
- No console logs appear when clicking the button
- Button doesn't show loading state

**Console Check:**
- Look for "FORGOT PASSWORD: Form submitted"
- If missing, the click handler isn't firing

**Solution:**
- Check if JavaScript is enabled
- Check for JavaScript errors in console
- Try clearing browser cache and reloading

### Issue 2: Password Reset Link Goes to Login Page

**Symptoms:**
- Email link takes you to `/login` instead of `/reset-password`
- No recovery token in URL

**Console Check:**
- N/A - This happens before reaching the app

**Solution:**
- **Go to Supabase Dashboard**: https://supabase.com/dashboard/project/bexwcnmwpleoqvvmcwrg
- Navigate to: **Authentication** → **URL Configuration**
- Check **Site URL**: Should be `https://dpl-rey8.bolt.host` (NOT including `/login`)
- Check **Redirect URLs**: Should include `https://dpl-rey8.bolt.host/reset-password`
- Go to: **Authentication** → **Email Templates**
- Select "Reset Password" or "Recovery" template
- Verify the `{{ .ConfirmationURL }}` is being used correctly

### Issue 3: Login Redirect Loop

**Symptoms:**
- After successful login, immediately redirected back to login page
- Dashboard flashes briefly then returns to login

**Console Check:**
```
LOGIN: Sign in successful!
LOGIN: Navigating to /dashboard
PROTECTED ROUTE: User? NULL
PROTECTED ROUTE: No user found, redirecting to /login
```

**Solution:**
- The session is being created but not set in React state fast enough
- Possible timing issue with auth state listener
- Try adding a small delay before navigation (workaround)
- Check if there are multiple auth state changes happening

### Issue 4: Invalid or Expired Reset Link

**Symptoms:**
- Reset password page shows "Invalid reset link" error
- Even with fresh email link

**Console Check:**
```
RESET PASSWORD: Hash params parsed: {
  accessToken: 'MISSING',
  type: 'MISSING'
}
```

**Solution:**
- Email link is not including the token parameters
- Check Supabase email template configuration
- Verify `{{ .ConfirmationURL }}` is in the email template
- Check if email provider is stripping URL parameters

## Next Steps

1. **Try Password Reset**:
   - Go through the forgot password flow
   - Copy ALL console output
   - Share the logs to identify the exact issue

2. **Try Login**:
   - Attempt to log in
   - Copy ALL console output
   - Look for where the session gets lost

3. **Check Supabase Configuration**:
   - Verify Site URL: `https://dpl-rey8.bolt.host`
   - Verify Redirect URLs include: `https://dpl-rey8.bolt.host/reset-password`
   - Check email template uses `{{ .ConfirmationURL }}`

## Important Supabase Configuration Checklist

Go to: https://supabase.com/dashboard/project/bexwcnmwpleoqvvmcwrg

### URL Configuration
- [ ] **Site URL** = `https://dpl-rey8.bolt.host`
- [ ] **Redirect URLs** includes:
  - `https://dpl-rey8.bolt.host/reset-password`
  - `https://dpl-rey8.bolt.host/**`
  - `http://localhost:5173/reset-password`
  - `http://localhost:5173/**`

### Email Templates
- [ ] "Reset Password" template uses `{{ .ConfirmationURL }}`
- [ ] Template subject line is set
- [ ] SMTP configured (if using custom email provider)

### Authentication Settings
- [ ] Email authentication is enabled
- [ ] Rate limits are reasonable (not blocking you)

## Summary

The comprehensive logging will show you exactly where the authentication flow breaks. Focus on:

1. **Does "Send Reset Link" trigger the request?** → Look for "FORGOT PASSWORD" logs
2. **Does the email link have the right URL?** → Should go to `/reset-password` not `/login`
3. **Does login create a session?** → Look for "Session created" log
4. **Does the session persist?** → Look for "PROTECTED ROUTE: User? EXISTS"

Share the console logs and we can pinpoint the exact issue!
