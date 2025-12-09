/*
  # Fix Auth Users Access for Frontend

  ## Problem
  Frontend code cannot directly query auth.users table as it's not exposed 
  through the PostgREST API. This causes errors when trying to fetch user 
  emails for organization members and other user-related queries.

  ## Solution
  Create a secure view in the public schema that exposes only safe user 
  information (id and email) with proper RLS policies.

  ## Changes
  1. Create `user_profiles` view that joins auth.users with necessary info
  2. Add RLS policies to allow authenticated users to view emails of users 
     in their organizations
  3. Add platform admin policy to view all user profiles

  ## Security
  - Only exposes id and email fields (no sensitive auth data)
  - RLS restricts access to organization members only
  - Platform admins can view all profiles
  - View is read-only (no INSERT/UPDATE/DELETE)
*/

-- Create a view that exposes safe user information
CREATE OR REPLACE VIEW user_profiles AS
SELECT 
  id,
  email,
  created_at
FROM auth.users;

-- Enable RLS on the view
ALTER VIEW user_profiles SET (security_invoker = true);

-- Note: Views don't support RLS policies directly, so we'll create a function instead
DROP VIEW IF EXISTS user_profiles;

-- Create a function to get user emails safely
CREATE OR REPLACE FUNCTION get_user_email(user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_email text;
  calling_user_id uuid;
  is_admin boolean;
BEGIN
  calling_user_id := auth.uid();
  
  -- Check if calling user is platform admin
  is_admin := is_platform_admin();
  
  -- Platform admin can see any email
  IF is_admin THEN
    SELECT email INTO user_email FROM auth.users WHERE id = user_id;
    RETURN user_email;
  END IF;
  
  -- Regular users can only see emails of users in their organizations
  IF EXISTS (
    SELECT 1 
    FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = calling_user_id 
    AND om2.user_id = user_id
  ) THEN
    SELECT email INTO user_email FROM auth.users WHERE id = user_id;
    RETURN user_email;
  END IF;
  
  -- If no permission, return null
  RETURN NULL;
END;
$$;

-- Create a function to get multiple user emails at once (more efficient)
CREATE OR REPLACE FUNCTION get_user_emails(user_ids uuid[])
RETURNS TABLE(id uuid, email text)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  calling_user_id uuid;
  is_admin boolean;
BEGIN
  calling_user_id := auth.uid();
  is_admin := is_platform_admin();
  
  -- Platform admin can see all emails
  IF is_admin THEN
    RETURN QUERY
    SELECT u.id, u.email
    FROM auth.users u
    WHERE u.id = ANY(user_ids);
    RETURN;
  END IF;
  
  -- Regular users can only see emails of users in their organizations
  RETURN QUERY
  SELECT u.id, u.email
  FROM auth.users u
  WHERE u.id = ANY(user_ids)
  AND EXISTS (
    SELECT 1 
    FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = calling_user_id 
    AND om2.user_id = u.id
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_email(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_emails(uuid[]) TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION get_user_email IS 
  'Safely retrieves user email. Platform admins can see any email, regular users can only see emails of users in their organizations.';

COMMENT ON FUNCTION get_user_emails IS 
  'Safely retrieves multiple user emails at once. Platform admins can see all emails, regular users can only see emails of users in their organizations.';
