/*
  # Add Premise Type Classification to Accounts

  1. Changes
    - Add `premise_type` column to store account classification (on_premise, off_premise, unclassified)
    - Add `premise_type_confidence` column to store AI confidence score (0.0 to 1.0)
    - Add `premise_type_manual_override` column to track if user manually set the type
    - Add `premise_type_updated_at` column to track when classification was last updated

  2. Purpose
    This migration adds premise type classification fields to the accounts table to support
    automatic and manual classification of accounts as on-premise (bars, restaurants) or
    off-premise (retail stores). This classification is critical for sales analytics and reporting.

  3. Notes
    - All fields are nullable to support gradual rollout
    - Default value for premise_type is 'unclassified'
    - Confidence scores range from 0.0 (no confidence) to 1.0 (100% confident)
    - Manual overrides take precedence over AI classifications
    - Existing accounts will default to 'unclassified' and can be classified later
*/

-- Add premise type classification columns to accounts table
DO $$
BEGIN
  -- Add premise_type column with enum constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'premise_type'
  ) THEN
    ALTER TABLE accounts ADD COLUMN premise_type text DEFAULT 'unclassified';
    ALTER TABLE accounts ADD CONSTRAINT premise_type_check 
      CHECK (premise_type IN ('on_premise', 'off_premise', 'unclassified'));
  END IF;

  -- Add confidence score column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'premise_type_confidence'
  ) THEN
    ALTER TABLE accounts ADD COLUMN premise_type_confidence numeric;
    ALTER TABLE accounts ADD CONSTRAINT premise_type_confidence_range 
      CHECK (premise_type_confidence >= 0.0 AND premise_type_confidence <= 1.0);
  END IF;

  -- Add manual override flag
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'premise_type_manual_override'
  ) THEN
    ALTER TABLE accounts ADD COLUMN premise_type_manual_override boolean DEFAULT false;
  END IF;

  -- Add timestamp for when classification was updated
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'premise_type_updated_at'
  ) THEN
    ALTER TABLE accounts ADD COLUMN premise_type_updated_at timestamptz;
  END IF;
END $$;

-- Create index for filtering by premise type
CREATE INDEX IF NOT EXISTS idx_accounts_premise_type ON accounts(organization_id, premise_type);

-- Update existing accounts to have unclassified premise type if null
UPDATE accounts 
SET premise_type = 'unclassified' 
WHERE premise_type IS NULL;
