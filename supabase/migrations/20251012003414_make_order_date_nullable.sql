/*
  # Make order_date Nullable in sales_data Table

  ## Overview
  This migration makes the order_date field nullable to support data quality workflows
  where files may not contain date information. When dates are missing, uploads are
  flagged for review and users must manually enter dates before data becomes available
  in analytics.

  ## 1. Table Modifications

  ### `sales_data`
  - Modify `order_date` column to allow NULL values
  - Keep all existing indexes and constraints
  - Existing NOT NULL data remains unchanged

  ### `uploads`
  - Add `needs_review` status option for uploads requiring manual date entry
  - Existing uploads remain unaffected

  ## 2. Data Quality Strategy
  
  When order_date is NULL:
  - Records are excluded from analytics and reporting
  - Uploads are marked as 'needs_review' status
  - Users are prompted to manually enter dates
  - Clear warnings indicate data quality issues

  ## 3. Security
  No RLS policy changes needed - existing policies cover the modified column.

  ## 4. Important Notes
  
  - This change supports the data quality workflow
  - NULL dates are temporary - users must fill them in
  - Analytics queries will filter out NULL dates
  - No existing data is affected (all current records have dates)
  - Backward compatible with existing code
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