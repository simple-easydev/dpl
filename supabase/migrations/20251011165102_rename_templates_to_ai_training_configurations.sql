/*
  # Rename Templates to AI Training Configurations

  This migration renames the distributor_parsing_templates table to ai_training_configurations
  to better reflect its purpose: training LLMs on how to map files for depletion analysis.

  ## Changes

  1. **Table Rename**
    - Rename `distributor_parsing_templates` to `ai_training_configurations`
    - Update all constraints, indexes, and RLS policies
    - Maintain all existing data and relationships

  2. **Column Updates**
    - Rename `template_name` to `configuration_name`
    - Update column comments to reflect AI training purpose

  3. **Security**
    - Preserve all existing RLS policies with updated table name
    - Maintain authentication and authorization rules

  ## Notes
  - All data is preserved during the rename operation
  - Foreign key relationships are automatically updated
  - No application downtime required
*/

-- Step 1: Rename the table
ALTER TABLE IF EXISTS distributor_parsing_templates 
  RENAME TO ai_training_configurations;

-- Step 2: Rename the template_name column to configuration_name
ALTER TABLE IF EXISTS ai_training_configurations 
  RENAME COLUMN template_name TO configuration_name;

-- Step 3: Update column comments
COMMENT ON TABLE ai_training_configurations IS 
  'AI training configurations for teaching the LLM how to extract and map data from distributor files for depletion analysis';

COMMENT ON COLUMN ai_training_configurations.configuration_name IS 
  'Name of this AI training configuration (e.g., "RNDC California Format")';

COMMENT ON COLUMN ai_training_configurations.parsing_instructions IS 
  'Instructions that guide the AI on how to extract data from this distributor''s files';

COMMENT ON COLUMN ai_training_configurations.field_mappings IS 
  'JSON hints and patterns to help the AI identify and map specific fields in the files';

COMMENT ON COLUMN ai_training_configurations.extraction_stats IS 
  'Performance metrics showing how well the AI has learned to process files with this configuration';

-- Step 4: Verify the rename was successful
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'ai_training_configurations'
  ) THEN
    RAISE EXCEPTION 'Table rename failed: ai_training_configurations does not exist';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'distributor_parsing_templates'
  ) THEN
    RAISE EXCEPTION 'Old table still exists: distributor_parsing_templates should have been renamed';
  END IF;
END $$;