/*
  # Add Manual Brand Tracking Flag to Products
  
  ## Overview
  Adds a flag to track whether a brand was manually assigned to a product,
  preventing automatic aggregation from overwriting manual assignments.
  
  ## Changes
  
  ### 1. New Column
  
  #### products table:
  - `manual_brand` (boolean, default false) - Indicates if brand was manually set by user
  
  ### 2. Index
  - Index on `products.manual_brand` for efficient queries
  
  ### 3. Notes
  - Manual brand assignments will be preserved during data aggregation
  - Automatic brand detection only updates when manual_brand is false
  - Users can override automatic brand detection at any time
*/

-- Add manual_brand column to products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'manual_brand'
  ) THEN
    ALTER TABLE products ADD COLUMN manual_brand boolean DEFAULT false NOT NULL;
    COMMENT ON COLUMN products.manual_brand IS 'True if brand was manually assigned by user, prevents auto-aggregation from overwriting';
  END IF;
END $$;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_products_manual_brand ON products(manual_brand) WHERE manual_brand = true;