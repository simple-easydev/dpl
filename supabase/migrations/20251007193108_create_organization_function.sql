/*
  # Create Organization Function

  ## Purpose
  This migration creates a secure database function to handle organization creation
  atomically. The function creates both the organization and adds the creator as an
  admin member in a single transaction, bypassing RLS concerns during the controlled
  creation workflow.

  ## Changes
  1. Create `create_organization_with_owner` function that:
     - Takes organization name as input
     - Creates a new organization
     - Automatically adds the calling user as an admin member
     - Returns the created organization with user's role
     - Runs with SECURITY DEFINER to bypass RLS during creation

  ## Security Notes
  - Function is SECURITY DEFINER (runs with elevated privileges)
  - Only authenticated users can call this function
  - Function validates input and ensures data integrity
  - User is always assigned as 'admin' role for organizations they create
  - All operations are atomic (wrapped in function transaction)
*/

-- Create a secure function to create an organization and add the user as an admin
CREATE OR REPLACE FUNCTION create_organization_with_owner(org_name text)
RETURNS TABLE (
  id uuid,
  name text,
  role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
  calling_user_id uuid;
BEGIN
  -- Get the current user ID
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
  'Creates a new organization and adds the calling user as an admin member. This function handles both operations atomically to avoid RLS policy conflicts during organization creation.';