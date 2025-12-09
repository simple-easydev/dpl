/*
  # Fix AI Training Configuration Constraints
  
  1. Changes
    - Add unique partial index to ensure only ONE active config per distributor
    - Add trigger function to automatically deactivate other configs when one is activated
    - Add extraction_stats JSONB column if not exists for tracking usage
  
  2. Important Notes
    - This ensures data integrity for the AI training workflow
    - Only one configuration can be active per distributor at any time
    - When activating a config, all others for that distributor are auto-deactivated
*/

-- Add extraction_stats column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ai_training_configurations' 
    AND column_name = 'extraction_stats'
  ) THEN
    ALTER TABLE ai_training_configurations 
      ADD COLUMN extraction_stats JSONB DEFAULT '{
        "total_extractions": 0,
        "successful_extractions": 0,
        "last_used": null
      }'::jsonb;
  END IF;
END $$;

-- Create unique partial index for one active config per distributor
DROP INDEX IF EXISTS unique_active_config_per_distributor;

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_config_per_distributor
  ON ai_training_configurations(distributor_id)
  WHERE is_active = true;

-- Create function to ensure only one active config per distributor
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

-- Create trigger to enforce single active config
DROP TRIGGER IF EXISTS trigger_ensure_single_active_config ON ai_training_configurations;

CREATE TRIGGER trigger_ensure_single_active_config
  BEFORE INSERT OR UPDATE ON ai_training_configurations
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION ensure_single_active_config();

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ai_training_configs_distributor_active
  ON ai_training_configurations(distributor_id, is_active)
  WHERE is_active = true;
