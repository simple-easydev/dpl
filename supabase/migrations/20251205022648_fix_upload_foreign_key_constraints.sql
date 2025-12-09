/*
  # Fix Foreign Key Constraints for Upload Deletion

  ## Overview
  Updates foreign key constraints on tables that reference uploads to handle deletion properly.

  ## Changes
  1. Update `merge_audit_log.upload_id` to use ON DELETE SET NULL
     - Audit logs should remain even after upload is deleted
     - The upload_id will be set to NULL when the upload is removed
  
  2. Verify `duplicate_review_queue.upload_id` has proper CASCADE (already correct)

  ## Security
  - No changes to RLS policies
  - Maintains data integrity while allowing upload deletion
  - Preserves audit trail history even when uploads are removed
*/

-- Drop and recreate the foreign key constraint for merge_audit_log.upload_id
-- First, drop the existing constraint if it exists
DO $$
BEGIN
  -- Drop the foreign key constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'merge_audit_log' 
    AND constraint_type = 'FOREIGN KEY'
    AND constraint_name LIKE '%upload_id%'
  ) THEN
    ALTER TABLE merge_audit_log 
    DROP CONSTRAINT IF EXISTS merge_audit_log_upload_id_fkey;
  END IF;
END $$;

-- Add the foreign key constraint with ON DELETE SET NULL
ALTER TABLE merge_audit_log
ADD CONSTRAINT merge_audit_log_upload_id_fkey
FOREIGN KEY (upload_id)
REFERENCES uploads(id)
ON DELETE SET NULL;

-- Verify duplicate_review_queue already has proper CASCADE behavior
-- (It was created with ON DELETE CASCADE in the original migration, so no changes needed)

-- Note: sales_data already has ON DELETE CASCADE from initial schema
-- Note: product_mappings does not have upload_id field
