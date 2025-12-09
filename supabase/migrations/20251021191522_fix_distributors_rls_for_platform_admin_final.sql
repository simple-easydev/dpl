/*
  # Fix Distributors RLS Policies for Platform Admin

  ## Overview
  This migration ensures platform admins can view ALL distributors (both global and custom)
  by consolidating the SELECT policies properly.

  ## Problem
  The current SELECT policies are split:
  - "Users can view global distributors" - only shows global distributors
  - "Users can view their organization's custom distributors" - only shows org's custom distributors
  
  Platform admins need to see ALL distributors across all organizations.

  ## Solution
  Drop the split SELECT policies and create a unified policy that allows:
  1. All users to see global distributors
  2. Organization members to see their organization's custom distributors  
  3. Platform admins to see ALL distributors (global + all custom from all orgs)

  ## Security
  - Regular users still only see global distributors and their org's custom distributors
  - Platform admins get full visibility via is_platform_admin() check
*/

-- Drop the old split SELECT policies
DROP POLICY IF EXISTS "Users can view global distributors" ON distributors;
DROP POLICY IF EXISTS "Users can view their organization's custom distributors" ON distributors;

-- Create unified SELECT policy that handles all cases
CREATE POLICY "Users can view distributors"
  ON distributors FOR SELECT
  TO authenticated
  USING (
    -- Platform admin can see all distributors
    is_platform_admin()
    OR
    -- All users can see global distributors
    is_global = true
    OR
    -- Users can see their organization's custom distributors
    (
      is_global = false
      AND organization_id IN (
        SELECT organization_id 
        FROM organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- Ensure platform admin policy has proper WITH CHECK clause
DROP POLICY IF EXISTS "Platform admin can manage all distributors" ON distributors;
CREATE POLICY "Platform admin can manage all distributors"
  ON distributors FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());
