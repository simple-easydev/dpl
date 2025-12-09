/*
  # Add Package Type System for Flexible Packaging

  ## Overview
  This migration adds support for multiple package types (6-pack, 12-pack, single bottle, barrel)
  with package-specific FOB pricing to enable accurate revenue calculations.

  ## 1. New Package Types

  ### Package Type Options
  - `case_6` - Standard 6-bottle case
  - `case_12` - 12-bottle case
  - `single` - Individual bottles
  - `barrel` - Barrel (sold as 1 unit)

  ## 2. Schema Changes

  ### sales_data table
  - Add `package_type` (text) - Type of package sold
  - Add `bottles_per_unit` (integer) - Conversion factor for this package type
  - Update `quantity_in_bottles` calculation to use package-specific conversions

  ### products table
  - Add `available_package_types` (jsonb) - Array of available package types for this product
  - Add `default_package_type` (text) - Default package type for new orders

  ### fob_pricing_matrix table
  - Add `package_type` (text) - Package type for this FOB price
  - Update unique constraint to include package_type
  - Existing prices will be migrated to 'case_6' package type

  ## 3. Data Migration

  ### Existing Sales Data
  - Records with case_size=6 → package_type='case_6', bottles_per_unit=6
  - Records with case_size=12 → package_type='case_12', bottles_per_unit=12
  - Records with case_size IS NULL and quantity_unit='bottles' → package_type='single', bottles_per_unit=1
  - All other records → package_type='case_6', bottles_per_unit=6 (default)

  ### Existing Products
  - Set available_package_types=['case_6'] based on historical sales
  - Set default_package_type='case_6'

  ### Existing FOB Pricing
  - Migrate all existing FOB prices to package_type='case_6'

  ## 4. Indexes
  - Add index on sales_data.package_type for filtering
  - Add composite index on fob_pricing_matrix (organization_id, product_id, distributor_id, package_type)

  ## 5. Important Notes
  - Package type is required for all new sales records
  - FOB prices are package-specific for accurate revenue calculation
  - bottles_per_unit=1 for both 'single' and 'barrel' (barrel sold as 1 unit)
  - Backward compatible with existing data
*/

-- Add package_type to sales_data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_data' AND column_name = 'package_type'
  ) THEN
    ALTER TABLE sales_data ADD COLUMN package_type text DEFAULT 'case_6'
      CHECK (package_type IN ('case_6', 'case_12', 'single', 'barrel'));
    COMMENT ON COLUMN sales_data.package_type IS 'Type of package sold: case_6, case_12, single, or barrel';
  END IF;
END $$;

-- Add bottles_per_unit to sales_data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_data' AND column_name = 'bottles_per_unit'
  ) THEN
    ALTER TABLE sales_data ADD COLUMN bottles_per_unit integer DEFAULT 6 CHECK (bottles_per_unit > 0);
    COMMENT ON COLUMN sales_data.bottles_per_unit IS 'Number of bottles per unit for this package type';
  END IF;
END $$;

-- Migrate existing sales_data package types
UPDATE sales_data
SET
  package_type = CASE
    WHEN case_size = 12 THEN 'case_12'
    WHEN case_size = 6 THEN 'case_6'
    WHEN case_size IS NULL AND quantity_unit = 'bottles' THEN 'single'
    ELSE 'case_6'
  END,
  bottles_per_unit = CASE
    WHEN case_size = 12 THEN 12
    WHEN case_size = 6 THEN 6
    WHEN case_size IS NULL AND quantity_unit = 'bottles' THEN 1
    ELSE 6
  END
WHERE package_type = 'case_6' AND bottles_per_unit = 6;

-- Add available_package_types to products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'available_package_types'
  ) THEN
    ALTER TABLE products ADD COLUMN available_package_types jsonb DEFAULT '["case_6"]'::jsonb;
    COMMENT ON COLUMN products.available_package_types IS 'Array of available package types for this product';
  END IF;
END $$;

-- Add default_package_type to products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'default_package_type'
  ) THEN
    ALTER TABLE products ADD COLUMN default_package_type text DEFAULT 'case_6'
      CHECK (default_package_type IN ('case_6', 'case_12', 'single', 'barrel'));
    COMMENT ON COLUMN products.default_package_type IS 'Default package type for new orders';
  END IF;
END $$;

-- Set available_package_types based on historical sales data
UPDATE products p
SET available_package_types = (
  SELECT jsonb_agg(DISTINCT package_type)
  FROM sales_data s
  WHERE s.product_name = p.product_name
    AND s.organization_id = p.organization_id
)
WHERE EXISTS (
  SELECT 1 FROM sales_data s
  WHERE s.product_name = p.product_name
    AND s.organization_id = p.organization_id
);

-- Ensure all products have at least case_6 available
UPDATE products
SET available_package_types = '["case_6"]'::jsonb
WHERE available_package_types IS NULL OR available_package_types = '[]'::jsonb;

-- Add package_type to fob_pricing_matrix
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fob_pricing_matrix' AND column_name = 'package_type'
  ) THEN
    ALTER TABLE fob_pricing_matrix ADD COLUMN package_type text DEFAULT 'case_6'
      CHECK (package_type IN ('case_6', 'case_12', 'single', 'barrel'));
    COMMENT ON COLUMN fob_pricing_matrix.package_type IS 'Package type for this FOB price';
  END IF;
END $$;

-- Drop old unique constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fob_pricing_matrix_organization_id_product_id_distributor_id_key'
  ) THEN
    ALTER TABLE fob_pricing_matrix
    DROP CONSTRAINT fob_pricing_matrix_organization_id_product_id_distributor_id_key;
  END IF;
END $$;

-- Add new unique constraint including package_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fob_pricing_matrix_org_product_dist_package_key'
  ) THEN
    ALTER TABLE fob_pricing_matrix
    ADD CONSTRAINT fob_pricing_matrix_org_product_dist_package_key
    UNIQUE(organization_id, product_id, distributor_id, package_type);
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_data_package_type ON sales_data(package_type);
CREATE INDEX IF NOT EXISTS idx_fob_pricing_package_lookup
  ON fob_pricing_matrix(organization_id, product_id, distributor_id, package_type);

-- Drop old lookup index if it exists (without package_type)
DROP INDEX IF EXISTS idx_fob_pricing_lookup;
