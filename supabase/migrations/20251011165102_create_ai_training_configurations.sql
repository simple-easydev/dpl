/*
  # Create AI Training Configurations Table

  This migration creates the ai_training_configurations table for teaching the LLM
  how to extract and map data from distributor files for depletion analysis.

  ## 1. New Tables

  ### `ai_training_configurations`
  Stores AI training configurations for specific distributors to guide intelligent data extraction
  - `id` (uuid, primary key) - Unique identifier for the configuration
  - `organization_id` (uuid, foreign key) - Organization that owns this configuration
  - `distributor_id` (uuid, foreign key) - Distributor this configuration applies to
  - `configuration_name` (text) - Name of this configuration (e.g., "RNDC California Format")
  - `parsing_instructions` (text) - Instructions guiding the AI on data extraction
  - `field_mappings` (jsonb) - JSON hints and patterns for field identification
  - `orientation` (text) - Document orientation hint: 'auto', 'portrait', or 'landscape'
  - `is_active` (boolean) - Whether this configuration is currently active
  - `success_count` (integer) - Number of successful extractions using this config
  - `failure_count` (integer) - Number of failed extractions using this config
  - `last_successful_use` (timestamptz) - Timestamp of last successful use
  - `created_by` (uuid, foreign key) - User who created this configuration
  - `created_at` (timestamptz) - When the configuration was created
  - `updated_at` (timestamptz) - When the configuration was last updated

  ## 2. Security
  - RLS enabled on ai_training_configurations table
  - Users can read configurations for distributors in their organization
  - Admin users can create, update, and delete configurations
  - Configurations can be shared across organizations using the same distributor

  ## 3. Indexes
  - Fast lookups by organization_id
  - Fast lookups by distributor_id
  - Fast filtering by is_active status
  - Efficient sorting by success metrics and last use
*/

-- Create ai_training_configurations table
CREATE TABLE IF NOT EXISTS ai_training_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  distributor_id uuid NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  configuration_name text NOT NULL,
  parsing_instructions text DEFAULT '',
  field_mappings jsonb DEFAULT '{}'::jsonb,
  orientation text DEFAULT 'auto' CHECK (orientation IN ('auto', 'portrait', 'landscape')),
  is_active boolean DEFAULT true,
  success_count integer DEFAULT 0,
  failure_count integer DEFAULT 0,
  last_successful_use timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_training_configs_org_id ON ai_training_configurations(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_training_configs_distributor_id ON ai_training_configurations(distributor_id);
CREATE INDEX IF NOT EXISTS idx_ai_training_configs_active ON ai_training_configurations(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_ai_training_configs_success ON ai_training_configurations(success_count DESC, last_successful_use DESC NULLS LAST);

-- Enable RLS
ALTER TABLE ai_training_configurations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can read AI training configurations for their organization
CREATE POLICY "Users can read AI training configurations for own organization"
  ON ai_training_configurations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = ai_training_configurations.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- RLS Policy: Admin users can insert AI training configurations
CREATE POLICY "Admins can insert AI training configurations"
  ON ai_training_configurations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = ai_training_configurations.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin')
    )
    AND created_by = auth.uid()
  );

-- RLS Policy: Admin users can update AI training configurations
CREATE POLICY "Admins can update AI training configurations"
  ON ai_training_configurations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = ai_training_configurations.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin')
    )
  );

-- RLS Policy: Admin users can delete AI training configurations
CREATE POLICY "Admins can delete AI training configurations"
  ON ai_training_configurations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = ai_training_configurations.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin')
    )
  );

-- Add column comments for documentation
COMMENT ON TABLE ai_training_configurations IS
  'AI training configurations for teaching the LLM how to extract and map data from distributor files for depletion analysis';

COMMENT ON COLUMN ai_training_configurations.configuration_name IS
  'Name of this AI training configuration (e.g., "RNDC California Format")';

COMMENT ON COLUMN ai_training_configurations.parsing_instructions IS
  'Instructions that guide the AI on how to extract data from this distributor''s files';

COMMENT ON COLUMN ai_training_configurations.field_mappings IS
  'JSON hints and patterns to help the AI identify and map specific fields in the files';

COMMENT ON COLUMN ai_training_configurations.orientation IS
  'Document orientation hint for AI processing: auto, portrait, or landscape';

COMMENT ON COLUMN ai_training_configurations.success_count IS
  'Number of successful extractions using this configuration';

COMMENT ON COLUMN ai_training_configurations.failure_count IS
  'Number of failed extractions using this configuration';

COMMENT ON COLUMN ai_training_configurations.last_successful_use IS
  'Timestamp of the last successful use of this configuration';
