/*
  # Column Mapping Intelligence System
  
  ## Overview
  Creates tables to support intelligent column mapping for file uploads with learning capabilities.
  This system helps automatically detect varying column names across different distributor files
  (e.g., "Cases" vs "Units" both meaning quantity).
  
  ## New Tables
  
  ### `field_synonyms`
  Stores known synonyms and aliases for each field type to improve automatic column detection.
  - `id` (uuid, primary key)
  - `field_type` (text) - The canonical field name (e.g., 'quantity', 'revenue', 'date')
  - `synonym` (text) - The actual column name variation (e.g., 'Cases', 'Units', 'Qty')
  - `organization_id` (uuid, nullable) - NULL for global synonyms, set for org-specific ones
  - `confidence_weight` (numeric) - Weight for prioritizing synonyms (0.0 to 1.0)
  - `usage_count` (integer) - Tracks how often this synonym successfully matched
  - `is_active` (boolean) - Whether this synonym is currently active
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### `column_mapping_history`
  Stores successful column mappings from past uploads to learn and improve detection over time.
  - `id` (uuid, primary key)
  - `organization_id` (uuid) - The organization this mapping belongs to
  - `upload_id` (uuid, nullable) - Reference to the upload that used this mapping
  - `distributor_id` (uuid, nullable) - The distributor this file came from
  - `filename_pattern` (text, nullable) - Pattern to match similar files (e.g., '%supplier%depletion%')
  - `detected_columns` (jsonb) - The actual column headers found in the file
  - `final_mapping` (jsonb) - The successful column mapping that worked
  - `confidence_score` (numeric) - How confident the mapping was (0.0 to 1.0)
  - `detection_method` (text) - How it was detected: 'openai', 'pattern', 'manual', 'learned'
  - `rows_processed` (integer) - Number of rows successfully processed
  - `success_rate` (numeric) - Percentage of rows that transformed successfully
  - `created_at` (timestamptz)
  
  ## Security
  - RLS enabled on both tables
  - Users can only read/write their organization's data
  - Global synonyms (organization_id = NULL) are readable by all authenticated users
  - Only authenticated users can insert/update data
  
  ## Indexes
  - Fast lookups by field_type and synonym for detection
  - Fast lookups by organization_id for learning
  - Fast lookups by distributor_id for distributor-specific patterns
  - Composite index on filename patterns for quick matching
*/

-- Create field_synonyms table
CREATE TABLE IF NOT EXISTS field_synonyms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_type text NOT NULL,
  synonym text NOT NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  confidence_weight numeric DEFAULT 1.0 CHECK (confidence_weight >= 0.0 AND confidence_weight <= 1.0),
  usage_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(field_type, synonym, organization_id)
);

-- Create column_mapping_history table
CREATE TABLE IF NOT EXISTS column_mapping_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  upload_id uuid REFERENCES uploads(id) ON DELETE SET NULL,
  distributor_id uuid REFERENCES distributors(id) ON DELETE SET NULL,
  filename_pattern text,
  detected_columns jsonb NOT NULL,
  final_mapping jsonb NOT NULL,
  confidence_score numeric DEFAULT 0.0 CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
  detection_method text DEFAULT 'pattern',
  rows_processed integer DEFAULT 0,
  success_rate numeric DEFAULT 0.0 CHECK (success_rate >= 0.0 AND success_rate <= 1.0),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_field_synonyms_field_type ON field_synonyms(field_type);
CREATE INDEX IF NOT EXISTS idx_field_synonyms_synonym ON field_synonyms(synonym);
CREATE INDEX IF NOT EXISTS idx_field_synonyms_org_id ON field_synonyms(organization_id);
CREATE INDEX IF NOT EXISTS idx_field_synonyms_active ON field_synonyms(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_mapping_history_org_id ON column_mapping_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_mapping_history_distributor ON column_mapping_history(distributor_id);
CREATE INDEX IF NOT EXISTS idx_mapping_history_upload ON column_mapping_history(upload_id);
CREATE INDEX IF NOT EXISTS idx_mapping_history_filename ON column_mapping_history(filename_pattern);
CREATE INDEX IF NOT EXISTS idx_mapping_history_created ON column_mapping_history(created_at DESC);

-- Enable RLS
ALTER TABLE field_synonyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE column_mapping_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for field_synonyms

-- Allow authenticated users to read global synonyms (organization_id IS NULL)
CREATE POLICY "Users can read global field synonyms"
  ON field_synonyms FOR SELECT
  TO authenticated
  USING (organization_id IS NULL AND is_active = true);

-- Allow authenticated users to read their organization's synonyms
CREATE POLICY "Users can read own organization field synonyms"
  ON field_synonyms FOR SELECT
  TO authenticated
  USING (
    organization_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = field_synonyms.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- Allow authenticated users to insert synonyms for their organization
CREATE POLICY "Users can insert field synonyms for own organization"
  ON field_synonyms FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = field_synonyms.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin')
    )
  );

