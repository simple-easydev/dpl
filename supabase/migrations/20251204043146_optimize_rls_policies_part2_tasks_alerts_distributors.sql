/*
  # Optimize RLS Policies - Part 2: Tasks, Alerts, Distributors

  1. **Tables Updated**
     - tasks
     - alerts
     - distributors
     - organization_distributors
     - fob_pricing_matrix
     - product_mappings
     - duplicate_review_queue
     - merge_audit_log

  2. **Performance Improvement**
     - Uses subquery pattern for auth functions
     - Prevents row-by-row re-evaluation
     - Improves query performance under load
*/

-- =====================================================
-- Tasks Table
-- =====================================================

DROP POLICY IF EXISTS "Users can view tasks in their organization" ON tasks;
CREATE POLICY "Users can view tasks in their organization"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = tasks.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
    OR is_platform_admin()
  );

DROP POLICY IF EXISTS "Users can create tasks in their organization" ON tasks;
CREATE POLICY "Users can create tasks in their organization"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = tasks.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their tasks" ON tasks;
CREATE POLICY "Users can update their tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    (user_id = (SELECT auth.uid()) OR assigned_to = (SELECT auth.uid()))
    OR
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = tasks.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
      AND organization_members.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete tasks" ON tasks;
CREATE POLICY "Admins can delete tasks"
  ON tasks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = tasks.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
      AND organization_members.role = 'admin'
    )
  );

-- =====================================================
-- Alerts Table
-- =====================================================

DROP POLICY IF EXISTS "Users can view alerts in their organization" ON alerts;
CREATE POLICY "Users can view alerts in their organization"
  ON alerts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = alerts.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update alerts" ON alerts;
CREATE POLICY "Users can update alerts"
  ON alerts FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = alerts.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- Distributors Table
-- =====================================================

DROP POLICY IF EXISTS "Members can create custom distributors" ON distributors;
CREATE POLICY "Members can create custom distributors"
  ON distributors FOR INSERT
  TO authenticated
  WITH CHECK (
    (created_by_organization_id IS NOT NULL AND
     EXISTS (
       SELECT 1 FROM organization_members
       WHERE organization_members.organization_id = distributors.created_by_organization_id
       AND organization_members.user_id = (SELECT auth.uid())
     ))
  );

DROP POLICY IF EXISTS "Members can update their organization's custom distributors" ON distributors;
CREATE POLICY "Members can update their organization's custom distributors"
  ON distributors FOR UPDATE
  TO authenticated
  USING (
    (created_by_organization_id IS NOT NULL AND
     EXISTS (
       SELECT 1 FROM organization_members
       WHERE organization_members.organization_id = distributors.created_by_organization_id
       AND organization_members.user_id = (SELECT auth.uid())
     ))
    OR
    (created_by_organization_id IS NULL AND is_platform_admin())
  );

DROP POLICY IF EXISTS "Admins can delete their organization's custom distributors" ON distributors;
CREATE POLICY "Admins can delete their organization's custom distributors"
  ON distributors FOR DELETE
  TO authenticated
  USING (
    created_by_organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = distributors.created_by_organization_id
      AND organization_members.user_id = (SELECT auth.uid())
      AND organization_members.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can view distributors" ON distributors;
CREATE POLICY "Users can view distributors"
  ON distributors FOR SELECT
  TO authenticated
  USING (
    is_global = true
    OR
    (created_by_organization_id IS NOT NULL AND
     EXISTS (
       SELECT 1 FROM organization_members
       WHERE organization_members.organization_id = distributors.created_by_organization_id
       AND organization_members.user_id = (SELECT auth.uid())
     ))
    OR
    is_platform_admin()
  );

DROP POLICY IF EXISTS "All organization members can create global distributors" ON distributors;
CREATE POLICY "All organization members can create global distributors"
  ON distributors FOR INSERT
  TO authenticated
  WITH CHECK (
    is_global = true
    AND created_by_organization_id IS NULL
    AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- Organization Distributors Table
-- =====================================================

DROP POLICY IF EXISTS "Users can view their organization's distributor relationships" ON organization_distributors;
CREATE POLICY "Users can view their organization's distributor relationships"
  ON organization_distributors FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organization_distributors.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
    OR is_platform_admin()
  );

DROP POLICY IF EXISTS "Members can add distributors to their organization" ON organization_distributors;
CREATE POLICY "Members can add distributors to their organization"
  ON organization_distributors FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organization_distributors.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Members can update distributor relationships" ON organization_distributors;
CREATE POLICY "Members can update distributor relationships"
  ON organization_distributors FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organization_distributors.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can remove distributors from their organization" ON organization_distributors;
CREATE POLICY "Admins can remove distributors from their organization"
  ON organization_distributors FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organization_distributors.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
      AND organization_members.role = 'admin'
    )
  );

-- =====================================================
-- FOB Pricing Matrix
-- =====================================================

DROP POLICY IF EXISTS "Users can view FOB pricing from their organizations" ON fob_pricing_matrix;
CREATE POLICY "Users can view FOB pricing from their organizations"
  ON fob_pricing_matrix FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = fob_pricing_matrix.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Members can create FOB pricing" ON fob_pricing_matrix;
CREATE POLICY "Members can create FOB pricing"
  ON fob_pricing_matrix FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = fob_pricing_matrix.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Members can update FOB pricing" ON fob_pricing_matrix;
CREATE POLICY "Members can update FOB pricing"
  ON fob_pricing_matrix FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = fob_pricing_matrix.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can delete FOB pricing" ON fob_pricing_matrix;
CREATE POLICY "Admins can delete FOB pricing"
  ON fob_pricing_matrix FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = fob_pricing_matrix.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
      AND organization_members.role = 'admin'
    )
  );

-- =====================================================
-- Product Mappings
-- =====================================================

DROP POLICY IF EXISTS "Users can view mappings from their organizations" ON product_mappings;
CREATE POLICY "Users can view mappings from their organizations"
  ON product_mappings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = product_mappings.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Members can insert mappings" ON product_mappings;
CREATE POLICY "Members can insert mappings"
  ON product_mappings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = product_mappings.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Members can update mappings" ON product_mappings;
CREATE POLICY "Members can update mappings"
  ON product_mappings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = product_mappings.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can delete mappings" ON product_mappings;
CREATE POLICY "Admins can delete mappings"
  ON product_mappings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = product_mappings.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
      AND organization_members.role = 'admin'
    )
  );

-- =====================================================
-- Duplicate Review Queue
-- =====================================================

DROP POLICY IF EXISTS "Users can view queue from their organizations" ON duplicate_review_queue;
CREATE POLICY "Users can view queue from their organizations"
  ON duplicate_review_queue FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = duplicate_review_queue.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Members can insert to queue" ON duplicate_review_queue;
CREATE POLICY "Members can insert to queue"
  ON duplicate_review_queue FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = duplicate_review_queue.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Members can update queue" ON duplicate_review_queue;
CREATE POLICY "Members can update queue"
  ON duplicate_review_queue FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = duplicate_review_queue.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Members can delete from queue" ON duplicate_review_queue;
CREATE POLICY "Members can delete from queue"
  ON duplicate_review_queue FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = duplicate_review_queue.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- Merge Audit Log
-- =====================================================

DROP POLICY IF EXISTS "Users can view audit log from their organizations" ON merge_audit_log;
CREATE POLICY "Users can view audit log from their organizations"
  ON merge_audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = merge_audit_log.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update audit log for undo" ON merge_audit_log;
CREATE POLICY "Users can update audit log for undo"
  ON merge_audit_log FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = merge_audit_log.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );