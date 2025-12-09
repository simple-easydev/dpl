/*
  # Background Duplicate Scanner System

  1. New Tables
    - `background_duplicate_candidates`
      - Stores potential duplicates found by background scanning
      - Links to specific products for easy reference
      - Tracks scan results and user decisions
      - Organization-scoped for multi-tenancy

    - `duplicate_scan_history`
      - Tracks when scans were performed
      - Records scan parameters and results
      - Helps prevent redundant scanning
      - Provides audit trail for scanning operations

  2. Schema Modifications
    - Add `last_duplicate_scan` to organizations table
    - Add `duplicate_scan_enabled` to organizations table (default true)
    - Add `scan_frequency_hours` to organizations table (default 24)

  3. Security
    - Enable RLS on all new tables
    - Organization-scoped access policies
    - Admins can configure scan settings

  4. Indexes
    - Composite indexes on product pairs and organization_id
    - Status indexes for pending candidate lookups
    - Performance indexes on scan history

  5. Important Notes
    - Background scanner runs automatically based on organization settings
    - Candidates are auto-archived after 30 days if not reviewed
    - Scan history is retained for 90 days for analytics
    - Notifications are sent when high-confidence duplicates are found
*/

-- Add background scanner settings to organizations table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'last_duplicate_scan'
  ) THEN
    ALTER TABLE organizations ADD COLUMN last_duplicate_scan timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'duplicate_scan_enabled'
  ) THEN
    ALTER TABLE organizations ADD COLUMN duplicate_scan_enabled boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'scan_frequency_hours'
  ) THEN
    ALTER TABLE organizations ADD COLUMN scan_frequency_hours integer DEFAULT 24 CHECK (scan_frequency_hours >= 1 AND scan_frequency_hours <= 168);
  END IF;
END $$;

-- Create background_duplicate_candidates table
CREATE TABLE IF NOT EXISTS background_duplicate_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product1_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product2_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product1_name text NOT NULL,
  product2_name text NOT NULL,
  confidence_score numeric NOT NULL,
  similarity_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'merged', 'dismissed', 'ignored')),
  detected_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id),
  user_decision jsonb,
  notification_sent boolean DEFAULT false,
  archived_at timestamptz,
  UNIQUE(organization_id, product1_id, product2_id)
);

ALTER TABLE background_duplicate_candidates ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_bg_dup_candidates_org_id ON background_duplicate_candidates(organization_id);
CREATE INDEX IF NOT EXISTS idx_bg_dup_candidates_status ON background_duplicate_candidates(organization_id, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_bg_dup_candidates_confidence ON background_duplicate_candidates(confidence_score DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_bg_dup_candidates_product1 ON background_duplicate_candidates(product1_id);
CREATE INDEX IF NOT EXISTS idx_bg_dup_candidates_product2 ON background_duplicate_candidates(product2_id);
CREATE INDEX IF NOT EXISTS idx_bg_dup_candidates_detected ON background_duplicate_candidates(detected_at DESC);

-- Create duplicate_scan_history table
CREATE TABLE IF NOT EXISTS duplicate_scan_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scan_started_at timestamptz DEFAULT now(),
  scan_completed_at timestamptz,
  products_scanned integer DEFAULT 0,
  candidates_found integer DEFAULT 0,
  high_confidence_count integer DEFAULT 0,
  scan_duration_seconds numeric,
  scan_parameters jsonb DEFAULT '{}'::jsonb,
  error_message text,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed'))
);

ALTER TABLE duplicate_scan_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_dup_scan_history_org_id ON duplicate_scan_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_dup_scan_history_started ON duplicate_scan_history(scan_started_at DESC);
CREATE INDEX IF NOT EXISTS idx_dup_scan_history_status ON duplicate_scan_history(status);

-- RLS Policies for background_duplicate_candidates
CREATE POLICY "Users can view candidates from their organizations"
  ON background_duplicate_candidates FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert candidates"
  ON background_duplicate_candidates FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  );

CREATE POLICY "Members can update candidates"
  ON background_duplicate_candidates FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  );

CREATE POLICY "Admins can delete candidates"
  ON background_duplicate_candidates FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for duplicate_scan_history
CREATE POLICY "Users can view scan history from their organizations"
  ON duplicate_scan_history FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert scan history"
  ON duplicate_scan_history FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  );

CREATE POLICY "System can update scan history"
  ON duplicate_scan_history FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  );

-- Function to get pending duplicate candidates count
CREATE OR REPLACE FUNCTION get_pending_duplicates_count(org_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pending_count integer;
BEGIN
  SELECT COUNT(*)::integer INTO pending_count
  FROM background_duplicate_candidates
  WHERE organization_id = org_id
  AND status = 'pending'
  AND archived_at IS NULL;

  RETURN pending_count;
END;
$$;

-- Function to archive old reviewed candidates
CREATE OR REPLACE FUNCTION archive_old_duplicate_candidates()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE background_duplicate_candidates
  SET archived_at = NOW()
  WHERE status IN ('merged', 'dismissed', 'ignored')
  AND reviewed_at < NOW() - INTERVAL '30 days'
  AND archived_at IS NULL;
END;
$$;

-- Function to clean old scan history
CREATE OR REPLACE FUNCTION clean_old_scan_history()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM duplicate_scan_history
  WHERE scan_started_at < NOW() - INTERVAL '90 days';
END;
$$;

-- Function to check if organization needs duplicate scan
CREATE OR REPLACE FUNCTION should_run_duplicate_scan(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  scan_enabled boolean;
  last_scan timestamptz;
  frequency_hours integer;
  should_scan boolean;
BEGIN
  SELECT
    duplicate_scan_enabled,
    last_duplicate_scan,
    scan_frequency_hours
  INTO scan_enabled, last_scan, frequency_hours
  FROM organizations
  WHERE id = org_id;

  IF NOT scan_enabled THEN
    RETURN false;
  END IF;

  IF last_scan IS NULL THEN
    RETURN true;
  END IF;

  should_scan := last_scan < NOW() - (frequency_hours || ' hours')::interval;

  RETURN should_scan;
END;
$$;