-- Allow authenticated users to update synonyms for their organization
CREATE POLICY "Users can update field synonyms for own organization"
  ON field_synonyms FOR UPDATE
  TO authenticated
  USING (
    organization_id IS NOT NULL 
    AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = field_synonyms.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role IN ('owner', 'admin')
    )
  );

-- RLS Policies for column_mapping_history

-- Allow authenticated users to read their organization's mapping history
CREATE POLICY "Users can read own organization mapping history"
  ON column_mapping_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = column_mapping_history.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- Allow authenticated users to insert mapping history for their organization
CREATE POLICY "Users can insert mapping history for own organization"
  ON column_mapping_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = column_mapping_history.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- Insert global field synonyms (common variations across all industries)

-- Quantity synonyms
INSERT INTO field_synonyms (field_type, synonym, organization_id, confidence_weight) VALUES
  ('quantity', 'quantity', NULL, 1.0),
  ('quantity', 'qty', NULL, 1.0),
  ('quantity', 'units', NULL, 1.0),
  ('quantity', 'cases', NULL, 1.0),
  ('quantity', 'boxes', NULL, 0.9),
  ('quantity', 'count', NULL, 0.8),
  ('quantity', 'volume', NULL, 0.8),
  ('quantity', 'pieces', NULL, 0.9),
  ('quantity', 'pcs', NULL, 0.9),
  ('quantity', 'units sold', NULL, 1.0),
  ('quantity', 'qty sold', NULL, 1.0),
  ('quantity', 'quantity sold', NULL, 1.0),
  ('quantity', 'total units', NULL, 0.9),
  ('quantity', 'total qty', NULL, 0.9),
  ('quantity', 'ship qty', NULL, 0.8),
  ('quantity', 'shipped', NULL, 0.7),
  ('quantity', 'ordered', NULL, 0.7)
ON CONFLICT (field_type, synonym, organization_id) DO NOTHING;

-- Revenue/Amount synonyms
INSERT INTO field_synonyms (field_type, synonym, organization_id, confidence_weight) VALUES
  ('revenue', 'revenue', NULL, 1.0),
  ('revenue', 'amount', NULL, 1.0),
  ('revenue', 'total', NULL, 0.7),
  ('revenue', 'sales', NULL, 0.9),
  ('revenue', 'price', NULL, 0.7),
  ('revenue', 'value', NULL, 0.8),
  ('revenue', 'extended price', NULL, 1.0),
  ('revenue', 'total amount', NULL, 1.0),
  ('revenue', 'total sales', NULL, 1.0),
  ('revenue', 'sale amount', NULL, 1.0),
  ('revenue', 'net amount', NULL, 0.9),
  ('revenue', 'gross amount', NULL, 0.9),
  ('revenue', 'invoice amount', NULL, 1.0),
  ('revenue', 'order total', NULL, 1.0),
  ('revenue', 'line total', NULL, 0.9),
  ('revenue', 'ext price', NULL, 0.9)
ON CONFLICT (field_type, synonym, organization_id) DO NOTHING;

-- Date synonyms
INSERT INTO field_synonyms (field_type, synonym, organization_id, confidence_weight) VALUES
  ('date', 'date', NULL, 0.8),
  ('date', 'order date', NULL, 1.0),
  ('date', 'invoice date', NULL, 1.0),
  ('date', 'ship date', NULL, 0.9),
  ('date', 'sale date', NULL, 1.0),
  ('date', 'transaction date', NULL, 1.0),
  ('date', 'created date', NULL, 0.8),
  ('date', 'posted date', NULL, 0.9),
  ('date', 'delivery date', NULL, 0.8),
  ('date', 'order_date', NULL, 1.0),
  ('date', 'invoice_date', NULL, 1.0),
  ('date', 'ship_date', NULL, 0.9),
  ('date', 'sale_date', NULL, 1.0),
  ('date', 'purchased date', NULL, 0.9)
ON CONFLICT (field_type, synonym, organization_id) DO NOTHING;

-- Account/Customer synonyms
INSERT INTO field_synonyms (field_type, synonym, organization_id, confidence_weight) VALUES
  ('account', 'account', NULL, 1.0),
  ('account', 'customer', NULL, 1.0),
  ('account', 'client', NULL, 1.0),
  ('account', 'buyer', NULL, 0.9),
  ('account', 'company', NULL, 0.7),
  ('account', 'account name', NULL, 1.0),
  ('account', 'customer name', NULL, 1.0),
  ('account', 'client name', NULL, 1.0),
  ('account', 'ship to', NULL, 0.9),
  ('account', 'sold to', NULL, 0.9),
  ('account', 'bill to', NULL, 0.8),
  ('account', 'customer code', NULL, 0.8),
  ('account', 'account code', NULL, 0.8),
  ('account', 'acct', NULL, 0.9),
  ('account', 'cust', NULL, 0.9),
  ('account', 'store', NULL, 0.7),
  ('account', 'location', NULL, 0.6)
ON CONFLICT (field_type, synonym, organization_id) DO NOTHING;

