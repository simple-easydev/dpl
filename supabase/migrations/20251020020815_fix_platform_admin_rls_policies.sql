/*
  # Fix Platform Admin RLS Policies

  1. Problem
    - Platform admin cannot access accounts page because RLS policies are conflicting
    - The "Users can view sales data" policy overrides the "Platform admin can view all sales data" policy
    - Multiple separate policies cause unexpected behavior where restrictive policies block access

  2. Solution
    - Consolidate RLS policies into single policies with OR logic
    - Check platform admin status FIRST before checking organization membership
    - This ensures platform admins always have full access while regular users have organization-scoped access

  3. Tables Updated
    - sales_data: Consolidated SELECT policy
    - accounts: Consolidated SELECT policy
    - products: Consolidated SELECT policy
    - organizations: Consolidated SELECT policy
    - uploads: Consolidated SELECT policy
    - organization_members: Consolidated SELECT policy

  4. Policy Pattern
    Each table will have a single SELECT policy that checks:
    - Is user platform admin? → Grant access to ALL records
    - OR is user member of the organization? → Grant access to organization records only

  5. Security Notes
    - Platform admin check happens first (more permissive)
    - Regular user check happens second (more restrictive)
    - Both checks use EXISTS for efficiency
    - Policies are RESTRICTIVE by default (no access unless explicitly granted)
*/

-- Drop conflicting policies and create consolidated ones

-- ============================================================
-- SALES_DATA: Consolidate all SELECT policies
-- ============================================================
DROP POLICY IF EXISTS "Users can view sales data" ON sales_data;
DROP POLICY IF EXISTS "Users can view sales data from their organizations" ON sales_data;
DROP POLICY IF EXISTS "Platform admin can view all sales data" ON sales_data;

CREATE POLICY "Consolidated: View sales data"
  ON sales_data FOR SELECT
  TO authenticated
  USING (
    -- Platform admin can view ALL sales data
    is_platform_admin()
    OR
    -- Regular users can view sales data from their non-deleted organizations
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN organizations o ON o.id = om.organization_id
      WHERE om.organization_id = sales_data.organization_id
      AND om.user_id = auth.uid()
      AND o.deleted_at IS NULL
    )
  );

-- ============================================================
-- ACCOUNTS: Consolidate all SELECT policies
-- ============================================================
DROP POLICY IF EXISTS "Users can view accounts" ON accounts;
DROP POLICY IF EXISTS "Users can view accounts from their organizations" ON accounts;
DROP POLICY IF EXISTS "Platform admin can view all accounts" ON accounts;

CREATE POLICY "Consolidated: View accounts"
  ON accounts FOR SELECT
  TO authenticated
  USING (
    -- Platform admin can view ALL accounts
    is_platform_admin()
    OR
    -- Regular users can view accounts from their non-deleted organizations
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN organizations o ON o.id = om.organization_id
      WHERE om.organization_id = accounts.organization_id
      AND om.user_id = auth.uid()
      AND o.deleted_at IS NULL
    )
  );

-- ============================================================
-- PRODUCTS: Consolidate all SELECT policies
-- ============================================================
DROP POLICY IF EXISTS "Users can view products" ON products;
DROP POLICY IF EXISTS "Users can view products from their organizations" ON products;
DROP POLICY IF EXISTS "Platform admin can view all products" ON products;

CREATE POLICY "Consolidated: View products"
  ON products FOR SELECT
  TO authenticated
  USING (
    -- Platform admin can view ALL products
    is_platform_admin()
    OR
    -- Regular users can view products from their non-deleted organizations
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN organizations o ON o.id = om.organization_id
      WHERE om.organization_id = products.organization_id
      AND om.user_id = auth.uid()
      AND o.deleted_at IS NULL
    )
  );

-- ============================================================
-- ORGANIZATIONS: Consolidate all SELECT policies
-- ============================================================
DROP POLICY IF EXISTS "Users can view organizations" ON organizations;
DROP POLICY IF EXISTS "Members can view their organizations" ON organizations;
DROP POLICY IF EXISTS "Platform admin can view all organizations" ON organizations;

CREATE POLICY "Consolidated: View organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    -- Platform admin can view ALL organizations (including deleted)
    is_platform_admin()
    OR
    -- Regular users can view their non-deleted organizations
    (
      deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = organizations.id
        AND om.user_id = auth.uid()
      )
    )
  );

-- ============================================================
-- UPLOADS: Consolidate all SELECT policies
-- ============================================================
DROP POLICY IF EXISTS "Users can view uploads" ON uploads;
DROP POLICY IF EXISTS "Users can view uploads from their organizations" ON uploads;
DROP POLICY IF EXISTS "Platform admin can view all uploads" ON uploads;

CREATE POLICY "Consolidated: View uploads"
  ON uploads FOR SELECT
  TO authenticated
  USING (
    -- Platform admin can view ALL uploads
    is_platform_admin()
    OR
    -- Regular users can view uploads from their non-deleted organizations
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN organizations o ON o.id = om.organization_id
      WHERE om.organization_id = uploads.organization_id
      AND om.user_id = auth.uid()
      AND o.deleted_at IS NULL
    )
  );

-- ============================================================
-- ORGANIZATION_MEMBERS: Consolidate all SELECT policies
-- ============================================================
DROP POLICY IF EXISTS "Users can view organization members" ON organization_members;
DROP POLICY IF EXISTS "Members can view their organization members" ON organization_members;
DROP POLICY IF EXISTS "Platform admin can view all organization members" ON organization_members;

CREATE POLICY "Consolidated: View organization members"
  ON organization_members FOR SELECT
  TO authenticated
  USING (
    -- Platform admin can view ALL organization members
    is_platform_admin()
    OR
    -- Regular users can view members from their non-deleted organizations
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN organizations o ON o.id = om.organization_id
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND o.deleted_at IS NULL
    )
  );

-- ============================================================
-- Add helpful comment to is_platform_admin function
-- ============================================================
COMMENT ON FUNCTION is_platform_admin() IS 
  'Returns true if the current authenticated user is the platform admin. Used in RLS policies to grant platform admin access to all data across all organizations.';
