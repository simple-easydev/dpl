/*
  # Fix Organization Members RLS - Remove Duplicate Policies

  ## Problem
  There are duplicate SELECT policies on organization_members table:
  1. "Consolidated: View organization members" - Has nested subquery that can cause recursion
  2. "Members can view organization members" - Uses SECURITY DEFINER function (GOOD)
  
  The consolidated policy has a nested query on organization_members WITHIN the RLS check,
  which can cause infinite recursion issues.

  ## Solution
  1. Drop the problematic "Consolidated: View organization members" policy
  2. Keep only the "Members can view organization members" policy using SECURITY DEFINER
  3. Ensure platform admin policy exists separately
  4. Remove any other duplicate SELECT policies

  ## Changes
  - Remove duplicate SELECT policy with nested subquery
  - Keep policies that use SECURITY DEFINER functions only
  - Platform admins can view all members via separate policy

  ## Security
  - All access properly restricted to organization members
  - Platform admins have separate policy for full access
  - SECURITY DEFINER functions prevent RLS recursion
*/

-- Drop the problematic consolidated policy with nested subquery
DROP POLICY IF EXISTS "Consolidated: View organization members" ON organization_members;

-- Ensure the good policy using SECURITY DEFINER function exists
-- This policy allows regular users to view members of their organizations
DROP POLICY IF EXISTS "Members can view organization members" ON organization_members;
CREATE POLICY "Members can view organization members"
  ON organization_members FOR SELECT
  TO authenticated
  USING (
    is_organization_member(organization_id, auth.uid())
  );

-- Ensure platform admin policy exists (this is separate and takes priority)
DROP POLICY IF EXISTS "Platform admin can view all organization members" ON organization_members;
CREATE POLICY "Platform admin can view all organization members"
  ON organization_members FOR SELECT
  TO authenticated
  USING (is_platform_admin());

-- Clean up any other potential duplicate SELECT policies
DROP POLICY IF EXISTS "Users can view organization members" ON organization_members;
DROP POLICY IF EXISTS "Users can view members of their organizations" ON organization_members;
DROP POLICY IF EXISTS "Members can view their organization members" ON organization_members;

-- Add helpful comment
COMMENT ON TABLE organization_members IS 
  'Organization membership table with non-recursive RLS policies. Uses SECURITY DEFINER functions to prevent infinite loops. Only two SELECT policies: one for regular members using is_organization_member(), one for platform admin using is_platform_admin().';
