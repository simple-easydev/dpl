/*
  # Create Organization Logos Storage Bucket

  ## Summary
  Creates a storage bucket for organization logos with appropriate security policies.

  ## Changes

  ### New Storage Bucket:
  - `organization-logos` - Stores company logo images

  ### Storage Policies:
  - Authenticated users can upload logos for their own organization
  - Authenticated users can update logos for their own organization
  - Authenticated users can delete logos for their own organization
  - Public read access for all logos (to display on any page)

  ## Security
  - Only organization admins can upload/update/delete logos
  - Logos are publicly readable to allow display without authentication
  - File paths include organization_id to prevent collisions
  - RLS ensures users can only modify logos for their own organizations

  ## Notes
  - Supported formats: PNG, JPG, JPEG, SVG
  - Maximum file size: 2MB (enforced at application level)
  - File naming convention: {organization_id}/{timestamp}-{filename}
*/

-- Create the storage bucket for organization logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'organization-logos',
  'organization-logos',
  true,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload logos for their organization
CREATE POLICY "Users can upload logos for their organization"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'organization-logos' 
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text
    FROM organization_members
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- Policy: Allow authenticated users to update logos for their organization
CREATE POLICY "Users can update logos for their organization"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'organization-logos'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text
    FROM organization_members
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- Policy: Allow authenticated users to delete logos for their organization
CREATE POLICY "Users can delete logos for their organization"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'organization-logos'
  AND (storage.foldername(name))[1] IN (
    SELECT organization_id::text
    FROM organization_members
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- Policy: Allow public read access to all logos
CREATE POLICY "Public read access for organization logos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'organization-logos');