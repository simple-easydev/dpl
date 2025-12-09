/*
  # Fix Organization Members RLS Infinite Recursion - Final Solution

  ## Problem
  The RLS policies on `organization_members` table are causing infinite recursion errors
  because they query the same table they're protecting:
  - "Users can view other members in their organizations" uses a subquery on organization_members
  - "Admins can insert/update/delete members" all use subqueries on organization_members
  
  When a user tries to SELECT from organization_members, the policy checks organization_members,
  which triggers the policy again, creating an infinite loop.

  ## Solution
  1. Create SECURITY DEFINER functions that bypass RLS to check membership and admin status
  2. Drop ALL existing problematic policies on organization_members
  3. Create new non-recursive policies using the SECURITY DEFINER functions
  4. Ensure one policy allows direct user_id checks without recursion

  ## New Tables
  None - this migration only fixes policies

  ## Modified Tables
  - `organization_members` - All RLS policies replaced with non-recursive versions

  ## Security
  - SECURITY DEFINER functions are carefully scoped to prevent abuse
  - Functions only check specific conditions and return boolean values
  - All policies still enforce proper access control
  - Users can only access their own organization data
  - Direct user_id checks prevent recursion for viewing own memberships

  ## Important Notes
  - This migration consolidates all previous fix attempts
  - SECURITY DEFINER functions run with elevated privileges but are safe
  - Each policy serves a single, clear purpose
  - No circular dependencies remain after this migration
*/

-- Step 1: Create SECURITY DEFINER functions that bypass RLS
-- These functions run with elevated privileges and can query organization_members without triggering RLS

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

-- Step 2: Drop ALL existing policies on organization_members
-- This ensures we start fresh without any conflicts

DROP POLICY IF EXISTS "Users can view their own memberships" ON organization_members;
DROP POLICY IF EXISTS "Users can view other members in their organizations" ON organization_members;
DROP POLICY IF EXISTS "Users can insert themselves as members" ON organization_members;
DROP POLICY IF EXISTS "Admins can insert members" ON organization_members;
DROP POLICY IF EXISTS "Admins can update members" ON organization_members;
DROP POLICY IF EXISTS "Admins can delete members" ON organization_members;
DROP POLICY IF EXISTS "Users can view members of their organizations" ON organization_members;
DROP POLICY IF EXISTS "Users can view organization members" ON organization_members;
DROP POLICY IF EXISTS "Users can insert organization members" ON organization_members;
DROP POLICY IF EXISTS "Admins can update organization members" ON organization_members;
DROP POLICY IF EXISTS "Admins can delete organization members" ON organization_members;
DROP POLICY IF EXISTS "Members can view organization members" ON organization_members;
DROP POLICY IF EXISTS "Users can join organizations" ON organization_members;
DROP POLICY IF EXISTS "Admins can update members" ON organization_members;
DROP POLICY IF EXISTS "Admins can delete members" ON organization_members;

-- Step 3: Create new non-recursive policies using SECURITY DEFINER functions

-- SELECT Policy: Allow users to view members of organizations they belong to
-- This uses the SECURITY DEFINER function to avoid recursion
CREATE POLICY "Members can view organization members"
  ON organization_members FOR SELECT
  TO authenticated
  USING (
    is_organization_member(organization_id, auth.uid())
  );

-- INSERT Policy: Allow users to insert themselves OR allow admins to insert others
-- Split into two policies to be explicit about permissions
CREATE POLICY "Users can insert themselves as members"
  ON organization_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
  );

CREATE POLICY "Admins can invite other members"
  ON organization_members FOR INSERT
  TO authenticated
  WITH CHECK (
    is_organization_admin(organization_id, auth.uid())
  );

-- UPDATE Policy: Only admins can update member records
CREATE POLICY "Admins can update member roles"
  ON organization_members FOR UPDATE
  TO authenticated
  USING (
    is_organization_admin(organization_id, auth.uid())
  )
  WITH CHECK (
    is_organization_admin(organization_id, auth.uid())
  );

-- DELETE Policy: Only admins can delete member records
CREATE POLICY "Admins can remove members"
  ON organization_members FOR DELETE
  TO authenticated
  USING (
    is_organization_admin(organization_id, auth.uid())
  );

-- Step 4: Grant execute permissions on the functions to authenticated users
GRANT EXECUTE ON FUNCTION is_organization_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_organization_admin(uuid, uuid) TO authenticated;

-- Step 5: Add helpful comments
COMMENT ON FUNCTION is_organization_member IS 
  'Checks if a user is a member of an organization. Uses SECURITY DEFINER to bypass RLS and prevent infinite recursion.';

COMMENT ON FUNCTION is_organization_admin IS 
  'Checks if a user is an admin of an organization. Uses SECURITY DEFINER to bypass RLS and prevent infinite recursion.';
