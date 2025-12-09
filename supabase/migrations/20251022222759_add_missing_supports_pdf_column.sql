/*
  # Add Missing supports_pdf Column to Distributors Table

  ## Overview
  This migration adds the missing `supports_pdf` column to the distributors table.
  This column is referenced in the TypeScript types and frontend code but was not
  present in the actual database schema.

  ## Changes
  1. Add `supports_pdf` boolean column with default value true
  2. Use IF NOT EXISTS pattern to safely add the column

  ## Notes
  - The column defaults to true (all distributors support PDF by default)
  - This fixes the "column distributors.supports_pdf does not exist" errors
  - Safe to run multiple times due to IF NOT EXISTS check
*/

-- Add supports_pdf column to distributors table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'distributors' AND column_name = 'supports_pdf'
  ) THEN
    ALTER TABLE distributors ADD COLUMN supports_pdf boolean DEFAULT true;
  END IF;
END $$;

-- Update any existing rows to have supports_pdf = true if null
UPDATE distributors SET supports_pdf = true WHERE supports_pdf IS NULL;