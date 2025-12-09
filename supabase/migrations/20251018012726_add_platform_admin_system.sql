/*
  # Add Platform Admin System

  1. New Tables
    - `platform_admin_config`
      - `id` (uuid, primary key)
      - `platform_admin_user_id` (uuid, references auth.users) - The single platform admin user
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `brand_invitations`
      - `id` (uuid, primary key)
      - `email` (text, unique for pending invitations)
      - `company_name` (text)
      - `token` (text, unique)
      - `status` (text) - 'pending', 'accepted', 'expired', 'revoked'
      - `invited_by` (uuid, references auth.users)
      - `organization_id` (uuid, references organizations) - Set when invitation is accepted
      - `welcome_message` (text, nullable)
      - `expires_at` (timestamptz)
      - `accepted_at` (timestamptz, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Schema Changes
    - Add `created_by_platform_admin` (boolean, default false) to organizations
    - Add `platform_admin_notes` (text, nullable) to organizations

  3. Functions
    - `is_platform_admin()` - Check if current user is the platform admin
    - `get_platform_admin_user_id()` - Get the platform admin user ID

  4. Security
    - Enable RLS on new tables
    - Add policies for platform admin access to all tables
    - Ensure platform admin can view/edit all organization data

  5. Important Notes
    - After this migration runs, you must manually set the platform admin user ID
    - Run: INSERT INTO platform_admin_config (platform_admin_user_id) VALUES ('your-user-id-here');
    - Only one platform admin is supported by design
*/

-- Create platform_admin_config table
CREATE TABLE IF NOT EXISTS platform_admin_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_admin_user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE platform_admin_config ENABLE ROW LEVEL SECURITY;

-- Only one config row should exist
CREATE UNIQUE INDEX IF NOT EXISTS platform_admin_config_singleton ON platform_admin_config ((true));

-- Only platform admin can read/modify config
CREATE POLICY "Platform admin can read config"
  ON platform_admin_config FOR SELECT
  TO authenticated
  USING (auth.uid() = platform_admin_user_id);

CREATE POLICY "Platform admin can update config"
  ON platform_admin_config FOR UPDATE
  TO authenticated
  USING (auth.uid() = platform_admin_user_id)
  WITH CHECK (auth.uid() = platform_admin_user_id);

-- Create brand_invitations table
CREATE TABLE IF NOT EXISTS brand_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  company_name text NOT NULL,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  invited_by uuid REFERENCES auth.users(id),
  organization_id uuid REFERENCES organizations(id),
  welcome_message text,
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE brand_invitations ENABLE ROW LEVEL SECURITY;

-- Unique constraint for pending invitations
CREATE UNIQUE INDEX IF NOT EXISTS brand_invitations_email_pending_unique 
  ON brand_invitations (email) 
  WHERE status = 'pending';

-- Platform admin can manage all brand invitations
CREATE POLICY "Platform admin can manage brand invitations"
  ON brand_invitations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM platform_admin_config
      WHERE platform_admin_user_id = auth.uid()
    )
  );

-- Anyone can read their own pending invitation by token
CREATE POLICY "Users can read their invitation"
  ON brand_invitations FOR SELECT
  TO authenticated
  USING (status = 'pending' AND email = auth.jwt()->>'email');

-- Add fields to organizations
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'created_by_platform_admin'
  ) THEN
    ALTER TABLE organizations ADD COLUMN created_by_platform_admin boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'platform_admin_notes'
  ) THEN
    ALTER TABLE organizations ADD COLUMN platform_admin_notes text;
  END IF;
END $$;

-- Helper function: Check if current user is platform admin
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM platform_admin_config
    WHERE platform_admin_user_id = auth.uid()
  );
END;
$$;

-- Helper function: Get platform admin user ID
CREATE OR REPLACE FUNCTION get_platform_admin_user_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  admin_id uuid;
BEGIN
  SELECT platform_admin_user_id INTO admin_id
  FROM platform_admin_config
  LIMIT 1;
  
  RETURN admin_id;
END;
$$;

-- Update RLS policies to grant platform admin full access

-- Organizations: Platform admin can see and manage all organizations
DROP POLICY IF EXISTS "Platform admin can view all organizations" ON organizations;
CREATE POLICY "Platform admin can view all organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (is_platform_admin());

DROP POLICY IF EXISTS "Platform admin can update all organizations" ON organizations;
CREATE POLICY "Platform admin can update all organizations"
  ON organizations FOR UPDATE
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Organization members: Platform admin can view all members
DROP POLICY IF EXISTS "Platform admin can view all organization members" ON organization_members;
CREATE POLICY "Platform admin can view all organization members"
  ON organization_members FOR SELECT
  TO authenticated
  USING (is_platform_admin());

DROP POLICY IF EXISTS "Platform admin can manage organization members" ON organization_members;
CREATE POLICY "Platform admin can manage organization members"
  ON organization_members FOR ALL
  TO authenticated
  USING (is_platform_admin());

