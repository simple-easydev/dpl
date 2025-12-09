/*
  # Add Representative and Date of Sale Fields

  ## Overview
  This migration adds representative and date_of_sale fields to support tracking
  sales representatives and the actual sale date across both structured sales data
  and extracted document data.

  ## 1. Table Modifications

  ### `sales_data`
  - Add `representative` (text) - Sales representative or account manager name
  - Add `date_of_sale` (date) - Actual date of sale (may differ from order_date)

  ### `extracted_data`
  - Add `representative` (text) - Extracted sales representative information

  ## 2. Security
  No RLS policy changes needed - existing policies cover new columns.

  ## 3. Indexes
  Performance indexes on frequently queried columns:
  - Index on representative for filtering and grouping
  - Index on date_of_sale for time-based queries

  ## 4. Important Notes
  - All new fields are optional (nullable) to support existing data
  - date_of_sale defaults to order_date if not separately specified
  - representative can be populated from uploaded data or entered manually
*/

-- Add representative and date_of_sale columns to sales_data table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_data' AND column_name = 'representative'
  ) THEN
    ALTER TABLE sales_data ADD COLUMN representative text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_data' AND column_name = 'date_of_sale'
  ) THEN
    ALTER TABLE sales_data ADD COLUMN date_of_sale date;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_data_representative ON sales_data(representative);
CREATE INDEX IF NOT EXISTS idx_sales_data_date_of_sale ON sales_data(date_of_sale DESC);
CREATE INDEX IF NOT EXISTS idx_sales_data_org_date_of_sale ON sales_data(organization_id, date_of_sale DESC);

-- Add representative column to extracted_data table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'extracted_data' AND column_name = 'representative'
  ) THEN
    ALTER TABLE extracted_data ADD COLUMN representative text DEFAULT '';
  END IF;
END $$;

-- Create index for extracted_data representative
CREATE INDEX IF NOT EXISTS idx_extracted_data_representative ON extracted_data(representative);