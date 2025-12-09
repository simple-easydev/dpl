/*
  # Fix Platform Admin Organization Creation - Auth Schema Access

  ## Problem
  The `create_organization_with_admin` function queries `auth.users` directly but
  doesn't have an explicit search_path set. This can cause schema cache issues
  similar to the `create_organization_with_owner` function.

  ## Solution
  Update the function to explicitly set search_path to include both 'public' and 'auth'
  schemas. This ensures:
  - Direct queries to auth.users work correctly
  - Foreign key constraints to auth.users are validated properly
  - auth.uid() function is accessible

  ## Changes
  1. Drop and recreate the function with explicit search_path
  2. All logic remains identical
  3. Security checks and audit logging unchanged

  ## Security
  - Function remains SECURITY DEFINER
  - Platform admin access check remains in place
  - All validation and audit logging preserved
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS create_organization_with_admin(text, uuid);

-- Recreate with explicit search_path including auth schema
CREATE OR REPLACE FUNCTION create_organization_with_admin(
  org_name text,
  admin_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_is_admin boolean;
  v_org_id uuid;
  v_user_exists boolean;
BEGIN
  -- Check if user is platform admin
  v_is_admin := is_platform_admin();
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Platform admin access required';
  END IF;

  -- Check if admin user exists in auth.users
  -- Now works correctly with auth schema in search_path
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = admin_user_id) INTO v_user_exists;
  
  IF NOT v_user_exists THEN
    RAISE EXCEPTION 'Admin user does not exist';
  END IF;

  -- Create the organization
  INSERT INTO organizations (name, created_by_platform_admin, created_by_admin_user_id)
  VALUES (org_name, true, auth.uid())
  RETURNING id INTO v_org_id;

  -- Add the admin user as an organization member with admin role
  INSERT INTO organization_members (organization_id, user_id, role, invited_by)
  VALUES (v_org_id, admin_user_id, 'admin', auth.uid());

  -- Log audit event
  INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, metadata)
  VALUES (
    v_org_id,
    auth.uid(),
    'create_organization_with_admin',
    'organization',
    v_org_id,
    jsonb_build_object(
      'organization_name', org_name,
      'admin_user_id', admin_user_id,
      'created_at', now()
    )
  );

  RETURN v_org_id;
END;
$$;

-- Grant execute permission to authenticated users (function checks platform admin internally)
GRANT EXECUTE ON FUNCTION create_organization_with_admin(text, uuid) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION create_organization_with_admin IS 
  'Platform admin function to create organization with specified admin user. Updated to include auth schema in search_path for proper access to auth.users table.';
