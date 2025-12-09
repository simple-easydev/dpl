/*
  # Add File Storage Support to Uploads

  ## Overview
  This migration adds support for storing uploaded files in Supabase Storage
  to enable reprocessing of uploads with updated AI training configurations.

  ## 1. Table Modifications

  ### `uploads`
  Add columns to support file storage and reprocessing:
  - `file_path` (text, nullable) - Path to file in Supabase Storage
  - `is_reprocessable` (boolean) - Whether file can be reprocessed
  - `reprocessed_count` (integer) - Number of times upload has been reprocessed
  - `original_upload_id` (uuid, nullable) - Links to original upload if this is a reprocessed version
  - `reprocessed_at` (timestamptz, nullable) - When upload was last reprocessed
  - `reprocessing_results` (jsonb, nullable) - Stores comparison data from reprocessing

  ## 2. Indexes
  - Index on file_path for quick lookup
  - Index on original_upload_id for version tracking
  - Index on is_reprocessable for filtering

  ## 3. Important Notes
  - file_path stores the Supabase Storage path: uploads/{org_id}/{upload_id}/{filename}
  - is_reprocessable is automatically set to true when file_path is not null
  - original_upload_id creates a link between original and reprocessed versions
  - reprocessing_results stores metadata like record counts, confidence scores, etc.
*/

-- Add file storage columns to uploads table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'uploads' AND column_name = 'file_path'
  ) THEN
    ALTER TABLE uploads ADD COLUMN file_path text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'uploads' AND column_name = 'is_reprocessable'
  ) THEN
    ALTER TABLE uploads ADD COLUMN is_reprocessable boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'uploads' AND column_name = 'reprocessed_count'
  ) THEN
    ALTER TABLE uploads ADD COLUMN reprocessed_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'uploads' AND column_name = 'original_upload_id'
  ) THEN
    ALTER TABLE uploads ADD COLUMN original_upload_id uuid REFERENCES uploads(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'uploads' AND column_name = 'reprocessed_at'
  ) THEN
    ALTER TABLE uploads ADD COLUMN reprocessed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'uploads' AND column_name = 'reprocessing_results'
  ) THEN
    ALTER TABLE uploads ADD COLUMN reprocessing_results jsonb;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_uploads_file_path ON uploads(file_path) WHERE file_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_uploads_original_upload_id ON uploads(original_upload_id) WHERE original_upload_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_uploads_is_reprocessable ON uploads(is_reprocessable) WHERE is_reprocessable = true;

-- Add helpful comments
COMMENT ON COLUMN uploads.file_path IS 'Path to uploaded file in Supabase Storage for reprocessing';
COMMENT ON COLUMN uploads.is_reprocessable IS 'Whether this upload has a stored file that can be reprocessed';
COMMENT ON COLUMN uploads.reprocessed_count IS 'Number of times this upload has been reprocessed';
COMMENT ON COLUMN uploads.original_upload_id IS 'Links to the original upload if this is a reprocessed version';
COMMENT ON COLUMN uploads.reprocessed_at IS 'Timestamp of last reprocessing operation';
COMMENT ON COLUMN uploads.reprocessing_results IS 'Stores comparison data from reprocessing (record counts, confidence scores, etc.)';