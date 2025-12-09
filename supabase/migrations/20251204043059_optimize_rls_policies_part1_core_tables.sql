/*
  # Optimize RLS Policies - Part 1: Core Tables

  1. **Performance Improvement**
     - Replaces auth.uid() with (SELECT auth.uid())
     - Replaces auth.jwt() with (SELECT auth.jwt())
     - Prevents re-evaluation for each row
     - Significantly improves query performance at scale

  2. **Tables Updated**
     - organizations
     - uploads
     - sales_data
     - accounts
     - products
     - analytics_snapshots
     - invitations
     - subscriptions
     - audit_logs

  3. **Security Impact**
     - Maintains same security guarantees
     - Improves performance under concurrent access
     - Reduces database CPU usage
*/

-- =====================================================
-- Organizations Table
-- =====================================================

DROP POLICY IF EXISTS "Admins can update their organizations" ON organizations;
CREATE POLICY "Admins can update their organizations"
  ON organizations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = (SELECT auth.uid())
      AND organization_members.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Consolidated: View organizations" ON organizations;
CREATE POLICY "Consolidated: View organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = (SELECT auth.uid())
    )
    OR is_platform_admin()
  );

-- =====================================================
-- Uploads Table
-- =====================================================

DROP POLICY IF EXISTS "Members can create uploads" ON uploads;
CREATE POLICY "Members can create uploads"
  ON uploads FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = uploads.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own uploads" ON uploads;
CREATE POLICY "Users can update their own uploads"
  ON uploads FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Consolidated: View uploads" ON uploads;
CREATE POLICY "Consolidated: View uploads"
  ON uploads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = uploads.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
    OR is_platform_admin()
  );

-- =====================================================
-- Sales Data Table
-- =====================================================

DROP POLICY IF EXISTS "Members can insert sales data" ON sales_data;
CREATE POLICY "Members can insert sales data"
  ON sales_data FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = sales_data.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can update sales data" ON sales_data;
CREATE POLICY "Admins can update sales data"
  ON sales_data FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = sales_data.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
      AND organization_members.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete sales data" ON sales_data;
CREATE POLICY "Admins can delete sales data"
  ON sales_data FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = sales_data.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
      AND organization_members.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Consolidated: View sales data" ON sales_data;
CREATE POLICY "Consolidated: View sales data"
  ON sales_data FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = sales_data.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
    OR is_platform_admin()
  );

-- =====================================================
-- Accounts Table
-- =====================================================

DROP POLICY IF EXISTS "System can manage accounts" ON accounts;
CREATE POLICY "System can manage accounts"
  ON accounts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = accounts.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Consolidated: View accounts" ON accounts;
CREATE POLICY "Consolidated: View accounts"
  ON accounts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = accounts.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
    OR is_platform_admin()
  );

-- =====================================================
-- Products Table
-- =====================================================

DROP POLICY IF EXISTS "System can manage products" ON products;
CREATE POLICY "System can manage products"
  ON products FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = products.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Consolidated: View products" ON products;
CREATE POLICY "Consolidated: View products"
  ON products FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = products.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
    OR is_platform_admin()
  );

-- =====================================================
-- Analytics Snapshots Table
-- =====================================================

DROP POLICY IF EXISTS "Users can view snapshots from their organizations" ON analytics_snapshots;
CREATE POLICY "Users can view snapshots from their organizations"
  ON analytics_snapshots FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = analytics_snapshots.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "System can manage snapshots" ON analytics_snapshots;
CREATE POLICY "System can manage snapshots"
  ON analytics_snapshots FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = analytics_snapshots.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- Invitations Table
-- =====================================================

DROP POLICY IF EXISTS "Admins can view invitations for their organization" ON invitations;
CREATE POLICY "Admins can view invitations for their organization"
  ON invitations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = invitations.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
      AND organization_members.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can create invitations" ON invitations;
CREATE POLICY "Admins can create invitations"
  ON invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = invitations.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
      AND organization_members.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update invitations" ON invitations;
CREATE POLICY "Admins can update invitations"
  ON invitations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = invitations.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
      AND organization_members.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete invitations" ON invitations;
CREATE POLICY "Admins can delete invitations"
  ON invitations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = invitations.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
      AND organization_members.role = 'admin'
    )
  );

-- =====================================================
-- Subscriptions Table
-- =====================================================

DROP POLICY IF EXISTS "Organization members can view their subscription" ON subscriptions;
CREATE POLICY "Organization members can view their subscription"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = subscriptions.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- Audit Logs Table
-- =====================================================

DROP POLICY IF EXISTS "Admins can view audit logs for their organization" ON audit_logs;
CREATE POLICY "Admins can view audit logs for their organization"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = audit_logs.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
      AND organization_members.role = 'admin'
    )
  );