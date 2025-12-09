/*
  # Add Missing Revenue Tracking Columns to sales_data

  ## Overview
  This migration adds columns that are used in the codebase but were never formally
  added to the database schema through migrations. These columns support tracking
  whether revenue data is available and handling missing date information.

  ## 1. Table Modifications

  ### `sales_data`
  - Add `has_revenue_data` (boolean) - Flag indicating if this record includes revenue information
  - Add `default_period` (text) - Temporary period assignment for records missing dates

  ## 2. Data Migration Strategy
  
  For existing records:
  - Set `has_revenue_data = true` for all records with non-null revenue
  - Set `has_revenue_data = false` for any records with null revenue (if any exist)
  - Leave `default_period` as NULL for existing records (only used during upload processing)

  ## 3. Security
  No RLS policy changes needed - existing policies cover new columns.

  ## 4. Indexes
  Performance indexes on:
  - `has_revenue_data` for filtering depletion vs non-revenue records
  - Composite index on organization_id and has_revenue_data for analytics queries

  ## 5. Important Notes
  
  - These columns are already referenced in dataProcessor.ts and other code
  - `has_revenue_data` helps distinguish between "revenue is $0" and "no revenue data available"
  - `default_period` is used temporarily during upload processing for records missing dates
  - After this migration, all manual entries should set `has_revenue_data = true`
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

-- Add comment to document these columns
COMMENT ON COLUMN sales_data.has_revenue_data IS 'Indicates whether this record includes revenue data. Manual entries always true. Some upload sources may not include revenue.';
COMMENT ON COLUMN sales_data.default_period IS 'Temporary period assignment for records missing dates during upload processing. Should be replaced with actual dates.';