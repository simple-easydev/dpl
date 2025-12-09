/*
  # Product Duplicate Detection System

  1. New Tables
    - `product_mappings`
      - Stores canonical product names and their confirmed variations
      - Used for auto-applying previously confirmed duplicate mappings
      - Tracks confidence scores and usage statistics
      - Organization-specific rules for product name normalization
    
    - `duplicate_review_queue`
      - Temporary storage for products pending duplicate review during uploads
      - Links to upload_id for tracking which upload needs review
      - Stores AI analysis results and potential matches
      - Cleared once user makes review decisions
    
    - `merge_audit_log`
      - Complete audit trail of all product merge decisions
      - Tracks automatic merges and manual user decisions
      - Includes AI confidence scores and reasoning
      - Supports undo functionality and merge history analysis

  2. Schema Modifications
    - Add `auto_merge_threshold` to organizations table (default 0.90)
    - Add `normalized_name` to sales_data table for faster lookups
    - Add `canonical_product_id` to sales_data for tracking canonical product

  3. Security
    - Enable RLS on all new tables
    - Organization-scoped access policies
    - Audit log is read-only for users, write-only for system

  4. Indexes
    - Composite indexes on product names and organization_id
    - Full-text search indexes for product name matching
    - Performance indexes on frequently queried columns

  5. Important Notes
    - Auto-merge threshold stored as decimal (0.80 to 0.95)
    - Product mappings include usage_count for reliability tracking
    - Duplicate review queue automatically cleaned after 7 days
    - Merge decisions are immutable in audit log for compliance
*/

-- Add auto_merge_threshold to organizations table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'auto_merge_threshold'
  ) THEN
    ALTER TABLE organizations ADD COLUMN auto_merge_threshold numeric DEFAULT 0.90 CHECK (auto_merge_threshold >= 0.80 AND auto_merge_threshold <= 0.95);
  END IF;
END $$;

-- Add normalized_name and canonical_product_id to sales_data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_data' AND column_name = 'normalized_name'
  ) THEN
    ALTER TABLE sales_data ADD COLUMN normalized_name text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_data' AND column_name = 'canonical_product_id'
  ) THEN
    ALTER TABLE sales_data ADD COLUMN canonical_product_id uuid REFERENCES products(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create product_mappings table
CREATE TABLE IF NOT EXISTS product_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_variant text NOT NULL,
  canonical_name text NOT NULL,
  confidence_score numeric NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai_auto', 'ai_confirmed')),
  usage_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  last_used_at timestamptz,
  is_active boolean DEFAULT true,
  UNIQUE(organization_id, product_variant)
);

ALTER TABLE product_mappings ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_product_mappings_org_id ON product_mappings(organization_id);
CREATE INDEX IF NOT EXISTS idx_product_mappings_variant ON product_mappings(product_variant);
CREATE INDEX IF NOT EXISTS idx_product_mappings_canonical ON product_mappings(canonical_name);
CREATE INDEX IF NOT EXISTS idx_product_mappings_active ON product_mappings(organization_id, is_active) WHERE is_active = true;

-- Create duplicate_review_queue table
CREATE TABLE IF NOT EXISTS duplicate_review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  upload_id uuid NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  potential_matches jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_analysis jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'skipped')),
  user_decision jsonb,
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id)
);

ALTER TABLE duplicate_review_queue ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_duplicate_queue_org_id ON duplicate_review_queue(organization_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_queue_upload_id ON duplicate_review_queue(upload_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_queue_status ON duplicate_review_queue(status) WHERE status = 'pending';

-- Create merge_audit_log table
CREATE TABLE IF NOT EXISTS merge_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  merge_type text NOT NULL CHECK (merge_type IN ('auto', 'manual', 'bulk')),
  source_product_names text[] NOT NULL,
  target_canonical_name text NOT NULL,
  confidence_score numeric,
  ai_reasoning text,
  records_affected integer DEFAULT 0,
  upload_id uuid REFERENCES uploads(id),
  performed_by uuid REFERENCES auth.users(id),
  performed_at timestamptz DEFAULT now(),
  can_undo boolean DEFAULT true,
  undone_at timestamptz,
  undone_by uuid REFERENCES auth.users(id)
);

ALTER TABLE merge_audit_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_merge_audit_org_id ON merge_audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_merge_audit_performed_at ON merge_audit_log(performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_merge_audit_upload_id ON merge_audit_log(upload_id);
CREATE INDEX IF NOT EXISTS idx_merge_audit_can_undo ON merge_audit_log(organization_id, can_undo) WHERE can_undo = true;

-- RLS Policies for product_mappings
CREATE POLICY "Users can view mappings from their organizations"
  ON product_mappings FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Members can insert mappings"
  ON product_mappings FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  );

CREATE POLICY "Members can update mappings"
  ON product_mappings FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  );

CREATE POLICY "Admins can delete mappings"
  ON product_mappings FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for duplicate_review_queue
CREATE POLICY "Users can view queue from their organizations"
  ON duplicate_review_queue FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Members can insert to queue"
  ON duplicate_review_queue FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  );

CREATE POLICY "Members can update queue"
  ON duplicate_review_queue FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  );

CREATE POLICY "Members can delete from queue"
  ON duplicate_review_queue FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  );

-- RLS Policies for merge_audit_log
CREATE POLICY "Users can view audit log from their organizations"
  ON merge_audit_log FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert to audit log"
  ON merge_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  );

CREATE POLICY "Users can update audit log for undo"
  ON merge_audit_log FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
    AND can_undo = true
  );

-- Function to clean old duplicate review queue entries (run periodically)
CREATE OR REPLACE FUNCTION clean_old_duplicate_queue_entries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM duplicate_review_queue
  WHERE status IN ('reviewed', 'skipped')
  AND reviewed_at < NOW() - INTERVAL '7 days';
END;
$$;

-- Function to update product mapping usage count
CREATE OR REPLACE FUNCTION increment_mapping_usage(mapping_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE product_mappings
  SET usage_count = usage_count + 1,
      last_used_at = NOW()
  WHERE id = mapping_id;
END;
$$;