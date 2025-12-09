# SaaS Setup Guide

This guide explains how to complete the setup for the SaaS features including Stripe payments, email notifications, and subscription management.

## Overview

The application now includes:

1. **Stripe Payment Integration** - Complete checkout and billing management
2. **Email Service** - Professional transactional emails via Resend
3. **Subscription Enforcement** - Access control based on subscription status
4. **Trial Countdown Banner** - Visual reminders for trial expiration
5. **Public Pricing Page** - Customer acquisition and conversion tool

## Environment Variables Setup

Add the following variables to your `.env` file:

```env
# Stripe Configuration
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...  # Your Stripe publishable key
VITE_STRIPE_PRICE_ID=price_...           # Your Stripe price ID for $500/month plan
```

### Getting Stripe Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Navigate to Developers → API Keys
3. Copy the **Publishable key** (starts with `pk_test_` or `pk_live_`)
4. Create a product and price:
   - Go to Products → Add Product
   - Set price to $500/month (recurring)
   - Copy the **Price ID** (starts with `price_`)

## Supabase Edge Function Secrets

The following secrets need to be configured in your Supabase project:

```bash
# Stripe Secret Key (for server-side operations)
STRIPE_SECRET_KEY=sk_test_...

# Stripe Webhook Secret (for webhook signature verification)
STRIPE_WEBHOOK_SECRET=whsec_...

# Resend API Key (for sending emails)
RESEND_API_KEY=re_...
```

### Setting Secrets in Supabase

Using the Supabase CLI:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_your_key_here
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
supabase secrets set RESEND_API_KEY=re_your_resend_key_here
```

Or via the Supabase Dashboard:
1. Go to Project Settings → Edge Functions
2. Add each secret with its corresponding value

### Getting Resend API Key

1. Sign up at [Resend](https://resend.com)
2. Go to API Keys
3. Create a new API key
4. Copy the key (starts with `re_`)

### Configuring Stripe Webhook

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Navigate to Developers → Webhooks
3. Click "Add endpoint"
4. Set the URL to: `https://[your-project-id].supabase.co/functions/v1/stripe-webhook`
5. Select the following events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
6. Copy the **Signing secret** (starts with `whsec_`)
7. Add it to Supabase secrets as `STRIPE_WEBHOOK_SECRET`

## Edge Functions Deployed

The following Supabase Edge Functions have been deployed:

1. **stripe-webhook** - Handles Stripe payment events
2. **create-checkout** - Creates Stripe checkout sessions
3. **create-portal-session** - Creates Stripe customer portal sessions
4. **send-email** - Sends transactional emails via Resend
5. **send-invitation** - Sends team invitation emails (existing)
6. **resend-invitation** - Resends team invitation emails (existing)

## Features Implemented

### 1. Stripe Payment Integration

**Files:**
- `src/lib/stripe.ts` - Stripe client configuration
- `src/lib/stripeService.ts` - Checkout and portal session creation
- `supabase/functions/stripe-webhook/` - Webhook handler
- `supabase/functions/create-checkout/` - Checkout session creation
- `supabase/functions/create-portal-session/` - Billing portal access

**How it works:**
- Users in trial can click "Upgrade" to start checkout
- Stripe handles payment collection
- Webhooks update subscription status in database
- Users can manage billing via Stripe Customer Portal

### 2. Email Service

**Files:**
- `src/lib/emailService.ts` - Email templates (HTML)
- `supabase/functions/send-email/` - Email sending via Resend

**Email Templates:**
- Team invitation emails
- Trial expiration warnings (7, 3, 1 days)
- Payment failure notifications
- Welcome emails for new organizations
- Subscription activation confirmations

**Customization:**
All email templates are in `src/lib/emailService.ts` and can be customized with your branding.

### 3. Subscription Enforcement

**Files:**
- `src/components/SubscriptionGate.tsx` - Access control component
- `src/components/ProtectedRoute.tsx` - Updated to enforce subscriptions
- `src/lib/subscriptionService.ts` - Subscription status checking

**How it works:**
- All protected routes check subscription status
- Trial users have 14 days of full access
- After trial, users must upgrade to continue
- Past due payments get 3-day grace period
- Access blocked page shows upgrade options

### 4. Trial Countdown Banner

**Files:**
- `src/components/TrialBanner.tsx` - Banner component
- Updated `src/components/DashboardLayout.tsx` - Banner integration

**Features:**
- Shows remaining trial days
- Color-coded urgency (blue → yellow → orange → red)
- Dismissible (per session)
- Direct upgrade button
- Shows payment method update for failed payments

### 5. Public Pricing Page

