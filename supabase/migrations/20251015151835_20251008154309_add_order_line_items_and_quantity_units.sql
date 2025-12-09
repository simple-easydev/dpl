/*
  # Add Order Line Items and Quantity Unit Support

  ## Overview
  This migration adds support for multi-product orders with quantity unit tracking (cases vs bottles)
  and automatic case-to-bottle conversion. This enables accurate inventory tracking and supports
  different case sizes (6 or 12 bottles per case).

  ## 1. Table Modifications

  ### `sales_data` - Add Quantity Unit Fields
  - `quantity_unit` (text) - Unit of measurement: 'cases' or 'bottles'
  - `case_size` (integer) - Bottles per case (6 or 12), null if unit is bottles
  - `quantity_in_bottles` (numeric) - Normalized quantity in bottles for reporting

  ### `products` - Add Default Case Size
  - `default_case_size` (integer) - Default bottles per case for this product (6 or 12)

  ## 2. Security
  No RLS policy changes needed - existing policies cover new columns.

  ## 3. Indexes
  Performance indexes on:
  - quantity_unit for filtering by unit type
  - order_id for grouping line items from same order

  ## 4. Data Migration
  - Existing records default to 'bottles' unit type
  - quantity_in_bottles populated from existing quantity field
  - Products default to 6-bottle cases

  ## 5. Important Notes
  - All new fields support backward compatibility with existing data
  - Case size is only relevant when quantity_unit is 'cases'
  - quantity_in_bottles provides standardized reporting unit
  - Distributor field remains text-based for data flexibility
*/

-- Add quantity unit fields to sales_data table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_data' AND column_name = 'quantity_unit'
  ) THEN
    ALTER TABLE sales_data ADD COLUMN quantity_unit text DEFAULT 'bottles' CHECK (quantity_unit IN ('cases', 'bottles'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_data' AND column_name = 'case_size'
  ) THEN
    ALTER TABLE sales_data ADD COLUMN case_size integer CHECK (case_size IN (6, 12));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_data' AND column_name = 'quantity_in_bottles'
  ) THEN
    ALTER TABLE sales_data ADD COLUMN quantity_in_bottles numeric;
  END IF;
END $$;

-- Add default_case_size to products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'default_case_size'
  ) THEN
    ALTER TABLE products ADD COLUMN default_case_size integer DEFAULT 6 CHECK (default_case_size IN (6, 12));
  END IF;
END $$;

-- Migrate existing data: set quantity_in_bottles equal to quantity for existing records
UPDATE sales_data 
SET quantity_in_bottles = quantity 
WHERE quantity_in_bottles IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_data_quantity_unit ON sales_data(quantity_unit);
CREATE INDEX IF NOT EXISTS idx_sales_data_order_id ON sales_data(order_id) WHERE order_id IS NOT NULL;