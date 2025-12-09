/*
  # Restrict AI Training Configurations to Platform Admin Only

  1. Changes
    - Remove existing organization-based access policies on ai_training_configurations
    - Add new policies that restrict ALL operations to platform admin only
    - Only users with is_platform_admin() = true can view and manage configurations

  2. Security
    - All SELECT, INSERT, UPDATE, DELETE operations require platform admin access
    - Regular users will be completely blocked from accessing AI training data
    - Existing data remains intact, only access permissions change

  3. Important Notes
    - This makes AI Training an exclusive platform admin feature
    - Regular brand users will no longer see or interact with AI training configs
    - Platform admin must be configured in platform_admin_config table first
*/

-- Drop existing policies that allow organization member access
DROP POLICY IF EXISTS "Users can read AI training configurations for own organization" ON ai_training_configurations;
DROP POLICY IF EXISTS "Admins can insert AI training configurations" ON ai_training_configurations;
DROP POLICY IF EXISTS "Admins can update AI training configurations" ON ai_training_configurations;
DROP POLICY IF EXISTS "Admins can delete AI training configurations" ON ai_training_configurations;

-- Keep the existing platform admin view policy, add the rest
-- The SELECT policy already exists from previous migration

-- Platform admin can create AI training configurations
CREATE POLICY "Platform admin can create ai_training_configurations"
  ON ai_training_configurations FOR INSERT
  TO authenticated
  WITH CHECK (is_platform_admin());

-- Platform admin can update AI training configurations
CREATE POLICY "Platform admin can update ai_training_configurations"
  ON ai_training_configurations FOR UPDATE
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Platform admin can delete AI training configurations
CREATE POLICY "Platform admin can delete ai_training_configurations"
  ON ai_training_configurations FOR DELETE
  TO authenticated
  USING (is_platform_admin());