**Files:**
- `src/pages/PricingPage.tsx` - Public pricing page
- Updated `src/App.tsx` - Added `/pricing` route
- Updated `src/pages/Login.tsx` - Added pricing link
- Updated `src/pages/SignUp.tsx` - Updated messaging for trial

**Features:**
- Clean, professional design
- Feature list with icons
- FAQ section
- Multiple CTAs to signup
- Emphasizes 14-day free trial
- No credit card required messaging

### 6. Settings Page Integration

**Updated:**
- `src/pages/SettingsPage.tsx` - Added Stripe billing buttons

**Features:**
- "Upgrade to Pro" button for trial users
- "Manage Billing" button for existing customers
- Subscription status display
- Links to Stripe Customer Portal

## Testing the Flow

### 1. Test Trial Flow

1. Sign up for a new account
2. Observe 14-day trial status in settings
3. See trial countdown banner in dashboard
4. Navigate pages - all should be accessible

### 2. Test Upgrade Flow

1. Click "Upgrade Now" in banner or settings
2. Complete Stripe checkout (use test card: 4242 4242 4242 4242)
3. Verify subscription status changes to "active"
4. Banner should disappear

### 3. Test Payment Failure

1. Use Stripe test card that declines: 4000 0000 0000 0341
2. Wait for webhook to update status to "past_due"
3. Banner should show "Update Payment Method"
4. Settings should show payment required message

### 4. Test Trial Expiration

In development, you can manually update the subscription:

```sql
-- Update trial end date to test expiration
UPDATE subscriptions
SET current_period_end = NOW() - INTERVAL '1 day'
WHERE organization_id = 'your-org-id';

UPDATE subscriptions
SET status = 'trialing'
WHERE organization_id = 'your-org-id';
```

## Stripe Test Cards

Use these test cards in development:

- **Success:** 4242 4242 4242 4242
- **Payment Fails:** 4000 0000 0000 0341
- **Authentication Required:** 4000 0025 0000 3155

All test cards:
- Any future expiration date
- Any 3-digit CVC
- Any postal code

## Production Checklist

Before going live:

- [ ] Switch Stripe keys from test to live mode
- [ ] Update Stripe webhook URL to production
- [ ] Configure Resend with verified domain
- [ ] Set up Stripe customer portal configuration
- [ ] Test complete payment flow in production
- [ ] Verify all webhooks are working
- [ ] Set up monitoring for failed payments
- [ ] Configure email sending limits
- [ ] Test trial expiration notifications
- [ ] Update pricing page with real information

## Architecture Notes

### Subscription Status Flow

```
New Organization
    ↓
Status: 'trialing'
Current Period End: +14 days
    ↓
User Completes Checkout
    ↓
Webhook: subscription.created/updated
    ↓
Status: 'active'
    ↓
Monthly Billing
    ↓
Payment Success → Status: 'active'
Payment Fails → Status: 'past_due' (3 day grace)
    ↓
User Cancels → Status: 'canceled'
```

### Access Control Logic

```typescript
hasAccess =
  isActive ||
  isTrialing ||
  (isPastDue && daysLeftInGrace >= -3)
```

### Email Triggers

Currently, emails are configured to be sent via the edge functions but the actual scheduling/triggering needs to be implemented based on your requirements:

- Trial expiration warnings: Set up scheduled jobs
- Payment failures: Triggered by Stripe webhooks
- Invitations: Triggered by user action

## Troubleshooting

### Webhooks not working

1. Check Supabase function logs
2. Verify webhook secret matches Stripe
3. Test webhook endpoint with Stripe CLI:
   ```bash
   stripe listen --forward-to https://your-project.supabase.co/functions/v1/stripe-webhook
   ```

### Emails not sending

1. Verify Resend API key is set correctly
2. Check Supabase function logs
3. Verify domain is verified in Resend (for production)
4. Check email templates are not malformed

### Subscription not updating

1. Check Stripe webhook is configured
2. Verify webhook events are being received
3. Check Supabase function logs for errors
4. Verify database RLS policies allow updates

## Support

For issues with:
- **Stripe Integration:** [Stripe Docs](https://stripe.com/docs)
- **Resend Email:** [Resend Docs](https://resend.com/docs)
- **Supabase Edge Functions:** [Supabase Docs](https://supabase.com/docs/guides/functions)

## Security Considerations

1. **Never expose secret keys** - Only use publishable keys in frontend
2. **Always verify webhooks** - Use webhook signatures
3. **Use RLS policies** - Restrict direct database access
4. **Validate subscription status** - Check before granting access
5. **Log security events** - Use audit_logs table for compliance

## Next Steps

1. Customize email templates with your branding
2. Set up scheduled jobs for trial expiration emails
3. Configure Stripe Customer Portal settings
4. Add additional payment methods if needed
5. Set up monitoring and alerting
6. Create admin dashboard for subscription management
