/*
  # Fix Security and Performance Issues

  1. Indexes for Foreign Keys
    - Add indexes for all unindexed foreign key columns
    - Improves query performance for joins and foreign key lookups

  2. Function Security
    - Set secure search_path for all functions
    - Prevents search path hijacking attacks

  3. Extension Management
    - Move pg_trgm from public to extensions schema
*/

-- =============================================================================
-- PART 1: Add indexes for unindexed foreign keys
-- =============================================================================

-- ai_training_configurations
CREATE INDEX IF NOT EXISTS idx_ai_training_created_by
  ON ai_training_configurations(created_by);

-- alerts
CREATE INDEX IF NOT EXISTS idx_alerts_related_task
  ON alerts(related_task_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user
  ON alerts(user_id);

-- brand_invitations
CREATE INDEX IF NOT EXISTS idx_brand_invitations_invited_by
  ON brand_invitations(invited_by);
CREATE INDEX IF NOT EXISTS idx_brand_invitations_org
  ON brand_invitations(organization_id);

-- distributor_creation_audit
CREATE INDEX IF NOT EXISTS idx_distributor_audit_created_by
  ON distributor_creation_audit(created_by_user_id);

-- distributors
CREATE INDEX IF NOT EXISTS idx_distributors_created_by_org
  ON distributors(created_by_organization_id);

-- duplicate_review_queue
CREATE INDEX IF NOT EXISTS idx_duplicate_queue_reviewed_by
  ON duplicate_review_queue(reviewed_by);

-- fob_pricing_matrix
CREATE INDEX IF NOT EXISTS idx_fob_pricing_created_by
  ON fob_pricing_matrix(created_by);

-- inventory_distributor
CREATE INDEX IF NOT EXISTS idx_inventory_dist_created_by
  ON inventory_distributor(created_by);

-- inventory_importer
CREATE INDEX IF NOT EXISTS idx_inventory_imp_updated_by
  ON inventory_importer(updated_by);

-- inventory_transactions
CREATE INDEX IF NOT EXISTS idx_inventory_trans_created_by
  ON inventory_transactions(created_by);

-- invitations
CREATE INDEX IF NOT EXISTS idx_invitations_invited_by
  ON invitations(invited_by);

-- merge_audit_log
CREATE INDEX IF NOT EXISTS idx_merge_audit_performed_by
  ON merge_audit_log(performed_by);
CREATE INDEX IF NOT EXISTS idx_merge_audit_undone_by
  ON merge_audit_log(undone_by);

-- organization_members
CREATE INDEX IF NOT EXISTS idx_org_members_invited_by
  ON organization_members(invited_by);

-- organizations
CREATE INDEX IF NOT EXISTS idx_orgs_created_by_admin
  ON organizations(created_by_admin_user_id);
CREATE INDEX IF NOT EXISTS idx_orgs_deleted_by
  ON organizations(deleted_by);

-- pending_distributors
CREATE INDEX IF NOT EXISTS idx_pending_dist_requested_by
  ON pending_distributors(requested_by_user_id);
CREATE INDEX IF NOT EXISTS idx_pending_dist_reviewed_by
  ON pending_distributors(reviewed_by);

-- product_mappings
CREATE INDEX IF NOT EXISTS idx_product_mappings_created_by
  ON product_mappings(created_by);

-- sales_data
CREATE INDEX IF NOT EXISTS idx_sales_data_canonical_product
  ON sales_data(canonical_product_id);

-- tasks
CREATE INDEX IF NOT EXISTS idx_tasks_user
  ON tasks(user_id);

-- =============================================================================
-- PART 2: Move pg_trgm extension to extensions schema (if it exists)
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension
    WHERE extname = 'pg_trgm'
    AND extnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    CREATE SCHEMA IF NOT EXISTS extensions;
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
  END IF;
END $$;

-- =============================================================================
-- PART 3: Fix function search paths for security
-- =============================================================================

ALTER FUNCTION is_platform_admin() SET search_path = public, pg_temp;
ALTER FUNCTION get_platform_admin_user_id() SET search_path = public, pg_temp;
ALTER FUNCTION update_account_categorizations_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION refresh_distributor_stats(uuid, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION refresh_all_distributor_stats(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION check_distributor_duplicates(text) SET search_path = public, pg_temp;
ALTER FUNCTION auto_promote_distributor_to_global() SET search_path = public, pg_temp;
ALTER FUNCTION create_distributor_audit_and_junction() SET search_path = public, pg_temp;
ALTER FUNCTION ensure_single_active_config() SET search_path = public, pg_temp;
ALTER FUNCTION get_user_email(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION get_user_emails(uuid[]) SET search_path = public, pg_temp;
ALTER FUNCTION soft_delete_organization(uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION restore_organization(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION update_distributors_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION update_fob_pricing_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION clean_old_duplicate_queue_entries() SET search_path = public, pg_temp;
ALTER FUNCTION increment_mapping_usage(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION create_subscription_for_organization() SET search_path = public, pg_temp;
ALTER FUNCTION log_audit_event(uuid, text, text, text, jsonb) SET search_path = public, pg_temp;
ALTER FUNCTION is_organization_admin(uuid, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION is_organization_member(uuid, uuid) SET search_path = public, pg_temp;