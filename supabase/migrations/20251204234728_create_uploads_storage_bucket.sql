/*
  # Create Uploads Storage Bucket

  ## Overview
  Creates the Supabase Storage bucket for storing uploaded files that can be reprocessed.

  ## 1. Storage Bucket
  Creates the `uploads-storage` bucket with:
  - Private access (requires authentication)
  - Organized by organization_id/upload_id/filename
  - File size limit: 50MB
  - Allowed file types: CSV, Excel, PDF

  ## 2. Storage Policies
  - Users can upload files to their organization's folder
  - Users can read files from their organization's folder
  - Users can delete files from their organization's folder

  ## 3. Important Notes
  - All uploaded files are stored at path: uploads/{org_id}/{upload_id}/{filename}
  - Only authenticated organization members can access their org's files
  - Storage bucket is private by default
*/

-- Create the uploads-storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uploads-storage',
  'uploads-storage',
  false, -- private bucket
  52428800, -- 50MB limit
  ARRAY[
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload files to their org folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can read files from their org folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete files from their org folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can update files in their org folder" ON storage.objects;

-- Policy: Allow authenticated users to upload files to their organization's folder
CREATE POLICY "Users can upload files to their org folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'uploads-storage' AND
  -- Extract organization_id from path (uploads/{org_id}/...)
  (storage.foldername(name))[1] IN (
    SELECT organization_id::text
    FROM organization_members
    WHERE user_id = auth.uid()
  )
);

-- Policy: Allow authenticated users to read files from their organization's folder
CREATE POLICY "Users can read files from their org folder"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'uploads-storage' AND
  (storage.foldername(name))[1] IN (
    SELECT organization_id::text
    FROM organization_members
    WHERE user_id = auth.uid()
  )
);

-- Policy: Allow authenticated users to delete files from their organization's folder
CREATE POLICY "Users can delete files from their org folder"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'uploads-storage' AND
  (storage.foldername(name))[1] IN (
    SELECT organization_id::text
    FROM organization_members
    WHERE user_id = auth.uid()
  )
);

-- Policy: Allow authenticated users to update files in their organization's folder
CREATE POLICY "Users can update files in their org folder"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'uploads-storage' AND
  (storage.foldername(name))[1] IN (
    SELECT organization_id::text
    FROM organization_members
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'uploads-storage' AND
  (storage.foldername(name))[1] IN (
    SELECT organization_id::text
    FROM organization_members
    WHERE user_id = auth.uid()
  )
);