-- Product synonyms
INSERT INTO field_synonyms (field_type, synonym, organization_id, confidence_weight) VALUES
  ('product', 'product', NULL, 1.0),
  ('product', 'item', NULL, 1.0),
  ('product', 'sku', NULL, 1.0),
  ('product', 'product name', NULL, 1.0),
  ('product', 'item name', NULL, 1.0),
  ('product', 'description', NULL, 0.8),
  ('product', 'item description', NULL, 0.9),
  ('product', 'product description', NULL, 1.0),
  ('product', 'item number', NULL, 1.0),
  ('product', 'product code', NULL, 1.0),
  ('product', 'part number', NULL, 0.9),
  ('product', 'material', NULL, 0.7),
  ('product', 'item code', NULL, 1.0),
  ('product', 'prod', NULL, 0.8)
ON CONFLICT (field_type, synonym, organization_id) DO NOTHING;

-- Order ID synonyms
INSERT INTO field_synonyms (field_type, synonym, organization_id, confidence_weight) VALUES
  ('order_id', 'order id', NULL, 1.0),
  ('order_id', 'order number', NULL, 1.0),
  ('order_id', 'order_id', NULL, 1.0),
  ('order_id', 'order_number', NULL, 1.0),
  ('order_id', 'transaction id', NULL, 0.9),
  ('order_id', 'invoice number', NULL, 0.9),
  ('order_id', 'invoice id', NULL, 0.9),
  ('order_id', 'reference', NULL, 0.7),
  ('order_id', 'po number', NULL, 0.8),
  ('order_id', 'order no', NULL, 1.0),
  ('order_id', 'invoice no', NULL, 0.9)
ON CONFLICT (field_type, synonym, organization_id) DO NOTHING;

-- Category synonyms
INSERT INTO field_synonyms (field_type, synonym, organization_id, confidence_weight) VALUES
  ('category', 'category', NULL, 1.0),
  ('category', 'product category', NULL, 1.0),
  ('category', 'type', NULL, 0.7),
  ('category', 'class', NULL, 0.8),
  ('category', 'classification', NULL, 0.9),
  ('category', 'group', NULL, 0.7),
  ('category', 'product type', NULL, 0.9),
  ('category', 'item category', NULL, 1.0),
  ('category', 'product class', NULL, 0.9)
ON CONFLICT (field_type, synonym, organization_id) DO NOTHING;

-- Region synonyms
INSERT INTO field_synonyms (field_type, synonym, organization_id, confidence_weight) VALUES
  ('region', 'region', NULL, 1.0),
  ('region', 'territory', NULL, 1.0),
  ('region', 'location', NULL, 0.8),
  ('region', 'area', NULL, 0.8),
  ('region', 'zone', NULL, 0.9),
  ('region', 'state', NULL, 0.8),
  ('region', 'province', NULL, 0.8),
  ('region', 'district', NULL, 0.9),
  ('region', 'sales region', NULL, 1.0),
  ('region', 'sales territory', NULL, 1.0)
ON CONFLICT (field_type, synonym, organization_id) DO NOTHING;

-- Distributor synonyms
INSERT INTO field_synonyms (field_type, synonym, organization_id, confidence_weight) VALUES
  ('distributor', 'distributor', NULL, 1.0),
  ('distributor', 'vendor', NULL, 0.9),
  ('distributor', 'supplier', NULL, 0.9),
  ('distributor', 'wholesaler', NULL, 1.0),
  ('distributor', 'dist', NULL, 0.9),
  ('distributor', 'distributor name', NULL, 1.0),
  ('distributor', 'vendor name', NULL, 0.9),
  ('distributor', 'supplier name', NULL, 0.9)
ON CONFLICT (field_type, synonym, organization_id) DO NOTHING;

-- Sales Representative synonyms
INSERT INTO field_synonyms (field_type, synonym, organization_id, confidence_weight) VALUES
  ('representative', 'representative', NULL, 1.0),
  ('representative', 'rep', NULL, 1.0),
  ('representative', 'sales rep', NULL, 1.0),
  ('representative', 'salesperson', NULL, 1.0),
  ('representative', 'account manager', NULL, 1.0),
  ('representative', 'sold by', NULL, 1.0),
  ('representative', 'agent', NULL, 0.8),
  ('representative', 'sales agent', NULL, 0.9),
  ('representative', 'sales person', NULL, 1.0),
  ('representative', 'rep name', NULL, 1.0),
  ('representative', 'sales representative', NULL, 1.0),
  ('representative', 'acct mgr', NULL, 0.9),
  ('representative', 'account rep', NULL, 1.0)
ON CONFLICT (field_type, synonym, organization_id) DO NOTHING;

-- Add comments
COMMENT ON TABLE field_synonyms IS 'Stores known synonyms and aliases for field types to improve automatic column detection across varying file formats';
COMMENT ON TABLE column_mapping_history IS 'Tracks successful column mappings from past uploads to learn and improve detection accuracy over time';
