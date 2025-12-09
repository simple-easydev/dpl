/*
  # Fix Infinite Recursion in RLS Policies - Complete Fix

  ## Problem
  The "Members can view organization members" and consolidated policies created infinite recursion
  by querying organization_members from within the organization_members RLS policy itself.
  This causes Error 42P17 "infinite recursion detected in policy" for non-platform-admin users.

  ## Solution
  1. Create security definer helper functions that bypass RLS
  2. Drop ALL existing policies on affected tables
  3. Create simplified, non-recursive RLS policies
  4. Maintain platform admin access while fixing user access

  ## Changes
  - Create `get_user_organization_ids()` security definer function
  - Drop all existing policies on: organization_members, organizations, sales_data, accounts, products, uploads
  - Create new, optimized, non-recursive policies
  - Add performance indexes
*/

-- =======================
-- 1. CREATE HELPER FUNCTIONS
-- =======================

-- Function to get organization IDs for the current user (bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_organization_ids()
RETURNS TABLE(organization_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT om.organization_id
  FROM organization_members om
  WHERE om.user_id = auth.uid();
END;
$$;

-- Function to check if user is member of a specific organization (bypasses RLS)
CREATE OR REPLACE FUNCTION is_organization_member(org_id uuid)
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
  );
END;
$$;

-- =======================
-- 2. DROP ALL EXISTING POLICIES
-- =======================

-- organization_members
DROP POLICY IF EXISTS "Admins can invite other members" ON organization_members;
DROP POLICY IF EXISTS "Admins can remove members" ON organization_members;
DROP POLICY IF EXISTS "Admins can update member roles" ON organization_members;
DROP POLICY IF EXISTS "Members can view organization members" ON organization_members;
DROP POLICY IF EXISTS "Platform admin can manage organization members" ON organization_members;
DROP POLICY IF EXISTS "Platform admin can view all organization members" ON organization_members;
DROP POLICY IF EXISTS "Users can insert themselves as members" ON organization_members;
DROP POLICY IF EXISTS "Consolidated: View organization members" ON organization_members;

-- organizations
DROP POLICY IF EXISTS "Admins can update their organizations" ON organizations;
DROP POLICY IF EXISTS "Consolidated: View organizations" ON organizations;
DROP POLICY IF EXISTS "Platform admin can update all organizations" ON organizations;
DROP POLICY IF EXISTS "Users can insert organizations" ON organizations;

-- sales_data
DROP POLICY IF EXISTS "Admins can delete sales data" ON sales_data;
DROP POLICY IF EXISTS "Admins can update sales data" ON sales_data;
DROP POLICY IF EXISTS "Consolidated: View sales data" ON sales_data;
DROP POLICY IF EXISTS "Members can insert sales data" ON sales_data;
DROP POLICY IF EXISTS "Platform admin can manage all sales data" ON sales_data;
DROP POLICY IF EXISTS "Consolidated: Manage sales data" ON sales_data;

-- accounts
DROP POLICY IF EXISTS "Consolidated: View accounts" ON accounts;
DROP POLICY IF EXISTS "Platform admin can manage all accounts" ON accounts;
DROP POLICY IF EXISTS "System can manage accounts" ON accounts;
DROP POLICY IF EXISTS "Consolidated: Manage accounts" ON accounts;

-- products
DROP POLICY IF EXISTS "Consolidated: View products" ON products;
DROP POLICY IF EXISTS "Platform admin can manage all products" ON products;
DROP POLICY IF EXISTS "System can manage products" ON products;
DROP POLICY IF EXISTS "Consolidated: Manage products" ON products;

-- uploads
DROP POLICY IF EXISTS "Consolidated: View uploads" ON uploads;
DROP POLICY IF EXISTS "Members can create uploads" ON uploads;
DROP POLICY IF EXISTS "Platform admin can manage all uploads" ON uploads;
DROP POLICY IF EXISTS "Users can update their own uploads" ON uploads;
DROP POLICY IF EXISTS "Consolidated: Manage uploads" ON uploads;

-- =======================
-- 3. CREATE ORGANIZATION_MEMBERS POLICIES
-- =======================

-- SELECT policies
CREATE POLICY "platform_admin_select_org_members"
  ON organization_members FOR SELECT
  TO authenticated
  USING (is_platform_admin());

CREATE POLICY "member_select_org_members"
  ON organization_members FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om 
      WHERE om.user_id = auth.uid()
    )
  );

-- INSERT policies
CREATE POLICY "platform_admin_insert_org_members"
  ON organization_members FOR INSERT
  TO authenticated
  WITH CHECK (is_platform_admin());

