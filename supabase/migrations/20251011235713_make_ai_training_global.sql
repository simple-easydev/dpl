/*
  # Make AI Training Configurations Global Per Distributor

  ## Changes

  1. Schema Updates
    - Make organization_id nullable (configs are now global per distributor)
    - Add unique constraint: only one active config per distributor
    - Add tested_successfully flag to track validation status
    - Update indexes to support global configs

  2. RLS Policy Updates
    - Allow all authenticated users to read all AI training configurations
    - Only admins from ANY organization can create/update/delete configs
    - Configs are now shared globally across all organizations using the same distributor

  3. Important Notes
    - AI training configurations are GLOBAL per distributor
    - Only ONE active configuration allowed per distributor at a time
    - All users benefit from improvements made by any organization
    - Created_by tracks who created it for accountability
*/

-- Step 1: Make organization_id nullable
ALTER TABLE ai_training_configurations
  ALTER COLUMN organization_id DROP NOT NULL;

-- Step 2: Add tested_successfully flag
ALTER TABLE ai_training_configurations
  ADD COLUMN IF NOT EXISTS tested_successfully boolean DEFAULT false;

-- Step 3: Add unique partial index for one active config per distributor
-- This enforces that only one active config can exist per distributor
DROP INDEX IF EXISTS unique_active_config_per_distributor;

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_config_per_distributor
  ON ai_training_configurations(distributor_id)
  WHERE is_active = true;

-- Step 4: Update indexes to remove organization-specific index
DROP INDEX IF EXISTS idx_ai_training_configs_org_id;

-- Step 5: Add index for global lookup by distributor
CREATE INDEX IF NOT EXISTS idx_ai_training_configs_distributor_active
  ON ai_training_configurations(distributor_id, is_active)
  WHERE is_active = true;

-- Step 6: Drop old RLS policies
DROP POLICY IF EXISTS "Users can read AI training configurations for own organization" ON ai_training_configurations;
DROP POLICY IF EXISTS "Admins can insert AI training configurations" ON ai_training_configurations;
DROP POLICY IF EXISTS "Admins can update AI training configurations" ON ai_training_configurations;
DROP POLICY IF EXISTS "Admins can delete AI training configurations" ON ai_training_configurations;

-- Step 7: Create new global RLS policies

-- All authenticated users can read all AI training configurations (they're global)
CREATE POLICY "All users can read AI training configurations"
  ON ai_training_configurations FOR SELECT
  TO authenticated
  USING (true);

-- Any admin user from any organization can create AI training configurations
CREATE POLICY "Admins can create AI training configurations"
  ON ai_training_configurations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin')
    )
    AND created_by = auth.uid()
  );

-- Any admin user from any organization can update AI training configurations
CREATE POLICY "Admins can update AI training configurations"
  ON ai_training_configurations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin')
    )
  );

-- Any admin user from any organization can delete AI training configurations
CREATE POLICY "Admins can delete AI training configurations"
  ON ai_training_configurations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin')
    )
  );

-- Step 8: Update table comment to reflect global nature
COMMENT ON TABLE ai_training_configurations IS
  'GLOBAL AI training configurations shared across all organizations. Each distributor can have ONE active configuration that guides data extraction for all users of that distributor.';

COMMENT ON COLUMN ai_training_configurations.organization_id IS
  'DEPRECATED: Kept for historical reference only. Configurations are now global per distributor.';

COMMENT ON COLUMN ai_training_configurations.tested_successfully IS
  'Whether this configuration has been successfully tested with sample data before activation';

-- Step 9: Create function to ensure only one active config per distributor
CREATE OR REPLACE FUNCTION ensure_single_active_config()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting a config to active, deactivate all other configs for this distributor
  IF NEW.is_active = true THEN
    UPDATE ai_training_configurations
    SET is_active = false
    WHERE distributor_id = NEW.distributor_id
      AND id != NEW.id
      AND is_active = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 10: Create trigger to enforce single active config
DROP TRIGGER IF EXISTS trigger_ensure_single_active_config ON ai_training_configurations;

CREATE TRIGGER trigger_ensure_single_active_config
  BEFORE INSERT OR UPDATE ON ai_training_configurations
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION ensure_single_active_config();
