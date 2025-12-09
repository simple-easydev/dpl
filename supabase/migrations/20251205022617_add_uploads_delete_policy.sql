/*
  # Add DELETE RLS Policy for Uploads Table

  ## Overview
  Adds the missing DELETE policy for the uploads table to allow users to delete their organization's uploads.

  ## Changes
  1. DROP existing incomplete policies if any
  2. CREATE new DELETE policy that allows:
     - Platform admins to delete any upload
     - Organization members to delete uploads from their organization

  ## Security
  - Only authenticated users can delete uploads
  - Users can only delete uploads from organizations they belong to
  - Platform admins have full delete access
*/

-- Drop existing DELETE policy if it exists
DROP POLICY IF EXISTS "Users can delete uploads" ON uploads;
DROP POLICY IF EXISTS "Members can delete uploads from their organizations" ON uploads;
DROP POLICY IF EXISTS "Platform admin can delete uploads" ON uploads;

-- Create consolidated DELETE policy for uploads
CREATE POLICY "Consolidated: Delete uploads"
  ON uploads FOR DELETE
  TO authenticated
  USING (
    -- Platform admin can delete ANY upload
    is_platform_admin()
    OR
    -- Regular users can delete uploads from their non-deleted organizations
    EXISTS (
      SELECT 1 FROM organization_members om
      JOIN organizations o ON o.id = om.organization_id
      WHERE om.organization_id = uploads.organization_id
      AND om.user_id = auth.uid()
      AND o.deleted_at IS NULL
    )
  );
