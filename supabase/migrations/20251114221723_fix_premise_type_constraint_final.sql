/*
  # Final Fix for Premise Type Constraint

  1. Changes
    - Drop ALL check constraints on the premise_type column (regardless of name)
    - Recreate a single, properly named constraint
    - Ensure constraint allows all four valid values: on_premise, off_premise, unclassified, online
    - Add validation to ensure no duplicate constraints exist

  2. Purpose
    This migration resolves constraint naming inconsistencies that cause "accounts_premise_type_check"
    errors when trying to update premise_type values. It performs a clean sweep of all premise_type
    constraints and recreates them with the correct definition.

  3. Notes
    - Safe to run multiple times (idempotent)
    - Preserves all existing data
    - Uses dynamic SQL to find and drop constraints by their actual names in pg_constraint
    - Handles both 'premise_type_check' and 'accounts_premise_type_check' naming variations
*/

-- Drop all check constraints on accounts.premise_type column
DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  -- Find all check constraints on the accounts table that reference premise_type
  FOR constraint_record IN
    SELECT con.conname
    FROM pg_constraint con
    INNER JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'accounts'
      AND con.contype = 'c'
      AND con.conname LIKE '%premise_type%'
      AND con.conname != 'premise_type_confidence_range'  -- Don't drop the confidence constraint
  LOOP
    -- Drop each constraint found
    EXECUTE format('ALTER TABLE accounts DROP CONSTRAINT IF EXISTS %I CASCADE', constraint_record.conname);
    RAISE NOTICE 'Dropped constraint: %', constraint_record.conname;
  END LOOP;
END $$;

-- Create the single, correct constraint
ALTER TABLE accounts ADD CONSTRAINT premise_type_check
  CHECK (premise_type IN ('on_premise', 'off_premise', 'unclassified', 'online'));

-- Verify the constraint was created successfully
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'premise_type_check' 
      AND conrelid = 'accounts'::regclass
      AND pg_get_constraintdef(oid) LIKE '%online%'
  ) THEN
    RAISE EXCEPTION 'Failed to create premise_type_check constraint with all four valid values';
  END IF;
  
  -- Ensure there's only ONE premise_type constraint (excluding confidence range)
  IF (SELECT COUNT(*) 
      FROM pg_constraint 
      WHERE conrelid = 'accounts'::regclass 
        AND contype = 'c'
        AND conname LIKE '%premise_type%'
        AND conname != 'premise_type_confidence_range') > 1 
  THEN
    RAISE EXCEPTION 'Multiple premise_type constraints detected - manual cleanup required';
  END IF;
  
  RAISE NOTICE 'Premise type constraint successfully configured';
END $$;
