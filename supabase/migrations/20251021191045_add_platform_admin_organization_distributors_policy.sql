/*
  # Add Platform Admin Access to Organization Distributors

  ## Overview
  This migration adds a missing RLS policy to allow platform admins to view all
  organization-distributor relationships across all brands.

  ## Changes
  1. Add SELECT policy on `organization_distributors` for platform admins
  2. This allows platform admins to see which brands have added which distributors

  ## Security
  - Policy is restricted to authenticated users who are platform admins
  - Uses the existing `is_platform_admin()` function for verification
*/

-- Add platform admin SELECT policy for organization_distributors
DROP POLICY IF EXISTS "Platform admin can view all organization distributors" ON organization_distributors;
CREATE POLICY "Platform admin can view all organization distributors"
  ON organization_distributors FOR SELECT
  TO authenticated
  USING (is_platform_admin());

-- Add platform admin ALL operations policy for organization_distributors
DROP POLICY IF EXISTS "Platform admin can manage all organization distributors" ON organization_distributors;
CREATE POLICY "Platform admin can manage all organization distributors"
  ON organization_distributors FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());
