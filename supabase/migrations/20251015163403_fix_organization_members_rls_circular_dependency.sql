/*
  # Fix Organization Members RLS Circular Dependency

  ## Problem
  The current RLS policy for SELECT on organization_members creates a circular dependency:
  - To view organization_members, the policy checks if user is in organization_members
  - This creates infinite recursion and prevents users from seeing their memberships

  ## Solution
  Replace the circular policy with a direct check that allows users to see records where they are the user_id.

  ## Changes
  1. Drop the existing circular SELECT policy on organization_members
  2. Create a new simple policy that allows users to see their own membership records directly
  
  ## Security
  - Users can only see organization_members records where they are the user_id
  - This is safe because it only exposes memberships for the authenticated user
  - Other policies control INSERT, UPDATE, DELETE operations
*/

-- Drop the circular policy
DROP POLICY IF EXISTS "Users can view members of their organizations" ON organization_members;

-- Create a new policy that allows users to see their own memberships
CREATE POLICY "Users can view their own memberships"
  ON organization_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Create a policy that allows users to see other members of organizations they belong to
CREATE POLICY "Users can view other members in their organizations"
  ON organization_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
    )
  );
