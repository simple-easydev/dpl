/*
  # Fix AI Training Configurations organization_id NOT NULL Constraint

  ## Problem
  The `ai_training_configurations` table has a NOT NULL constraint on `organization_id`, 
  but the application expects it to be nullable for platform admin global configurations.
  
  Migration 20251011235713_make_ai_training_global.sql was intended to make it nullable,
  but migration 20251015164719_create_ai_training_configurations.sql recreated the table
  with NOT NULL after that, causing the constraint to persist.

  ## Changes
  1. Make `organization_id` column nullable in ai_training_configurations table
  2. Verify the change is applied correctly
  3. Add comment documenting that NULL organization_id means global/platform-wide config

  ## Security
  - RLS policies already handle NULL organization_id correctly (platform admin only)
  - No changes to existing security model

  ## Data Migration
  - No existing data to migrate (table is empty)
  - Future inserts can now use NULL for organization_id
*/

-- Make organization_id nullable
ALTER TABLE ai_training_configurations
  ALTER COLUMN organization_id DROP NOT NULL;

-- Add explanatory comment
COMMENT ON COLUMN ai_training_configurations.organization_id IS
  'Organization that created this configuration. NULL indicates a global/platform-wide configuration managed by platform admin.';

-- Verify the change was applied
DO $$
DECLARE
  v_is_nullable text;
BEGIN
  SELECT is_nullable INTO v_is_nullable
  FROM information_schema.columns
  WHERE table_name = 'ai_training_configurations'
    AND column_name = 'organization_id';
  
  IF v_is_nullable != 'YES' THEN
    RAISE EXCEPTION 'Failed to make organization_id nullable. Current is_nullable: %', v_is_nullable;
  END IF;
  
  RAISE NOTICE 'Successfully made organization_id nullable';
END $$;
