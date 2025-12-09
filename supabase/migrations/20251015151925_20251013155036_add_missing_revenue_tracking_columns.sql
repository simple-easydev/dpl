/*
  # Add Missing Revenue Tracking Columns to sales_data

  ## Overview
  This migration adds columns that are used in the codebase but were never formally
  added to the database schema through migrations.

  ## Table Modifications
  - Add `has_revenue_data` (boolean) - Flag indicating if this record includes revenue information
  - Add `default_period` (text) - Temporary period assignment for records missing dates
  - Add `distributor` (text) - Distributor name field
*/

-- Add has_revenue_data column to sales_data table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_data' AND column_name = 'has_revenue_data'
  ) THEN
    ALTER TABLE sales_data ADD COLUMN has_revenue_data boolean DEFAULT true;
  END IF;
END $$;

-- Add default_period column to sales_data table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_data' AND column_name = 'default_period'
  ) THEN
    ALTER TABLE sales_data ADD COLUMN default_period text;
  END IF;
END $$;

-- Add distributor column to sales_data table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_data' AND column_name = 'distributor'
  ) THEN
    ALTER TABLE sales_data ADD COLUMN distributor text;
  END IF;
END $$;

-- Update existing records: set has_revenue_data based on whether revenue exists
UPDATE sales_data 
SET has_revenue_data = (revenue IS NOT NULL)
WHERE has_revenue_data IS NULL;

-- Create index for filtering by revenue data availability
CREATE INDEX IF NOT EXISTS idx_sales_data_has_revenue 
ON sales_data(organization_id, has_revenue_data) 
WHERE has_revenue_data = true;

-- Create index for records with default_period (temporary missing dates)
CREATE INDEX IF NOT EXISTS idx_sales_data_default_period 
ON sales_data(organization_id, default_period) 
WHERE default_period IS NOT NULL;

-- Create index for distributor field for faster lookups
CREATE INDEX IF NOT EXISTS idx_sales_data_distributor ON sales_data(distributor) WHERE distributor IS NOT NULL;

-- Add comment to document these columns
COMMENT ON COLUMN sales_data.has_revenue_data IS 'Indicates whether this record includes revenue data. Manual entries always true. Some upload sources may not include revenue.';
COMMENT ON COLUMN sales_data.default_period IS 'Temporary period assignment for records missing dates during upload processing. Should be replaced with actual dates.';