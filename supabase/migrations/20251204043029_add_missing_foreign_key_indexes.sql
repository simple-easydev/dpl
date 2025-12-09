/*
  # Add Missing Foreign Key Indexes

  1. **Performance Improvement**
     - Adds covering indexes for all foreign key constraints
     - Significantly improves JOIN performance and query execution
     - Prevents full table scans on foreign key lookups

  2. **Tables Updated**
     - ai_training_configurations
     - alerts
     - brand_invitations
     - distributor_creation_audit
     - distributors
     - duplicate_review_queue
     - fob_pricing_matrix
     - inventory_distributor
     - inventory_importer
     - inventory_transactions
     - invitations
     - merge_audit_log
     - organization_members
     - organizations
     - pending_distributors
     - product_mappings
     - sales_data
     - tasks

  3. **Security Impact**
     - Improves RLS policy performance
     - Reduces database load under concurrent access
     - Prevents potential DoS through slow queries
*/

-- AI Training Configurations
CREATE INDEX IF NOT EXISTS idx_ai_training_created_by ON ai_training_configurations(created_by);

-- Alerts
CREATE INDEX IF NOT EXISTS idx_alerts_related_task_id ON alerts(related_task_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);

-- Brand Invitations
CREATE INDEX IF NOT EXISTS idx_brand_invitations_invited_by ON brand_invitations(invited_by);
CREATE INDEX IF NOT EXISTS idx_brand_invitations_organization_id ON brand_invitations(organization_id);

-- Distributor Creation Audit
CREATE INDEX IF NOT EXISTS idx_dist_audit_created_by ON distributor_creation_audit(created_by_user_id);

-- Distributors
CREATE INDEX IF NOT EXISTS idx_distributors_created_by_org ON distributors(created_by_organization_id);

-- Duplicate Review Queue
CREATE INDEX IF NOT EXISTS idx_dup_queue_reviewed_by ON duplicate_review_queue(reviewed_by);

-- FOB Pricing Matrix
CREATE INDEX IF NOT EXISTS idx_fob_pricing_created_by ON fob_pricing_matrix(created_by);

-- Inventory Distributor
CREATE INDEX IF NOT EXISTS idx_inv_dist_created_by ON inventory_distributor(created_by);

-- Inventory Importer
CREATE INDEX IF NOT EXISTS idx_inv_imp_updated_by ON inventory_importer(updated_by);

-- Inventory Transactions
CREATE INDEX IF NOT EXISTS idx_inv_trans_created_by ON inventory_transactions(created_by);

-- Invitations
CREATE INDEX IF NOT EXISTS idx_invitations_invited_by ON invitations(invited_by);

-- Merge Audit Log
CREATE INDEX IF NOT EXISTS idx_merge_audit_performed_by ON merge_audit_log(performed_by);
CREATE INDEX IF NOT EXISTS idx_merge_audit_undone_by ON merge_audit_log(undone_by);

-- Organization Members
CREATE INDEX IF NOT EXISTS idx_org_members_invited_by ON organization_members(invited_by);

-- Organizations
CREATE INDEX IF NOT EXISTS idx_organizations_created_by ON organizations(created_by_admin_user_id);
CREATE INDEX IF NOT EXISTS idx_organizations_deleted_by ON organizations(deleted_by);

-- Pending Distributors
CREATE INDEX IF NOT EXISTS idx_pending_dist_requested_by ON pending_distributors(requested_by_user_id);
CREATE INDEX IF NOT EXISTS idx_pending_dist_reviewed_by ON pending_distributors(reviewed_by);

-- Product Mappings
CREATE INDEX IF NOT EXISTS idx_product_mappings_created_by ON product_mappings(created_by);

-- Sales Data
CREATE INDEX IF NOT EXISTS idx_sales_data_canonical_product ON sales_data(canonical_product_id);

-- Tasks
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);