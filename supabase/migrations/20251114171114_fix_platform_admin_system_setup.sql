/*
  # Fix Platform Admin System Setup

  1. New Tables
    - `platform_admin_config`
      - `id` (uuid, primary key)
      - `platform_admin_user_id` (uuid, NOT NULL)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Functions
    - `is_platform_admin()` - Returns boolean indicating if current user is platform admin
    - `get_platform_admin_user_id()` - Returns the platform admin user ID

  3. Security
    - Enable RLS on platform_admin_config table
    - Add policies for platform admin access

  4. Important Notes
    - This creates the infrastructure needed for platform admin functionality
    - The table starts empty - you can optionally configure a platform admin later
    - Login will work without a platform admin configured
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