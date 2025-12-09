/*
  # Fix Organization Members RLS Policies - Remove Conflicting Policies

  ## Problem
  There are duplicate and conflicting RLS policies on the `organization_members` table:
  1. "Members can view organization members" - Uses is_organization_member() function (GOOD)
  2. "Users can view organization members" - Uses nested subquery on organization_members (BAD - potential recursion)
  
  The nested subquery in policy #2 can cause issues because it queries organization_members
  within the RLS check for organization_members, potentially creating circular dependencies.

  ## Solution
  1. Drop the conflicting "Users can view organization members" policy
  2. Keep the "Members can view organization members" policy which uses the SECURITY DEFINER function
  3. Ensure all other policies use SECURITY DEFINER functions to avoid recursion
  4. Add platform admin policies if missing

  ## Changes
  - Remove duplicate/conflicting SELECT policy on organization_members
  - Ensure consistent use of is_organization_member() and is_organization_admin() functions
  - Keep policies simple and non-recursive

  ## Security
  - All access still properly restricted to organization members
  - Platform admins can view and manage all organization members
  - SECURITY DEFINER functions prevent RLS recursion while maintaining security
*/

-- Drop the conflicting policy that has nested subqueries
DROP POLICY IF EXISTS "Users can view organization members" ON organization_members;

-- Ensure we have the good policy using is_organization_member function
-- Drop and recreate to make sure it's correct
DROP POLICY IF EXISTS "Members can view organization members" ON organization_members;
CREATE POLICY "Members can view organization members"
  ON organization_members FOR SELECT
  TO authenticated
  USING (
    is_organization_member(organization_id, auth.uid())
  );

-- Ensure platform admin policies exist
DROP POLICY IF EXISTS "Platform admin can view all organization members" ON organization_members;
CREATE POLICY "Platform admin can view all organization members"
  ON organization_members FOR SELECT
  TO authenticated
  USING (is_platform_admin());

DROP POLICY IF EXISTS "Platform admin can manage organization members" ON organization_members;
CREATE POLICY "Platform admin can manage organization members"
  ON organization_members FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Ensure insert policies exist and are correct
DROP POLICY IF EXISTS "Users can insert themselves as members" ON organization_members;
CREATE POLICY "Users can insert themselves as members"
  ON organization_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can invite other members" ON organization_members;
CREATE POLICY "Admins can invite other members"
  ON organization_members FOR INSERT
  TO authenticated
  WITH CHECK (
    is_organization_admin(organization_id, auth.uid())
  );

-- Ensure update policy exists and is correct
DROP POLICY IF EXISTS "Admins can update member roles" ON organization_members;
CREATE POLICY "Admins can update member roles"
  ON organization_members FOR UPDATE
  TO authenticated
  USING (is_organization_admin(organization_id, auth.uid()))
  WITH CHECK (is_organization_admin(organization_id, auth.uid()));

-- Ensure delete policy exists and is correct
DROP POLICY IF EXISTS "Admins can remove members" ON organization_members;
CREATE POLICY "Admins can remove members"
  ON organization_members FOR DELETE
  TO authenticated
  USING (is_organization_admin(organization_id, auth.uid()));

-- Add helpful comment
COMMENT ON TABLE organization_members IS 
  'Organization membership table with non-recursive RLS policies using SECURITY DEFINER functions to prevent infinite loops.';
