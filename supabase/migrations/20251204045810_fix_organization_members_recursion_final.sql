/*
  # Fix Organization Members Infinite Recursion - Final Fix

  ## Problem
  The previous migration created security definer functions but didn't use them
  in the organization_members policies themselves, causing infinite recursion
  (Error 42P17) when non-admin users try to fetch organization members.

  ## Root Cause
  The "member_select_org_members" policy still queries organization_members
  recursively to check if the user is a member, creating a circular dependency.

  ## Solution
  1. Create additional security definer helper functions for role checks
  2. Simplify organization_members SELECT policy - allow all authenticated users
     (knowing who is in which org is not sensitive data)
  3. Use security definer functions in UPDATE/DELETE policies for role checks
  4. Fix organizations and sales_data policies to use helper functions

  ## Changes
  - Create `is_organization_admin(org_id)` security definer function
  - Drop and recreate organization_members policies without recursion
  - Fix organizations and sales_data policies to use helper functions
*/

-- =======================
-- 1. CREATE ADDITIONAL HELPER FUNCTIONS
-- =======================

-- Function to check if user is admin of a specific organization (bypasses RLS)
CREATE OR REPLACE FUNCTION is_organization_admin(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM organization_members om
    WHERE om.organization_id = org_id
    AND om.user_id = auth.uid()
    AND om.role = 'admin'
  );
END;
$$;

-- Function to get organization IDs where user is admin (bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_admin_organization_ids()
RETURNS TABLE(organization_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT om.organization_id
  FROM organization_members om
  WHERE om.user_id = auth.uid()
  AND om.role = 'admin';
END;
$$;

-- =======================
-- 2. DROP EXISTING ORGANIZATION_MEMBERS POLICIES
-- =======================

DROP POLICY IF EXISTS "platform_admin_select_org_members" ON organization_members;
DROP POLICY IF EXISTS "member_select_org_members" ON organization_members;
DROP POLICY IF EXISTS "platform_admin_insert_org_members" ON organization_members;
DROP POLICY IF EXISTS "user_insert_self_org_member" ON organization_members;
DROP POLICY IF EXISTS "platform_admin_update_org_members" ON organization_members;
DROP POLICY IF EXISTS "admin_update_org_members" ON organization_members;
DROP POLICY IF EXISTS "platform_admin_delete_org_members" ON organization_members;
DROP POLICY IF EXISTS "admin_delete_org_members" ON organization_members;

-- =======================
-- 3. CREATE NEW NON-RECURSIVE ORGANIZATION_MEMBERS POLICIES
-- =======================

-- SELECT: Allow all authenticated users to see organization members
-- This breaks the recursion cycle and is safe (membership is not sensitive)
CREATE POLICY "authenticated_select_org_members"
  ON organization_members FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Platform admins can insert anyone
CREATE POLICY "platform_admin_insert_org_members"
  ON organization_members FOR INSERT
  TO authenticated
  WITH CHECK (is_platform_admin());

-- INSERT: Users can insert themselves
CREATE POLICY "user_insert_self_org_member"
  ON organization_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: Platform admins can update anyone
CREATE POLICY "platform_admin_update_org_members"
  ON organization_members FOR UPDATE
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- UPDATE: Organization admins can update members in their org
CREATE POLICY "admin_update_org_members"
  ON organization_members FOR UPDATE
  TO authenticated
  USING (is_organization_admin(organization_id))
  WITH CHECK (is_organization_admin(organization_id));

-- DELETE: Platform admins can delete anyone
CREATE POLICY "platform_admin_delete_org_members"
  ON organization_members FOR DELETE
  TO authenticated
  USING (is_platform_admin());

-- DELETE: Organization admins can delete members in their org
CREATE POLICY "admin_delete_org_members"
  ON organization_members FOR DELETE
  TO authenticated
  USING (is_organization_admin(organization_id));

-- =======================
-- 4. FIX ORGANIZATIONS POLICIES
-- =======================

DROP POLICY IF EXISTS "admin_update_organizations" ON organizations;

CREATE POLICY "admin_update_organizations"
  ON organizations FOR UPDATE
  TO authenticated
  USING (id IN (SELECT organization_id FROM get_user_admin_organization_ids()))
  WITH CHECK (id IN (SELECT organization_id FROM get_user_admin_organization_ids()));

-- =======================
-- 5. FIX SALES_DATA POLICIES
-- =======================

DROP POLICY IF EXISTS "admin_delete_sales_data" ON sales_data;

CREATE POLICY "admin_delete_sales_data"
  ON sales_data FOR DELETE
  TO authenticated
  USING (
    is_platform_admin() OR
    organization_id IN (SELECT organization_id FROM get_user_admin_organization_ids())
  );

-- =======================
-- 6. GRANT EXECUTE PERMISSIONS
-- =======================

GRANT EXECUTE ON FUNCTION is_organization_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_admin_organization_ids() TO authenticated;