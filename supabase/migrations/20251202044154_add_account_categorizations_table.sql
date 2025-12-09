/*
  # Add Account Categorizations Table

  1. New Tables
    - `account_categorizations`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key to organizations)
      - `account_name` (text, the account being categorized)
      - `category` (text, one of: large_active, small_active, large_loss, small_loss, one_time, inactive)
      - `confidence_score` (numeric, AI confidence from 0 to 1)
      - `reasoning` (text, AI's explanation for the categorization)
      - `categorized_at` (timestamptz, when the categorization was performed)
      - `baseline_avg` (numeric, average cases per month in baseline period)
      - `recent_avg` (numeric, average cases per month in recent period)
      - `trend_percent` (numeric, percentage change from baseline to recent)
      - `total_orders` (integer, total number of orders)
      - `last_order_date` (date, date of most recent order)
      - `created_at` (timestamptz, record creation timestamp)
      - `updated_at` (timestamptz, last update timestamp)

  2. Security
    - Enable RLS on `account_categorizations` table
    - Add policies for organization members to read their categorizations
    - Add policies for authenticated users to insert/update categorizations for their organization

  3. Indexes
    - Add index on `organization_id` for efficient queries
    - Add index on `categorized_at` to check recategorization needs
    - Add unique constraint on `(organization_id, account_name)` to prevent duplicates
*/

-- Create account_categorizations table
CREATE TABLE IF NOT EXISTS account_categorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_name text NOT NULL,
  category text NOT NULL CHECK (category IN ('large_active', 'small_active', 'large_loss', 'small_loss', 'one_time', 'inactive')),
  confidence_score numeric CHECK (confidence_score >= 0 AND confidence_score <= 1),
  reasoning text,
  categorized_at timestamptz NOT NULL DEFAULT now(),
  baseline_avg numeric DEFAULT 0,
  recent_avg numeric DEFAULT 0,
  trend_percent numeric DEFAULT 0,
  total_orders integer DEFAULT 0,
  last_order_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, account_name)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_account_categorizations_org_id ON account_categorizations(organization_id);
CREATE INDEX IF NOT EXISTS idx_account_categorizations_categorized_at ON account_categorizations(categorized_at);
CREATE INDEX IF NOT EXISTS idx_account_categorizations_category ON account_categorizations(organization_id, category);

-- Enable RLS
ALTER TABLE account_categorizations ENABLE ROW LEVEL SECURITY;

-- Policy: Organization members can read their categorizations
CREATE POLICY "Organization members can read categorizations"
  ON account_categorizations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = account_categorizations.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- Policy: Organization members can insert categorizations
CREATE POLICY "Organization members can insert categorizations"
  ON account_categorizations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = account_categorizations.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- Policy: Organization members can update categorizations
CREATE POLICY "Organization members can update categorizations"
  ON account_categorizations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = account_categorizations.organization_id
      AND organization_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = account_categorizations.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- Policy: Organization members can delete categorizations
CREATE POLICY "Organization members can delete categorizations"
  ON account_categorizations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = account_categorizations.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_account_categorizations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER account_categorizations_updated_at
  BEFORE UPDATE ON account_categorizations
  FOR EACH ROW
  EXECUTE FUNCTION update_account_categorizations_updated_at();