-- Sales data: Platform admin can view all sales data
DROP POLICY IF EXISTS "Platform admin can view all sales data" ON sales_data;
CREATE POLICY "Platform admin can view all sales data"
  ON sales_data FOR SELECT
  TO authenticated
  USING (is_platform_admin());

DROP POLICY IF EXISTS "Platform admin can manage all sales data" ON sales_data;
CREATE POLICY "Platform admin can manage all sales data"
  ON sales_data FOR ALL
  TO authenticated
  USING (is_platform_admin());

-- Accounts: Platform admin can view all accounts
DROP POLICY IF EXISTS "Platform admin can view all accounts" ON accounts;
CREATE POLICY "Platform admin can view all accounts"
  ON accounts FOR SELECT
  TO authenticated
  USING (is_platform_admin());

DROP POLICY IF EXISTS "Platform admin can manage all accounts" ON accounts;
CREATE POLICY "Platform admin can manage all accounts"
  ON accounts FOR ALL
  TO authenticated
  USING (is_platform_admin());

-- Products: Platform admin can view all products
DROP POLICY IF EXISTS "Platform admin can view all products" ON products;
CREATE POLICY "Platform admin can view all products"
  ON products FOR SELECT
  TO authenticated
  USING (is_platform_admin());

DROP POLICY IF EXISTS "Platform admin can manage all products" ON products;
CREATE POLICY "Platform admin can manage all products"
  ON products FOR ALL
  TO authenticated
  USING (is_platform_admin());

-- Uploads: Platform admin can view all uploads
DROP POLICY IF EXISTS "Platform admin can view all uploads" ON uploads;
CREATE POLICY "Platform admin can view all uploads"
  ON uploads FOR SELECT
  TO authenticated
  USING (is_platform_admin());

DROP POLICY IF EXISTS "Platform admin can manage all uploads" ON uploads;
CREATE POLICY "Platform admin can manage all uploads"
  ON uploads FOR ALL
  TO authenticated
  USING (is_platform_admin());

-- Tasks: Platform admin can view all tasks
DROP POLICY IF EXISTS "Platform admin can view all tasks" ON tasks;
CREATE POLICY "Platform admin can view all tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (is_platform_admin());

DROP POLICY IF EXISTS "Platform admin can manage all tasks" ON tasks;
CREATE POLICY "Platform admin can manage all tasks"
  ON tasks FOR ALL
  TO authenticated
  USING (is_platform_admin());

-- Alerts: Platform admin can view all alerts
DROP POLICY IF EXISTS "Platform admin can view all alerts" ON alerts;
CREATE POLICY "Platform admin can view all alerts"
  ON alerts FOR SELECT
  TO authenticated
  USING (is_platform_admin());

-- Invitations: Platform admin can view all invitations
DROP POLICY IF EXISTS "Platform admin can view all invitations" ON invitations;
CREATE POLICY "Platform admin can view all invitations"
  ON invitations FOR SELECT
  TO authenticated
  USING (is_platform_admin());

-- Audit logs: Platform admin can view all audit logs
DROP POLICY IF EXISTS "Platform admin can view all audit logs" ON audit_logs;
CREATE POLICY "Platform admin can view all audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (is_platform_admin());

-- Distributors: Platform admin can manage all distributors
DROP POLICY IF EXISTS "Platform admin can manage all distributors" ON distributors;
CREATE POLICY "Platform admin can manage all distributors"
  ON distributors FOR ALL
  TO authenticated
  USING (is_platform_admin());

-- AI Training Configurations: Platform admin can view all
DROP POLICY IF EXISTS "Platform admin can view all ai_training_configurations" ON ai_training_configurations;
CREATE POLICY "Platform admin can view all ai_training_configurations"
  ON ai_training_configurations FOR SELECT
  TO authenticated
  USING (is_platform_admin());

-- Inventory tables: Platform admin access
DROP POLICY IF EXISTS "Platform admin can view all inventory_importer" ON inventory_importer;
CREATE POLICY "Platform admin can view all inventory_importer"
  ON inventory_importer FOR SELECT
  TO authenticated
  USING (is_platform_admin());

DROP POLICY IF EXISTS "Platform admin can view all inventory_distributor" ON inventory_distributor;
CREATE POLICY "Platform admin can view all inventory_distributor"
  ON inventory_distributor FOR SELECT
  TO authenticated
  USING (is_platform_admin());

DROP POLICY IF EXISTS "Platform admin can view all inventory_transactions" ON inventory_transactions;
CREATE POLICY "Platform admin can view all inventory_transactions"
  ON inventory_transactions FOR SELECT
  TO authenticated
  USING (is_platform_admin());

-- FOB Pricing: Platform admin can view all
DROP POLICY IF EXISTS "Platform admin can view all fob_pricing_matrix" ON fob_pricing_matrix;
CREATE POLICY "Platform admin can view all fob_pricing_matrix"
  ON fob_pricing_matrix FOR SELECT
  TO authenticated
  USING (is_platform_admin());