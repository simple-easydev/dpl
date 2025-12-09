/*
  # Add Package Type System to Sales Data

  ## Overview
  This migration adds package_type and bottles_per_unit columns to the sales_data table
  to support flexible packaging (6-pack, 12-pack, single bottle, barrel).

  ## Changes
  1. Add package_type column with constraint for valid values
  2. Add bottles_per_unit column for conversion factor
  3. Migrate existing data based on case_size values
  4. Add performance index on package_type
  5. Update products table with package type fields
  6. Update fob_pricing_matrix to support package-specific pricing

  ## Data Migration
  - Records with case_size=6 → package_type='case_6', bottles_per_unit=6
  - Records with case_size=12 → package_type='case_12', bottles_per_unit=12
  - Records with case_size IS NULL and quantity_unit='bottles' → package_type='single', bottles_per_unit=1
  - All other records → package_type='case_6', bottles_per_unit=6 (default)
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

-- Migrate existing sales_data package types based on case_size
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

-- Add package_type to fob_pricing_matrix if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fob_pricing_matrix') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'fob_pricing_matrix' AND column_name = 'package_type'
    ) THEN
      ALTER TABLE fob_pricing_matrix ADD COLUMN package_type text DEFAULT 'case_6'
        CHECK (package_type IN ('case_6', 'case_12', 'single', 'barrel'));
      COMMENT ON COLUMN fob_pricing_matrix.package_type IS 'Package type for this FOB price';
    END IF;

    -- Drop old unique constraint if it exists
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'fob_pricing_matrix_organization_id_product_id_distributor_id_key'
    ) THEN
      ALTER TABLE fob_pricing_matrix
      DROP CONSTRAINT fob_pricing_matrix_organization_id_product_id_distributor_id_key;
    END IF;

    -- Add new unique constraint including package_type
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'fob_pricing_matrix_org_product_dist_package_key'
    ) THEN
      ALTER TABLE fob_pricing_matrix
      ADD CONSTRAINT fob_pricing_matrix_org_product_dist_package_key
      UNIQUE(organization_id, product_id, distributor_id, package_type);
    END IF;

    -- Create index for performance
    CREATE INDEX IF NOT EXISTS idx_fob_pricing_package_lookup
      ON fob_pricing_matrix(organization_id, product_id, distributor_id, package_type);

    -- Drop old lookup index if it exists (without package_type)
    DROP INDEX IF EXISTS idx_fob_pricing_lookup;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_data_package_type ON sales_data(package_type);
