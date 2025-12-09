/*
  # Make upload_id Nullable for Manual Entry Support

  ## Overview
  This migration modifies the sales_data table to support manual order entry
  by making the upload_id field nullable. This allows sales records to be created
  without an associated file upload.

  ## 1. Table Modifications

  ### `sales_data`
  - Modify `upload_id` to be nullable instead of NOT NULL
  - This allows manual entry of sales orders without requiring a file upload

  ## 2. Security
  No RLS policy changes needed - existing policies continue to work correctly.
  Manual entries will still be restricted by organization membership.

  ## 3. Important Notes
  - Existing data is preserved - all current records have upload_id values
  - Manual entries can have NULL upload_id values
  - Queries should handle NULL upload_id appropriately
  - Consider adding a filter or indicator for manual vs. uploaded entries
*/

-- Make upload_id nullable in sales_data table
ALTER TABLE sales_data 
  ALTER COLUMN upload_id DROP NOT NULL;

-- Add a comment to document this change
COMMENT ON COLUMN sales_data.upload_id IS 'Foreign key to uploads table. NULL indicates a manually entered order.';