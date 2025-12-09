/*
  # FOB Pricing System Implementation

  ## Overview
  This migration adds a comprehensive FOB (Free On Board) pricing system that allows:
  - Default FOB prices at the product level
  - Distributor-specific FOB price overrides
  - Calculated revenue based on cases sold × FOB price

  ## 1. Schema Changes

  ### Products Table
  - Add `default_fob_price` column to store base FOB price per case for each product

  ### New Table: `fob_pricing_matrix`
  Stores distributor-specific FOB price overrides
  - `id` (uuid, primary key)
  - `organization_id` (uuid, foreign key) - Links to organizations
  - `product_id` (uuid, foreign key) - Links to products
  - `distributor_id` (uuid, foreign key) - Links to distributors
  - `fob_price_override` (numeric) - Distributor-specific FOB price per case
  - `created_at` (timestamptz) - When override was created
  - `updated_at` (timestamptz) - Last modification timestamp
  - `created_by` (uuid) - User who created the override

  ## 2. Security

  ### Row Level Security (RLS)
  - FOB pricing matrix has RLS enabled
  - Users can only access FOB pricing data for their organizations

  ### Policies
  - Users can view FOB pricing from their organizations
  - Members can create and update FOB pricing
  - Admins can delete FOB pricing

  ## 3. Indexes
  - Composite index on (organization_id, product_id, distributor_id) for fast lookups
  - Individual indexes on product_id and distributor_id for matrix queries

  ## 4. Important Notes
  - FOB prices are stored per case (not per bottle)
  - Default FOB price is nullable to allow gradual migration
  - Distributor-specific overrides take precedence over default prices
  - Unique constraint prevents duplicate product-distributor combinations
*/

-- Add default_fob_price to products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'default_fob_price'
  ) THEN
    ALTER TABLE products ADD COLUMN default_fob_price numeric DEFAULT NULL;
    COMMENT ON COLUMN products.default_fob_price IS 'Default FOB (Free On Board) price per case for this product';
  END IF;
END $$;

-- Create fob_pricing_matrix table
CREATE TABLE IF NOT EXISTS fob_pricing_matrix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  distributor_id uuid NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  fob_price_override numeric NOT NULL CHECK (fob_price_override >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(organization_id, product_id, distributor_id)
);

ALTER TABLE fob_pricing_matrix ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_fob_pricing_org_id ON fob_pricing_matrix(organization_id);
CREATE INDEX IF NOT EXISTS idx_fob_pricing_product_id ON fob_pricing_matrix(product_id);
CREATE INDEX IF NOT EXISTS idx_fob_pricing_distributor_id ON fob_pricing_matrix(distributor_id);
CREATE INDEX IF NOT EXISTS idx_fob_pricing_lookup ON fob_pricing_matrix(organization_id, product_id, distributor_id);

-- RLS Policies for fob_pricing_matrix
CREATE POLICY "Users can view FOB pricing from their organizations"
  ON fob_pricing_matrix FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Members can create FOB pricing"
  ON fob_pricing_matrix FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Members can update FOB pricing"
  ON fob_pricing_matrix FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  );

CREATE POLICY "Admins can delete FOB pricing"
  ON fob_pricing_matrix FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_fob_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_fob_pricing_updated_at ON fob_pricing_matrix;
CREATE TRIGGER trigger_update_fob_pricing_updated_at
  BEFORE UPDATE ON fob_pricing_matrix
  FOR EACH ROW
  EXECUTE FUNCTION update_fob_pricing_updated_at();
