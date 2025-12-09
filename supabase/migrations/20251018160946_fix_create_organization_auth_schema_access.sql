/*
  # Fix Organization Creation Function - Auth Schema Access

  ## Problem
  The `create_organization_with_owner` function has `SET search_path TO 'public'` which
  prevents it from properly validating foreign key constraints to `auth.users` during
  organization_members insertion. This causes the "Cannot find table 'public.auth.users'
  in schema cache" error.

  ## Solution
  Update the function to use `SET search_path TO 'public', 'auth'` to allow access to
  both schemas. This enables the function to:
  - Access public schema tables (organizations, organization_members)
  - Validate foreign key constraints to auth.users
  - Use auth.uid() function properly

  ## Changes
  1. Drop and recreate the `create_organization_with_owner` function with corrected search_path
  2. Function logic remains identical, only search_path is updated
  3. All security and validation checks remain in place

  ## Security
  - Function remains SECURITY DEFINER (runs with elevated privileges)
  - Only authenticated users can execute
  - Input validation ensures data integrity
  - Search path explicitly set to prevent SQL injection
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS create_organization_with_owner(text);

-- Recreate with proper search_path that includes auth schema
CREATE OR REPLACE FUNCTION create_organization_with_owner(org_name text)
RETURNS TABLE (
  id uuid,
  name text,
  role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  new_org_id uuid;
  calling_user_id uuid;
BEGIN
  -- Get the current user ID (auth.uid() is now accessible)
  calling_user_id := auth.uid();
  
  -- Validate that we have a user
  IF calling_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated to create an organization';
  END IF;
  
  -- Validate organization name
  IF org_name IS NULL OR trim(org_name) = '' THEN
    RAISE EXCEPTION 'Organization name cannot be empty';
  END IF;
  
  -- Create the organization
  INSERT INTO organizations (name)
  VALUES (trim(org_name))
  RETURNING organizations.id INTO new_org_id;
  
  -- Add the user as an admin member
  -- This now works because search_path includes 'auth' for FK validation
  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (new_org_id, calling_user_id, 'admin');
  
  -- Return the organization details with role
  RETURN QUERY
  SELECT new_org_id, trim(org_name), 'admin'::text;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_organization_with_owner(text) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION create_organization_with_owner IS 
  'Creates a new organization and adds the calling user as an admin member. Updated to include auth schema in search_path for proper foreign key validation to auth.users.';
