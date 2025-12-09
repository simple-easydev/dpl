/*
  # Add Soft Delete and Brand Management Functions

  1. Schema Changes
    - Add `deleted_at` (timestamptz, nullable) to organizations table for soft delete tracking
    - Add `deleted_by` (uuid, nullable) to organizations table to track who deleted it
    - Add `created_by_admin_user_id` (uuid, nullable) to organizations table to track which admin created it

  2. Database Functions
    - `soft_delete_organization(org_id uuid, reason text)` - Soft deletes an organization
    - `restore_organization(org_id uuid)` - Restores a soft-deleted organization
    - `create_organization_with_admin(org_name text, admin_email text, admin_user_id uuid)` - Creates organization and adds admin

  3. RLS Policy Updates
    - Update existing policies to exclude soft-deleted organizations from normal queries
    - Add platform admin policies to view and manage soft-deleted organizations

  4. Security
    - All functions restricted to platform admin users only
    - Comprehensive audit logging for all operations
    - Data preservation through soft delete mechanism

  5. Important Notes
    - Soft-deleted organizations remain in database with deleted_at timestamp
    - All related data (members, sales, uploads) is preserved
    - Platform admins can view and restore deleted organizations
    - Regular users cannot see soft-deleted organizations
*/

-- Add soft delete columns to organizations table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE organizations ADD COLUMN deleted_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'deleted_by'
  ) THEN
    ALTER TABLE organizations ADD COLUMN deleted_by uuid REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'created_by_admin_user_id'
  ) THEN
    ALTER TABLE organizations ADD COLUMN created_by_admin_user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Create index for soft delete queries
CREATE INDEX IF NOT EXISTS idx_organizations_deleted_at ON organizations(deleted_at) WHERE deleted_at IS NULL;

-- Function: Soft delete an organization
CREATE OR REPLACE FUNCTION soft_delete_organization(
  org_id uuid,
  deletion_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- Check if user is platform admin
  v_is_admin := is_platform_admin();
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Platform admin access required';
  END IF;

  -- Update organization to mark as deleted
  UPDATE organizations
  SET 
    deleted_at = now(),
    deleted_by = auth.uid(),
    platform_admin_notes = COALESCE(platform_admin_notes || E'\n\n', '') || 
      'DELETED: ' || COALESCE(deletion_reason, 'No reason provided') || 
      ' (at ' || now()::text || ')'
  WHERE id = org_id AND deleted_at IS NULL;

  -- Check if update was successful
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Log audit event
  INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, metadata)
  VALUES (
    org_id,
    auth.uid(),
    'soft_delete_organization',
    'organization',
    org_id,
    jsonb_build_object(
      'reason', deletion_reason,
      'deleted_at', now()
    )
  );

  RETURN true;
END;
$$;

-- Function: Restore a soft-deleted organization
CREATE OR REPLACE FUNCTION restore_organization(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- Check if user is platform admin
  v_is_admin := is_platform_admin();
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Platform admin access required';
  END IF;

  -- Update organization to restore it
  UPDATE organizations
  SET 
    deleted_at = NULL,
    deleted_by = NULL,
    platform_admin_notes = COALESCE(platform_admin_notes || E'\n\n', '') || 
      'RESTORED by platform admin at ' || now()::text
  WHERE id = org_id AND deleted_at IS NOT NULL;

  -- Check if update was successful
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Log audit event
  INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, metadata)
  VALUES (
    org_id,
    auth.uid(),
    'restore_organization',
    'organization',
    org_id,
    jsonb_build_object('restored_at', now())
  );

  RETURN true;
END;
$$;

-- Function: Create organization with admin user
CREATE OR REPLACE FUNCTION create_organization_with_admin(
  org_name text,
  admin_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin boolean;
  v_org_id uuid;
  v_user_exists boolean;
BEGIN
  -- Check if user is platform admin
  v_is_admin := is_platform_admin();
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Platform admin access required';
  END IF;

  -- Check if admin user exists in auth.users
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = admin_user_id) INTO v_user_exists;
  
  IF NOT v_user_exists THEN
    RAISE EXCEPTION 'Admin user does not exist';
  END IF;

  -- Create the organization
  INSERT INTO organizations (name, created_by_platform_admin, created_by_admin_user_id)
  VALUES (org_name, true, auth.uid())
  RETURNING id INTO v_org_id;

  -- Add the admin user as an organization member with admin role
  INSERT INTO organization_members (organization_id, user_id, role, invited_by)
  VALUES (v_org_id, admin_user_id, 'admin', auth.uid());

  -- Log audit event
  INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, metadata)
  VALUES (
    v_org_id,
    auth.uid(),
    'create_organization_with_admin',
    'organization',
    v_org_id,
    jsonb_build_object(
      'organization_name', org_name,
      'admin_user_id', admin_user_id,
      'created_at', now()
    )
  );

  RETURN v_org_id;
END;
$$;

-- Update RLS policies to exclude soft-deleted organizations for regular users
-- Drop and recreate the user access policies for organizations

DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;
CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
    )
  );

-- Platform admin can view all organizations including soft-deleted ones
DROP POLICY IF EXISTS "Platform admin can view all organizations" ON organizations;
CREATE POLICY "Platform admin can view all organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (is_platform_admin());

-- Update organization_members policies to respect soft delete
DROP POLICY IF EXISTS "Users can view organization members" ON organization_members;
CREATE POLICY "Users can view organization members"
  ON organization_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = organization_members.organization_id
      AND organizations.deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = organizations.id
        AND om.user_id = auth.uid()
      )
    )
  );

-- Update sales_data policies to respect soft delete
DROP POLICY IF EXISTS "Users can view sales data" ON sales_data;
CREATE POLICY "Users can view sales data"
  ON sales_data FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = sales_data.organization_id
      AND organizations.deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_members.organization_id = organizations.id
        AND organization_members.user_id = auth.uid()
      )
    )
  );

-- Update uploads policies to respect soft delete
DROP POLICY IF EXISTS "Users can view uploads" ON uploads;
CREATE POLICY "Users can view uploads"
  ON uploads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = uploads.organization_id
      AND organizations.deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_members.organization_id = organizations.id
        AND organization_members.user_id = auth.uid()
      )
    )
  );

-- Update accounts policies to respect soft delete
DROP POLICY IF EXISTS "Users can view accounts" ON accounts;
CREATE POLICY "Users can view accounts"
  ON accounts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = accounts.organization_id
      AND organizations.deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_members.organization_id = organizations.id
        AND organization_members.user_id = auth.uid()
      )
    )
  );

-- Update products policies to respect soft delete
DROP POLICY IF EXISTS "Users can view products" ON products;
CREATE POLICY "Users can view products"
  ON products FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = products.organization_id
      AND organizations.deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_members.organization_id = organizations.id
        AND organization_members.user_id = auth.uid()
      )
    )
  );
