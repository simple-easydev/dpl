/*
  # Optimize RLS Policies - Part 4: Remaining Tables (Fixed)

  1. **Tables Updated**
     - platform_admin_config
     - brand_invitations
     - organization_members
     - pending_distributors
     - account_categorizations

  2. **Performance Improvement**
     - Uses subquery pattern for auth functions
     - Prevents row-by-row re-evaluation
     - Improves query performance under load
*/

-- =====================================================
-- Platform Admin Config
-- =====================================================

DROP POLICY IF EXISTS "Platform admin can read config" ON platform_admin_config;
CREATE POLICY "Platform admin can read config"
  ON platform_admin_config FOR SELECT
  TO authenticated
  USING (is_platform_admin());

DROP POLICY IF EXISTS "Platform admin can update config" ON platform_admin_config;
CREATE POLICY "Platform admin can update config"
  ON platform_admin_config FOR UPDATE
  TO authenticated
  USING (is_platform_admin());

-- =====================================================
-- Brand Invitations
-- =====================================================

DROP POLICY IF EXISTS "Platform admin can manage brand invitations" ON brand_invitations;
CREATE POLICY "Platform admin can manage brand invitations"
  ON brand_invitations FOR ALL
  TO authenticated
  USING (is_platform_admin());

DROP POLICY IF EXISTS "Users can read their invitation" ON brand_invitations;
CREATE POLICY "Users can read their invitation"
  ON brand_invitations FOR SELECT
  TO authenticated
  USING (
    email = (SELECT (auth.jwt()->>'email')::text)
    OR is_platform_admin()
  );

-- =====================================================
-- Organization Members
-- =====================================================

DROP POLICY IF EXISTS "Users can insert themselves as members" ON organization_members;
CREATE POLICY "Users can insert themselves as members"
  ON organization_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins can invite other members" ON organization_members;
CREATE POLICY "Admins can invite other members"
  ON organization_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members existing
      WHERE existing.organization_id = organization_members.organization_id
      AND existing.user_id = (SELECT auth.uid())
      AND existing.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update member roles" ON organization_members;
CREATE POLICY "Admins can update member roles"
  ON organization_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members existing
      WHERE existing.organization_id = organization_members.organization_id
      AND existing.user_id = (SELECT auth.uid())
      AND existing.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can remove members" ON organization_members;
CREATE POLICY "Admins can remove members"
  ON organization_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members existing
      WHERE existing.organization_id = organization_members.organization_id
      AND existing.user_id = (SELECT auth.uid())
      AND existing.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Members can view organization members" ON organization_members;
CREATE POLICY "Members can view organization members"
  ON organization_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members existing
      WHERE existing.organization_id = organization_members.organization_id
      AND existing.user_id = (SELECT auth.uid())
    )
    OR is_platform_admin()
  );

-- =====================================================
-- Pending Distributors
-- =====================================================

DROP POLICY IF EXISTS "Organizations can view their own pending distributors" ON pending_distributors;
CREATE POLICY "Organizations can view their own pending distributors"
  ON pending_distributors FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = pending_distributors.requested_by_organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
    OR is_platform_admin()
  );

DROP POLICY IF EXISTS "Organization members can create pending distributors" ON pending_distributors;
CREATE POLICY "Organization members can create pending distributors"
  ON pending_distributors FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = pending_distributors.requested_by_organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- Account Categorizations
-- =====================================================

DROP POLICY IF EXISTS "Organization members can read categorizations" ON account_categorizations;
CREATE POLICY "Organization members can read categorizations"
  ON account_categorizations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = account_categorizations.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Organization members can insert categorizations" ON account_categorizations;
CREATE POLICY "Organization members can insert categorizations"
  ON account_categorizations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = account_categorizations.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Organization members can update categorizations" ON account_categorizations;
CREATE POLICY "Organization members can update categorizations"
  ON account_categorizations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = account_categorizations.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Organization members can delete categorizations" ON account_categorizations;
CREATE POLICY "Organization members can delete categorizations"
  ON account_categorizations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = account_categorizations.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );