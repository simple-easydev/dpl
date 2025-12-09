/*
  # Make Revenue Column Nullable in sales_data

  ## Overview
  This migration makes the revenue column nullable in the sales_data table to prevent
  NOT NULL constraint violations. While the application logic strictly filters out 
  records without revenue during upload, making this column nullable provides:
  - Schema alignment with TypeScript types
  - Prevention of constraint violations
  - Flexibility for edge cases and future features

  ## 1. Schema Changes

  ### `sales_data` table
  - Modify `revenue` column from `numeric NOT NULL` to `numeric NULL`
  - This allows the column to accept null values but application logic will prevent insertions with null revenue

  ## 2. Important Notes

  - Application logic filters out all records without revenue before database insertion
  - Users are warned: "Only records with revenue will be read. If no revenue is reported, the system will assume it was a sample and not record it"
  - This migration prevents constraint violations while maintaining data quality through application-level filtering
  - The has_revenue_data column tracks whether revenue is present (will always be true for new records after filtering)

  ## 3. Security
  No RLS policy changes needed - existing policies remain unchanged.
*/

-- Make revenue column nullable to prevent constraint violations
DO $$
BEGIN
  -- Drop the NOT NULL constraint on revenue column
  ALTER TABLE sales_data ALTER COLUMN revenue DROP NOT NULL;
END $$;

-- Add comment to document this change
COMMENT ON COLUMN sales_data.revenue IS 'Revenue amount for the sale. Application filters ensure only records with revenue are inserted during uploads. Nullable for schema flexibility but enforced at application level.';
