/*
  # Remove Document Extraction Features

  ## Overview
  This migration removes all document extraction functionality from the database,
  including extraction tables and columns, while preserving upload history and 
  core sales data functionality.

  ## 1. Tables to Remove
  
  ### `extracted_data`
  Drops the table that stored AI-extracted data from unstructured documents.
  
  ### `extraction_templates`
  Drops the table that stored custom extraction schema templates.

  ## 2. Column Removals

  ### `uploads` table
  - Remove `extraction_type` column (no longer needed without document extraction)

  ## 3. Important Notes
  
  - Upload history is preserved for audit purposes
  - All sales data, accounts, and products remain intact
  - Only extraction-specific tables and columns are removed
  - RLS policies for removed tables are automatically dropped
*/

-- Drop extracted_data table
DROP TABLE IF EXISTS extracted_data CASCADE;

-- Drop extraction_templates table
DROP TABLE IF EXISTS extraction_templates CASCADE;

-- Remove extraction_type column from uploads table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'uploads' AND column_name = 'extraction_type'
  ) THEN
    ALTER TABLE uploads DROP COLUMN extraction_type;
  END IF;
END $$;

-- Drop index for extraction_type if it exists
DROP INDEX IF EXISTS idx_uploads_extraction_type;
