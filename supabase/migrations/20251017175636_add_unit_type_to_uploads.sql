/*
  # Add Unit Type Selection to Uploads

  ## Overview
  This migration adds support for users to specify whether uploaded quantities 
  represent cases or bottles, ensuring data consistency throughout the platform.

  ## Changes
  1. Add `unit_type` column to uploads table
     - Values: 'cases' or 'bottles'
     - Default: 'cases' (most common industry standard)
     - Used during data processing to interpret quantity values

  ## Important Notes
  - This only affects new uploads going forward
  - The selected unit type is stored with each upload for full traceability
  - During processing, quantities will be converted to bottles based on this selection
*/

-- Add unit_type to uploads table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'uploads' AND column_name = 'unit_type'
  ) THEN
    ALTER TABLE uploads ADD COLUMN unit_type text DEFAULT 'cases'
      CHECK (unit_type IN ('cases', 'bottles'));
    COMMENT ON COLUMN uploads.unit_type IS 'User-selected unit type for quantities in this upload: cases or bottles';
  END IF;
END $$;

-- Create index for filtering by unit type
CREATE INDEX IF NOT EXISTS idx_uploads_unit_type ON uploads(unit_type);
