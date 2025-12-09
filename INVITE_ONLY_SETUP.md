# Invite-Only Platform Setup

This platform is now configured as an **invite-only system** without Stripe payment integration.

## What Changed

### Removed Features
1. **Stripe Payment Integration** - All payment processing has been removed
2. **Subscription Management** - No subscription checks or trial periods
3. **Public Signup** - Users cannot create their own accounts
4. **Pricing Page** - Removed from the application

### Current Access Model
- **Invite-Only Access**: Only users who receive an invitation can join
- **No Payment Required**: All features are accessible to invited users
- **Multi-Organization Support**: Maintains organization-based data isolation
- **Role-Based Permissions**: Admin, Member, and Viewer roles still work

## How to Invite Users

### 1. As an Admin, Navigate to Settings
- Log in to your account
- Go to **Dashboard → Settings**
- Click on the **Team** tab

### 2. Send an Invitation
1. Enter the user's email address
2. Select their role (Admin, Member, or Viewer)
3. Click "Send Invitation"

### 3. User Receives Email
- The invited user receives an email with a secure invitation link
- They click the link to create their account
- They automatically join your organization

## Email Configuration

The platform uses **Resend** to send invitation emails.

### Setup Resend (Optional but Recommended)

1. **Sign up for Resend**
   - Go to [resend.com](https://resend.com)
   - Create a free account (50,000 emails/month free)

2. **Get Your API Key**
   - Navigate to API Keys in your Resend dashboard
   - Create a new API key
   - Copy the key (starts with `re_`)

3. **Add to Supabase Secrets**
   ```bash
   # In your Supabase dashboard, go to Project Settings → Edge Functions
   # Add a new secret:
   RESEND_API_KEY=re_your_actual_api_key_here
   ```

4. **Verify Your Domain (For Production)**
   - In Resend dashboard, go to Domains
   - Add your domain and follow DNS verification steps
   - This ensures high deliverability of invitation emails

### Alternative: Without Resend

If you don't configure Resend:
- Invitations will still be created in the database
- You can manually share invitation links with users
- Find invitation tokens in the database `invitations` table
- Construct links: `https://your-domain.com/accept-invite?token_hash=[token]&type=invite`

## User Access Flow

```
Admin sends invitation
    ↓
User receives email
    ↓
User clicks invitation link
    ↓
User creates account (via Supabase Auth)
    ↓
User automatically joins organization
    ↓
User gets full access to platform
```

## Security Features

- **Row Level Security (RLS)**: Data isolated by organization
- **Role-Based Access**: Admins, Members, and Viewers have different permissions
- **Secure Invitations**: Tokens expire after 7 days
- **Audit Logging**: All invitations and access tracked

## Managing Organizations

### Creating an Organization
When you first sign up (or are invited), an organization is automatically created for you.

### Viewing Members
- Go to **Settings → Team**
- See all current members
- View pending invitations
- Revoke or resend invitations

### Managing Permissions
Roles determine what users can do:
- **Admin**: Full access, can invite users, manage settings
- **Member**: Can view and edit most data
- **Viewer**: Read-only access to data

## Database Tables Used

The invite system uses these Supabase tables:
- `organizations` - Organization information
- `organization_members` - User-organization relationships
- `invitations` - Pending and accepted invitations
- `audit_logs` - Activity tracking

These tables remain in your database but subscription-related fields are unused.

## Supabase Edge Functions

These functions handle invitations:
- `send-invitation` - Sends invitation emails
- `resend-invitation` - Resends existing invitations
- `send-email` - Generic email sending function

These functions remain deployed and active.

## Next Steps

1. **Set up Resend** (optional) - Configure email delivery
2. **Invite your first user** - Use the Settings → Team page
3. **Test the invitation flow** - Ensure emails are delivered
4. **Set up your organization** - Add company information in Settings

## Troubleshooting

### Invitations Not Being Sent
- Check that RESEND_API_KEY is configured in Supabase secrets
- Verify your Resend account is active
- Check Supabase Edge Function logs for errors

### Users Can't Access
- Ensure they clicked the invitation link
- Check invitation hasn't expired (7-day limit)
- Verify they completed account creation

### Email Not Received
- Check spam folder
- Verify email address is correct
- Try resending the invitation
- Check Resend dashboard for delivery status

## Support

For issues with:
- **Supabase**: [Supabase Documentation](https://supabase.com/docs)
- **Resend**: [Resend Documentation](https://resend.com/docs)
- **Invitations**: Check audit logs in Settings → Security

## Technical Notes

### Files Removed
- `/src/lib/stripe.ts` - Stripe client
- `/src/lib/stripeService.ts` - Stripe operations
- `/src/lib/subscriptionService.ts` - Subscription logic
- `/src/components/SubscriptionGate.tsx` - Subscription enforcement
- `/src/components/TrialBanner.tsx` - Trial countdown
- `/src/pages/PricingPage.tsx` - Pricing information
- `/src/pages/SignUp.tsx` - Public signup
- `/supabase/functions/create-checkout/` - Stripe checkout
- `/supabase/functions/create-portal-session/` - Billing portal
- `/supabase/functions/stripe-webhook/` - Payment webhooks

### Files Modified
- `/src/App.tsx` - Removed signup and pricing routes
- `/src/pages/Login.tsx` - Added invite-only messaging
- `/src/components/ProtectedRoute.tsx` - Removed subscription checks
- `/src/components/DashboardLayout.tsx` - Removed trial banner
- `/src/pages/SettingsPage.tsx` - Removed billing tab
- `/package.json` - Removed Stripe packages
- `/.env` - Removed Stripe configuration

### Database Schema
No database changes were made. Tables remain for potential future use:
- `subscriptions` table exists but is unused
- `invitations` table is actively used
- `audit_logs` table tracks invitation activity
