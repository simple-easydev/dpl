/*
  # Add Document Extraction Tables

  ## Overview
  This migration adds support for AI-powered document extraction, allowing organizations
  to upload unstructured documents and extract structured data (distributor, account_name,
  product_name, quantity, date).

  ## 1. New Tables

  ### `extracted_data`
  Stores structured data extracted from unstructured documents
  - `id` (uuid, primary key)
  - `organization_id` (uuid, foreign key) - Links to organizations
  - `upload_id` (uuid, foreign key) - Links to uploads table
  - `distributor` (text) - Extracted distributor/vendor name
  - `account_name` (text) - Extracted customer/account name
  - `product_name` (text) - Extracted product name
  - `quantity` (text) - Extracted quantity (stored as text to preserve original format)
  - `date` (text) - Extracted date (stored as text to preserve original format)
  - `confidence_score` (numeric) - AI confidence score (0-1)
  - `status` (text) - 'pending_review', 'approved', 'rejected'
  - `reviewed_by` (uuid) - User who reviewed the extraction
  - `reviewed_at` (timestamptz) - When the extraction was reviewed
  - `raw_extraction` (jsonb) - Full AI response for reference
  - `created_at` (timestamptz)

  ### `extraction_templates`
  Allows organizations to define custom extraction schemas and rules
  - `id` (uuid, primary key)
  - `organization_id` (uuid, foreign key)
  - `name` (text) - Template name
  - `description` (text) - Template description
  - `schema` (jsonb) - Field definitions and extraction rules
  - `is_default` (boolean) - Whether this is the default template
  - `created_by` (uuid) - User who created the template
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## 2. Table Modifications

  ### `sales_data`
  - Add `distributor` field to track distributor information separately

  ### `uploads`
  - Add `extraction_type` field to differentiate between 'sales_data' and 'document_extraction'

  ## 3. Security
  All tables have RLS enabled with policies ensuring users can only access data
  from organizations they belong to.

  ## 4. Indexes
  Performance indexes on frequently queried columns for efficient filtering and search.
*/

-- Add distributor column to sales_data table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_data' AND column_name = 'distributor'
  ) THEN
    ALTER TABLE sales_data ADD COLUMN distributor text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_data_distributor ON sales_data(distributor);

-- Add extraction_type column to uploads table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'uploads' AND column_name = 'extraction_type'
  ) THEN
    ALTER TABLE uploads ADD COLUMN extraction_type text DEFAULT 'sales_data' CHECK (extraction_type IN ('sales_data', 'document_extraction'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_uploads_extraction_type ON uploads(extraction_type);

-- Create extracted_data table
CREATE TABLE IF NOT EXISTS extracted_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  upload_id uuid NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
  distributor text DEFAULT '',
  account_name text DEFAULT '',
  product_name text DEFAULT '',
  quantity text DEFAULT '',
  date text DEFAULT '',
  confidence_score numeric DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  status text DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  raw_extraction jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE extracted_data ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_extracted_data_org_id ON extracted_data(organization_id);
CREATE INDEX IF NOT EXISTS idx_extracted_data_upload_id ON extracted_data(upload_id);
CREATE INDEX IF NOT EXISTS idx_extracted_data_status ON extracted_data(status);
CREATE INDEX IF NOT EXISTS idx_extracted_data_distributor ON extracted_data(distributor);
CREATE INDEX IF NOT EXISTS idx_extracted_data_account ON extracted_data(account_name);
CREATE INDEX IF NOT EXISTS idx_extracted_data_product ON extracted_data(product_name);
CREATE INDEX IF NOT EXISTS idx_extracted_data_created_at ON extracted_data(created_at DESC);

-- Create extraction_templates table
CREATE TABLE IF NOT EXISTS extraction_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  schema jsonb NOT NULL DEFAULT '{
    "fields": ["distributor", "account_name", "product_name", "quantity", "date"],
    "extraction_rules": {}
  }'::jsonb,
  is_default boolean DEFAULT false,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, name)
);

ALTER TABLE extraction_templates ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_extraction_templates_org_id ON extraction_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_extraction_templates_default ON extraction_templates(organization_id, is_default) WHERE is_default = true;

-- RLS Policies for extracted_data
CREATE POLICY "Users can view extracted data from their organizations"
  ON extracted_data FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Members can insert extracted data"
  ON extracted_data FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  );

CREATE POLICY "Members can update extracted data"
  ON extracted_data FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  );

CREATE POLICY "Admins can delete extracted data"
  ON extracted_data FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for extraction_templates
CREATE POLICY "Users can view templates from their organizations"
  ON extraction_templates FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert templates"
  ON extraction_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Admins can update templates"
  ON extraction_templates FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete templates"
  ON extraction_templates FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
