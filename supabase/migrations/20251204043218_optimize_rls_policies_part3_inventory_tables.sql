/*
  # Optimize RLS Policies - Part 3: Inventory Tables

  1. **Tables Updated**
     - distributor_stats
     - inventory_importer
     - inventory_distributor
     - inventory_transactions

  2. **Performance Improvement**
     - Uses subquery pattern for auth functions
     - Prevents row-by-row re-evaluation
     - Improves query performance under load
*/

-- =====================================================
-- Distributor Stats Table
-- =====================================================

DROP POLICY IF EXISTS "Users can read stats for their organization's distributors" ON distributor_stats;
CREATE POLICY "Users can read stats for their organization's distributors"
  ON distributor_stats FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = distributor_stats.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can view stats for their organization" ON distributor_stats;
DROP POLICY IF EXISTS "Users can insert stats for their organization" ON distributor_stats;
DROP POLICY IF EXISTS "Users can update stats for their organization" ON distributor_stats;
DROP POLICY IF EXISTS "Users can delete stats for their organization" ON distributor_stats;

CREATE POLICY "Users can insert stats for their organization"
  ON distributor_stats FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = distributor_stats.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can update stats for their organization"
  ON distributor_stats FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = distributor_stats.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can delete stats for their organization"
  ON distributor_stats FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = distributor_stats.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- Inventory Importer Table
-- =====================================================

DROP POLICY IF EXISTS "Users can view importer inventory for their organization" ON inventory_importer;
CREATE POLICY "Users can view importer inventory for their organization"
  ON inventory_importer FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = inventory_importer.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert importer inventory for their organization" ON inventory_importer;
CREATE POLICY "Users can insert importer inventory for their organization"
  ON inventory_importer FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = inventory_importer.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update importer inventory for their organization" ON inventory_importer;
CREATE POLICY "Users can update importer inventory for their organization"
  ON inventory_importer FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = inventory_importer.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete importer inventory for their organization" ON inventory_importer;
CREATE POLICY "Users can delete importer inventory for their organization"
  ON inventory_importer FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = inventory_importer.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- Inventory Distributor Table
-- =====================================================

DROP POLICY IF EXISTS "Users can view distributor inventory for their organization" ON inventory_distributor;
CREATE POLICY "Users can view distributor inventory for their organization"
  ON inventory_distributor FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = inventory_distributor.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert distributor inventory for their organization" ON inventory_distributor;
CREATE POLICY "Users can insert distributor inventory for their organization"
  ON inventory_distributor FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = inventory_distributor.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update distributor inventory for their organization" ON inventory_distributor;
CREATE POLICY "Users can update distributor inventory for their organization"
  ON inventory_distributor FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = inventory_distributor.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete distributor inventory for their organization" ON inventory_distributor;
CREATE POLICY "Users can delete distributor inventory for their organization"
  ON inventory_distributor FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = inventory_distributor.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

-- =====================================================
-- Inventory Transactions Table
-- =====================================================

DROP POLICY IF EXISTS "Users can view inventory transactions for their organization" ON inventory_transactions;
CREATE POLICY "Users can view inventory transactions for their organization"
  ON inventory_transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = inventory_transactions.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert inventory transactions for their organization" ON inventory_transactions;
CREATE POLICY "Users can insert inventory transactions for their organization"
  ON inventory_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = inventory_transactions.organization_id
      AND organization_members.user_id = (SELECT auth.uid())
    )
  );