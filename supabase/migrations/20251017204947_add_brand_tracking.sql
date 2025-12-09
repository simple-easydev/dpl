/*
  # Add Brand Tracking to Products and Sales Data

  ## Overview
  This migration adds brand tracking capabilities to enable users with multiple brand portfolios
  to organize and filter their products by brand name.

  ## Changes

  ### 1. New Columns
  
  #### sales_data table:
  - `brand` (text, nullable) - Brand/company name for the product in this sale
  
  #### products table:
  - `brand` (text, nullable) - Primary brand associated with this product
  
  ### 2. Indexes
  - Index on `sales_data.brand` for efficient filtering
  - Index on `products.brand` for optimized queries
  
  ### 3. Notes
  - Brand is nullable to support existing data and products without brand information
  - Brand information will be populated during file uploads and can be edited manually
  - Product aggregation will select the most frequently occurring brand for each product
  - Users can filter and search by brand on the products page
*/

-- Add brand column to sales_data table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_data' AND column_name = 'brand'
  ) THEN
    ALTER TABLE sales_data ADD COLUMN brand text;
    COMMENT ON COLUMN sales_data.brand IS 'Brand or company name for this product';
  END IF;
END $$;

-- Add brand column to products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'brand'
  ) THEN
    ALTER TABLE products ADD COLUMN brand text;
    COMMENT ON COLUMN products.brand IS 'Primary brand associated with this product';
  END IF;
END $$;

-- Create index on sales_data.brand for efficient filtering
CREATE INDEX IF NOT EXISTS idx_sales_data_brand ON sales_data(brand) WHERE brand IS NOT NULL;

-- Create index on products.brand for efficient filtering and sorting
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand) WHERE brand IS NOT NULL;