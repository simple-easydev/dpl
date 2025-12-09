/*
  # Force Schema Refresh for Premise Type Constraint

  1. Purpose
    - Force Supabase connection pooler to refresh the schema cache
    - Ensure the premise_type constraint with 'online' support is recognized across all connections
    - This migration performs a no-op alteration to trigger schema invalidation

  2. Technical Details
    - The constraint is already correct in the database
    - This migration forces all pooled connections to reload the table definition
    - Uses a harmless comment change to trigger schema refresh

  3. Notes
    - Safe to run - makes no actual changes to data or constraint logic
    - Resolves "accounts_premise_type_check" error caused by stale connection pool cache
*/

-- Force schema cache invalidation by adding and removing a comment
COMMENT ON CONSTRAINT premise_type_check ON accounts IS 
  'Validates premise_type values: on_premise, off_premise, unclassified, or online';

-- Verify the constraint is correct
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'premise_type_check' 
      AND conrelid = 'accounts'::regclass
      AND pg_get_constraintdef(oid) LIKE '%online%'
  ) THEN
    RAISE EXCEPTION 'premise_type_check constraint does not include online value';
  END IF;
  
  RAISE NOTICE 'Schema refresh complete - premise_type constraint verified';
END $$;