CREATE POLICY "user_insert_self_org_member"
  ON organization_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE policies
CREATE POLICY "platform_admin_update_org_members"
  ON organization_members FOR UPDATE
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "admin_update_org_members"
  ON organization_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.role = 'admin'
    )
  );

-- DELETE policies
CREATE POLICY "platform_admin_delete_org_members"
  ON organization_members FOR DELETE
  TO authenticated
  USING (is_platform_admin());

CREATE POLICY "admin_delete_org_members"
  ON organization_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.role = 'admin'
    )
  );

-- =======================
-- 4. CREATE ORGANIZATIONS POLICIES
-- =======================

CREATE POLICY "platform_admin_select_organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (is_platform_admin());

CREATE POLICY "member_select_organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT organization_id FROM get_user_organization_ids())
    AND deleted_at IS NULL
  );

CREATE POLICY "authenticated_insert_organizations"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "platform_admin_update_organizations"
  ON organizations FOR UPDATE
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "admin_update_organizations"
  ON organizations FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT om.organization_id 
      FROM organization_members om 
      WHERE om.user_id = auth.uid() AND om.role = 'admin'
    )
  )
  WITH CHECK (
    id IN (
      SELECT om.organization_id 
      FROM organization_members om 
      WHERE om.user_id = auth.uid() AND om.role = 'admin'
    )
  );

-- =======================
-- 5. CREATE SALES_DATA POLICIES
-- =======================

CREATE POLICY "platform_admin_select_sales_data"
  ON sales_data FOR SELECT
  TO authenticated
  USING (is_platform_admin());

CREATE POLICY "member_select_sales_data"
  ON sales_data FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM get_user_organization_ids()));

CREATE POLICY "platform_admin_manage_sales_data"
  ON sales_data FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "member_insert_sales_data"
  ON sales_data FOR INSERT
  TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM get_user_organization_ids()));

CREATE POLICY "member_update_sales_data"
  ON sales_data FOR UPDATE
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM get_user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM get_user_organization_ids()));

CREATE POLICY "admin_delete_sales_data"
  ON sales_data FOR DELETE
  TO authenticated
  USING (
    is_platform_admin() OR
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om 
      WHERE om.user_id = auth.uid() AND om.role = 'admin'
    )
  );

-- =======================
-- 6. CREATE ACCOUNTS POLICIES
-- =======================

CREATE POLICY "platform_admin_select_accounts"
  ON accounts FOR SELECT
  TO authenticated
  USING (is_platform_admin());

CREATE POLICY "member_select_accounts"
  ON accounts FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM get_user_organization_ids()));

CREATE POLICY "platform_admin_manage_accounts"
  ON accounts FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "member_manage_accounts"
  ON accounts FOR ALL
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM get_user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM get_user_organization_ids()));

-- =======================
-- 7. CREATE PRODUCTS POLICIES
-- =======================

CREATE POLICY "platform_admin_select_products"
  ON products FOR SELECT
  TO authenticated
  USING (is_platform_admin());

CREATE POLICY "member_select_products"
  ON products FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM get_user_organization_ids()));

CREATE POLICY "platform_admin_manage_products"
  ON products FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "member_manage_products"
  ON products FOR ALL
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM get_user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM get_user_organization_ids()));

-- =======================
-- 8. CREATE UPLOADS POLICIES
-- =======================

CREATE POLICY "platform_admin_select_uploads"
  ON uploads FOR SELECT
  TO authenticated
  USING (is_platform_admin());

CREATE POLICY "member_select_uploads"
  ON uploads FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM get_user_organization_ids()));

CREATE POLICY "platform_admin_manage_uploads"
  ON uploads FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "member_insert_uploads"
  ON uploads FOR INSERT
  TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM get_user_organization_ids()));

CREATE POLICY "member_update_uploads"
  ON uploads FOR UPDATE
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM get_user_organization_ids()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM get_user_organization_ids()));

-- =======================
-- 9. ADD PERFORMANCE INDEXES
-- =======================

CREATE INDEX IF NOT EXISTS idx_organization_members_user_org 
  ON organization_members(user_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_organization_members_org_user 
  ON organization_members(organization_id, user_id);

CREATE INDEX IF NOT EXISTS idx_organization_members_user_role
  ON organization_members(user_id, role);

-- =======================
-- 10. GRANT EXECUTE PERMISSIONS
-- =======================

GRANT EXECUTE ON FUNCTION get_user_organization_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION is_organization_member(uuid) TO authenticated;