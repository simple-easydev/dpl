/*
  # Fix Premise Type Constraint to Support Online Value

  1. Changes
    - Safely drop and recreate the premise_type check constraint
    - Ensure the constraint includes all four valid values: on_premise, off_premise, unclassified, online
    - Handle both constraint name variations (premise_type_check and accounts_premise_type_check)

  2. Purpose
    This migration ensures the accounts table premise_type constraint properly supports
    the 'online' value for e-commerce and direct-to-consumer sales channels. It fixes
    any constraint conflicts that may exist from previous migrations.

  3. Notes
    - This migration is idempotent and safe to run multiple times
    - Existing account data is not modified
    - All four premise type values are supported after this migration
*/

-- Drop any existing premise_type check constraints (handle both possible names)
DO $$
BEGIN
  -- Try dropping constraint with prefix
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'accounts_premise_type_check' 
    AND conrelid = 'accounts'::regclass
  ) THEN
    ALTER TABLE accounts DROP CONSTRAINT accounts_premise_type_check;
  END IF;

  -- Try dropping constraint without prefix
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'premise_type_check' 
    AND conrelid = 'accounts'::regclass
  ) THEN
    ALTER TABLE accounts DROP CONSTRAINT premise_type_check;
  END IF;
END $$;

-- Add the new constraint with all four valid values
ALTER TABLE accounts ADD CONSTRAINT premise_type_check
  CHECK (premise_type IN ('on_premise', 'off_premise', 'unclassified', 'online'));

-- Verify the constraint was created correctly
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'premise_type_check' 
    AND conrelid = 'accounts'::regclass
    AND pg_get_constraintdef(oid) LIKE '%online%'
  ) THEN
    RAISE EXCEPTION 'Failed to create premise_type_check constraint with online support';
  END IF;
END $$;
