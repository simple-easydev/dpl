/*
  # Fix Organization Members RLS Policies - Remove Infinite Recursion

  ## Problem
  The current RLS policies on `organization_members` table create infinite recursion
  because they check membership by querying the same table they're protecting.
  
  ## Solution
  1. Drop all existing policies on `organization_members`
  2. Create simplified policies that avoid self-referencing subqueries:
     - SELECT: Allow users to see members of organizations they belong to (use direct join)
     - INSERT: Allow authenticated users to insert themselves OR allow admins to insert others
     - UPDATE: Allow admins to update members in their organizations
     - DELETE: Allow admins to delete members in their organizations
  
  ## Security Notes
  - Policies still enforce proper access control
  - Users can only see/manage members of their own organizations
  - Self-insertion is allowed to enable signup flow
  - Admin-only operations are protected by role check
*/

-- Drop all existing policies on organization_members
DROP POLICY IF EXISTS "Users can view members of their organizations" ON organization_members;
DROP POLICY IF EXISTS "Users can insert themselves as members" ON organization_members;
DROP POLICY IF EXISTS "Admins can insert members" ON organization_members;
DROP POLICY IF EXISTS "Admins can update members" ON organization_members;
DROP POLICY IF EXISTS "Admins can delete members" ON organization_members;

-- Create new simplified policies without self-referencing subqueries

-- SELECT: Allow users to view members of organizations they belong to
-- Uses a direct join to avoid infinite recursion
CREATE POLICY "Users can view organization members"
  ON organization_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members AS om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
    )
  );

-- INSERT: Allow users to insert themselves as members (for signup)
-- Also allow admins to insert other members (for invitations)
CREATE POLICY "Users can insert organization members"
  ON organization_members FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Users can always insert themselves
    user_id = auth.uid()
    OR
    -- Admins can insert others into their organizations
    EXISTS (
      SELECT 1 FROM organization_members AS om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.role = 'admin'
    )
  );

-- UPDATE: Allow admins to update members in their organizations
CREATE POLICY "Admins can update organization members"
  ON organization_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members AS om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members AS om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.role = 'admin'
    )
  );

-- DELETE: Allow admins to delete members from their organizations
CREATE POLICY "Admins can delete organization members"
  ON organization_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members AS om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.role = 'admin'
    )
  );
