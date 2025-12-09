/*
  # Make order_date Nullable in sales_data Table

  ## Overview
  This migration makes the order_date field nullable to support data quality workflows
  where files may not contain date information.

  ## Table Modifications
  - Modify `order_date` column to allow NULL values
  - Add `needs_review` status option for uploads requiring manual date entry
*/

-- Make order_date nullable in sales_data table
ALTER TABLE sales_data 
ALTER COLUMN order_date DROP NOT NULL;

-- Add index for NULL date queries to support data quality checks
CREATE INDEX IF NOT EXISTS idx_sales_data_null_order_date 
ON sales_data(organization_id) 
WHERE order_date IS NULL;

-- Update uploads status constraint to include 'needs_review'
DO $$
BEGIN
  -- Drop existing constraint
  ALTER TABLE uploads DROP CONSTRAINT IF EXISTS uploads_status_check;
  
  -- Add new constraint with 'needs_review' option
  ALTER TABLE uploads ADD CONSTRAINT uploads_status_check 
  CHECK (status IN ('processing', 'completed', 'failed', 'needs_review'));
END $$;