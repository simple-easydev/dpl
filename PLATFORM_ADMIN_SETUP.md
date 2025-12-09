# Platform Admin Setup Guide

This guide will help you designate a user as the Platform Admin (Super Admin) for your application.

## What is a Platform Admin?

The Platform Admin is a special user account with elevated privileges:
- Can view and manage ALL brand organizations and their data
- Can invite new brands to the platform
- Has exclusive access to AI Training configurations
- Can view platform-wide analytics and statistics

## Prerequisites

Before you begin, ensure you have:
1. A Supabase account and project set up
2. At least one user account created in your application
3. Access to your Supabase SQL Editor or psql command line

## Step 1: Find Your User ID

You need to identify the user ID of the account you want to make the platform admin.

### Option A: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Users** in the left sidebar
3. Find the user you want to make platform admin
4. Copy their **User UID** (it looks like: `12345678-1234-1234-1234-123456789abc`)

### Option B: Using SQL Query

Run this query in the SQL Editor to see all users:

```sql
SELECT id, email, created_at
FROM auth.users
ORDER BY created_at DESC;
```

Copy the `id` of the user you want to designate as platform admin.

## Step 2: Set the Platform Admin

Once you have the user ID, run the following SQL command in your Supabase SQL Editor:

```sql
-- Replace 'YOUR-USER-ID-HERE' with the actual user ID from Step 1
INSERT INTO platform_admin_config (platform_admin_user_id)
VALUES ('YOUR-USER-ID-HERE')
ON CONFLICT ((true))
DO UPDATE SET
  platform_admin_user_id = EXCLUDED.platform_admin_user_id,
  updated_at = now();
```

**Important Notes:**
- Only ONE platform admin can exist at a time
- If a platform admin already exists, this command will update it to the new user
- The `ON CONFLICT` clause ensures this is safe to run multiple times

## Step 3: Verify the Setup

To verify the platform admin was set correctly, run:

```sql
SELECT
  pac.platform_admin_user_id,
  au.email as admin_email,
  pac.created_at,
  pac.updated_at
FROM platform_admin_config pac
JOIN auth.users au ON au.id = pac.platform_admin_user_id;
```

You should see output showing:
- The user ID
- The email address of the platform admin
- When the configuration was created and last updated

## Step 4: Test Platform Admin Access

1. Sign in to your application using the platform admin user account
2. You should now see:
   - A "Platform Admin" button in the top navigation bar
   - An "AI Training" menu item in the sidebar (under General)
3. Click "Platform Admin" to access the super admin dashboard
4. You should see:
   - Total organizations (brands)
   - Total users across all brands
   - Platform-wide revenue statistics
   - List of all client organizations

## Troubleshooting

### Platform Admin button not showing up

If the platform admin button doesn't appear after setup:

1. **Sign out and sign back in**: The admin status is checked when you authenticate
2. **Clear browser cache**: Sometimes cached data can prevent UI updates
3. **Verify the database entry**: Run the verification query from Step 3
4. **Check the user ID matches**: Ensure you used the correct user ID

### Cannot access AI Training page

If you can access the Platform Admin dashboard but not AI Training:

1. Make sure you're signed in as the platform admin user
2. Check that the RLS policies were applied correctly:

```sql
SELECT tablename, policyname
FROM pg_policies
WHERE tablename = 'ai_training_configurations'
AND policyname LIKE '%Platform admin%';
```

You should see four policies for SELECT, INSERT, UPDATE, and DELETE.

## Changing the Platform Admin

To designate a different user as platform admin:

1. Find the new user's ID (follow Step 1)
2. Run the UPDATE command:

```sql
UPDATE platform_admin_config
SET
  platform_admin_user_id = 'NEW-USER-ID-HERE',
  updated_at = now();
```

3. The previous admin will immediately lose platform admin privileges
4. The new admin will gain privileges on their next login

## Security Best Practices

1. **Limit Access**: Only designate trusted administrators as platform admin
2. **Audit Regularly**: Review the audit logs to monitor platform admin activities
3. **Document Changes**: Keep a record of when platform admin changes are made
4. **Use Strong Authentication**: Ensure the platform admin account has a strong password and 2FA enabled

## What Platform Admin Can See

The platform admin has read/write access to:
- All organizations (brands) and their settings
- All users across all organizations
- All sales data, accounts, and products
- All uploads and data processing history
- All tasks, alerts, and audit logs
- All inventory data
- All distributors and FOB pricing configurations
- All AI training configurations (exclusive access)

## What Platform Admin Cannot Do

Platform admin restrictions:
- Cannot delete the platform_admin_config table
- Cannot bypass application-level business logic
- Does not have direct database admin rights (only via Supabase dashboard)

## Need Help?

If you encounter issues:
1. Check the Supabase logs for any error messages
2. Verify all migrations have been applied successfully
3. Ensure the `platform_admin_config` table exists in your database
4. Check that the `is_platform_admin()` function exists and works correctly

## Example: Complete Setup Process

Here's a complete example from start to finish:

```sql
-- 1. Find your user ID
SELECT id, email FROM auth.users WHERE email = 'admin@example.com';
-- Result: id = '12345678-1234-1234-1234-123456789abc'

-- 2. Set as platform admin
INSERT INTO platform_admin_config (platform_admin_user_id)
VALUES ('12345678-1234-1234-1234-123456789abc')
ON CONFLICT ((true))
DO UPDATE SET
  platform_admin_user_id = EXCLUDED.platform_admin_user_id,
  updated_at = now();

-- 3. Verify setup
SELECT
  pac.platform_admin_user_id,
  au.email as admin_email,
  pac.created_at
FROM platform_admin_config pac
JOIN auth.users au ON au.id = pac.platform_admin_user_id;

-- 4. Test the function
SELECT is_platform_admin();
-- Result should be: true (when running as the platform admin user)
```

---

**Note**: After completing this setup, the designated user will have full platform admin capabilities immediately upon their next login.
