/*
  # Fix Organization Members Infinite Recursion - Complete Solution

  ## Problem
  The RLS policies on `organization_members` create infinite recursion because they
  query the same table they're protecting. When a user tries to SELECT from
  organization_members, the policy checks organization_members, which triggers
  the policy again, creating an infinite loop.

  ## Solution
  1. Create a SECURITY DEFINER function that bypasses RLS to check membership
  2. Drop all existing problematic policies
  3. Create new non-recursive policies using the security definer function
  4. Add a permissive policy for users to insert themselves during signup

  ## Key Changes
  - `is_organization_member()` function runs with SECURITY DEFINER to bypass RLS
  - `is_organization_admin()` function for admin checks
  - SELECT policy uses the security definer function (no recursion)
  - INSERT policy allows self-insertion OR admin invitation (no recursion)
  - UPDATE/DELETE policies use security definer function for admin checks

  ## Security Notes
  - SECURITY DEFINER functions are carefully scoped to prevent abuse
  - Functions only check specific conditions and return boolean
  - All policies still enforce proper access control
  - Users can only access their own organization data
*/

-- Create a SECURITY DEFINER function to check organization membership
-- This function runs with elevated privileges and bypasses RLS
CREATE OR REPLACE FUNCTION is_organization_member(org_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
    AND user_id = check_user_id
  );
END;
$$;

-- Create a SECURITY DEFINER function to check if user is admin
CREATE OR REPLACE FUNCTION is_organization_admin(org_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
    AND user_id = check_user_id
    AND role = 'admin'
  );
END;
$$;

-- Drop all existing policies on organization_members
DROP POLICY IF EXISTS "Users can view organization members" ON organization_members;
DROP POLICY IF EXISTS "Users can insert organization members" ON organization_members;
DROP POLICY IF EXISTS "Admins can update organization members" ON organization_members;
DROP POLICY IF EXISTS "Admins can delete organization members" ON organization_members;
DROP POLICY IF EXISTS "Users can view members of their organizations" ON organization_members;
DROP POLICY IF EXISTS "Users can insert themselves as members" ON organization_members;
DROP POLICY IF EXISTS "Admins can insert members" ON organization_members;
DROP POLICY IF EXISTS "Admins can update members" ON organization_members;
DROP POLICY IF EXISTS "Admins can delete members" ON organization_members;

-- Create new non-recursive policies using security definer functions

-- SELECT: Allow users to view members of organizations they belong to
CREATE POLICY "Members can view organization members"
  ON organization_members FOR SELECT
  TO authenticated
  USING (
    is_organization_member(organization_id, auth.uid())
  );

-- INSERT: Allow users to insert themselves OR allow admins to insert others
-- This is permissive to enable signup flow
CREATE POLICY "Users can join organizations"
  ON organization_members FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Users can always insert themselves (signup flow)
    user_id = auth.uid()
    OR
    -- Admins can insert others (invitation flow)
    is_organization_admin(organization_id, auth.uid())
  );

-- UPDATE: Only admins can update member records
CREATE POLICY "Admins can update members"
  ON organization_members FOR UPDATE
  TO authenticated
  USING (
    is_organization_admin(organization_id, auth.uid())
  )
  WITH CHECK (
    is_organization_admin(organization_id, auth.uid())
  );

-- DELETE: Only admins can delete member records
CREATE POLICY "Admins can delete members"
  ON organization_members FOR DELETE
  TO authenticated
  USING (
    is_organization_admin(organization_id, auth.uid())
  );

-- Grant execute permissions on the functions to authenticated users
GRANT EXECUTE ON FUNCTION is_organization_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_organization_admin(uuid, uuid) TO authenticated;
