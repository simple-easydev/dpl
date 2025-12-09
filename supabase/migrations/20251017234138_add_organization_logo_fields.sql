/*
  # Add Organization Logo Support

  ## Summary
  Adds logo storage capabilities to organizations, allowing users to upload custom company logos.

  ## Changes

  ### New Columns Added to `organizations` table:
  - `logo_url` (text, nullable) - Public URL of the uploaded logo image
  - `logo_file_path` (text, nullable) - Storage path reference for the logo file

  ## Notes
  - Logo URLs will be generated after upload to Supabase Storage
  - Logo file paths are stored for reference and deletion management
  - Both fields are nullable to support organizations without custom logos
  - Default behavior: If no logo is set, the UI will display organization initial

  ## Security
  - RLS policies for organizations table already exist and will apply to these new fields
  - Storage bucket policies will be configured separately to control upload permissions
*/

-- Add logo fields to organizations table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE organizations ADD COLUMN logo_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'logo_file_path'
  ) THEN
    ALTER TABLE organizations ADD COLUMN logo_file_path text;
  END IF;
END $$;