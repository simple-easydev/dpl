/*
  # Add Global Distributors Management for Platform Admin

  ## Overview
  This migration ensures the distributors table exists with proper structure and adds
  comprehensive RLS policies for platform admin to manage global distributors.

  ## 1. Table Structure

  ### `distributors`
  - `id` (uuid, primary key)
  - `organization_id` (uuid, nullable) - NULL for global distributors
  - `name` (text, not null, unique) - Distributor name
  - `state` (text, nullable) - State/region
  - `supports_pdf` (boolean, default true)
  - `contact_email` (text, nullable)
  - `contact_phone` (text, nullable)
  - `active` (boolean, default true)
  - `is_global` (boolean, default false) - TRUE for platform-wide distributors
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `organization_distributors` (junction table)
  Links organizations to distributors they've added to their account
  - `id` (uuid, primary key)
  - `organization_id` (uuid, foreign key)
  - `distributor_id` (uuid, foreign key)
  - `state` (text, nullable) - Organization-specific state override
  - `added_by` (uuid, foreign key to auth.users)
  - `is_favorited` (boolean, default false)
  - `last_used_at` (timestamptz)
  - `usage_count` (integer, default 0)
  - `created_at` (timestamptz)

  ## 2. Security

  ### RLS Policies for `distributors`
  - All authenticated users can view all distributors (global and org-specific)
  - Organization members can create custom (non-global) distributors for their org
  - Organization members can update their own custom distributors
  - Platform admin can create, update, and delete ALL distributors including global ones
  - Platform admin can manage the is_global flag

  ### RLS Policies for `organization_distributors`
  - Organization members can view their organization's distributor associations
  - Organization members can add/remove distributors from their organization
  - Platform admin can view all organization-distributor associations

  ## 3. Indexes
  - Index on is_global for efficient filtering
  - Index on organization_id for org-specific queries
  - Index on name for search functionality
  - Composite index on (organization_id, distributor_id) for junction table

  ## 4. Important Notes
  - Global distributors have organization_id = NULL and is_global = TRUE
  - Custom distributors have organization_id set and is_global = FALSE
  - Platform admin is identified via is_platform_admin() function
  - Brands add global distributors to their account via organization_distributors
*/

-- Create distributors table if it doesn't exist
CREATE TABLE IF NOT EXISTS distributors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  state text,
  supports_pdf boolean DEFAULT true,
  contact_email text,
  contact_phone text,
  active boolean DEFAULT true,
  is_global boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add unique constraint on name for global distributors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'distributors_global_name_unique'
  ) THEN
    CREATE UNIQUE INDEX distributors_global_name_unique
      ON distributors(LOWER(name))
      WHERE is_global = true;
  END IF;
END $$;

-- Create organization_distributors junction table if it doesn't exist
CREATE TABLE IF NOT EXISTS organization_distributors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  distributor_id uuid NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  state text,
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_favorited boolean DEFAULT false,
  last_used_at timestamptz,
  usage_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, distributor_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_distributors_org_id ON distributors(organization_id);
CREATE INDEX IF NOT EXISTS idx_distributors_is_global ON distributors(is_global) WHERE is_global = true;
CREATE INDEX IF NOT EXISTS idx_distributors_name ON distributors(LOWER(name));
CREATE INDEX IF NOT EXISTS idx_distributors_active ON distributors(active) WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_org_distributors_org_id ON organization_distributors(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_distributors_distributor_id ON organization_distributors(distributor_id);
CREATE INDEX IF NOT EXISTS idx_org_distributors_lookup ON organization_distributors(organization_id, distributor_id);

-- Enable RLS
ALTER TABLE distributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_distributors ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to recreate them
DROP POLICY IF EXISTS "All users can view all distributors" ON distributors;
DROP POLICY IF EXISTS "Users can create custom distributors for their organization" ON distributors;
DROP POLICY IF EXISTS "Users can update custom distributors for their organization" ON distributors;
DROP POLICY IF EXISTS "Platform admin can manage all distributors" ON distributors;

DROP POLICY IF EXISTS "Users can view their organization's distributors" ON organization_distributors;
DROP POLICY IF EXISTS "Users can add distributors to their organization" ON organization_distributors;
DROP POLICY IF EXISTS "Users can remove distributors from their organization" ON organization_distributors;
DROP POLICY IF EXISTS "Platform admin can view all organization distributors" ON organization_distributors;

-- RLS Policies for distributors table

-- All authenticated users can view all distributors (both global and org-specific visible to members)
CREATE POLICY "All users can view all distributors"
  ON distributors FOR SELECT
  TO authenticated
  USING (
    is_global = true
    OR
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
    OR
    is_platform_admin()
  );

-- Organization members can create custom (non-global) distributors for their org
CREATE POLICY "Users can create custom distributors for their organization"
  ON distributors FOR INSERT
  TO authenticated
  WITH CHECK (
    is_global = false
    AND organization_id IS NOT NULL
    AND organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  );

-- Organization members can update their own custom distributors
CREATE POLICY "Users can update custom distributors for their organization"
  ON distributors FOR UPDATE
  TO authenticated
  USING (
    is_global = false
    AND organization_id IS NOT NULL
    AND organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  )
  WITH CHECK (
    is_global = false
    AND organization_id IS NOT NULL
    AND organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  );

-- Platform admin can manage ALL distributors (create, update, delete, including global)
CREATE POLICY "Platform admin can manage all distributors"
  ON distributors FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- RLS Policies for organization_distributors table

-- Users can view their organization's distributor associations
CREATE POLICY "Users can view their organization's distributors"
  ON organization_distributors FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
    OR is_platform_admin()
  );

-- Users can add distributors to their organization
CREATE POLICY "Users can add distributors to their organization"
  ON organization_distributors FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  );

-- Users can update distributor associations in their organization
CREATE POLICY "Users can update their organization's distributors"
  ON organization_distributors FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  );

-- Users can remove distributors from their organization
CREATE POLICY "Users can remove distributors from their organization"
  ON organization_distributors FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
    OR is_platform_admin()
  );

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_distributors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_distributors_updated_at ON distributors;
CREATE TRIGGER trigger_update_distributors_updated_at
  BEFORE UPDATE ON distributors
  FOR EACH ROW
  EXECUTE FUNCTION update_distributors_updated_at();

-- Add helpful comments
COMMENT ON TABLE distributors IS
  'Distributors table supporting both global (platform-wide) and organization-specific custom distributors';

COMMENT ON COLUMN distributors.is_global IS
  'TRUE for platform-wide distributors managed by platform admin, FALSE for organization-specific custom distributors';

COMMENT ON COLUMN distributors.organization_id IS
  'NULL for global distributors, set for organization-specific custom distributors';

COMMENT ON TABLE organization_distributors IS
  'Junction table linking organizations to distributors they have added to their account';

COMMENT ON COLUMN organization_distributors.state IS
  'Organization-specific state override for this distributor relationship';
