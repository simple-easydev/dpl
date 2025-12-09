/*
  # Add needs_product_review status to uploads table

  ## Overview
  Adds the 'needs_product_review' status option to the uploads table to support
  the duplicate product detection workflow.

  ## Changes Made
  
  ### Uploads Table Constraint
  - Drop existing status check constraint
  - Add updated constraint including 'needs_product_review' status
  - All existing records remain valid (no data changes needed)

  ## Status Values
  After this migration, uploads can have these statuses:
  - `processing`: Upload is being processed
  - `completed`: Upload completed successfully
  - `failed`: Upload failed with errors
  - `needs_review`: Upload needs manual review (e.g., missing dates)
  - `needs_product_review`: Upload has potential duplicate products needing review

  ## Notes
  - This is a non-breaking change
  - Existing uploads are unaffected
  - Required for the product deduplication feature
*/

-- Drop existing status constraint
DO $$
BEGIN
  ALTER TABLE uploads DROP CONSTRAINT IF EXISTS uploads_status_check;
END $$;

-- Add updated constraint with 'needs_product_review' option
ALTER TABLE uploads ADD CONSTRAINT uploads_status_check 
CHECK (status IN ('processing', 'completed', 'failed', 'needs_review', 'needs_product_review'));