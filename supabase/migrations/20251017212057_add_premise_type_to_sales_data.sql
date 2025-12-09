/*
  # Add Premise Type Support to Sales Data

  1. Changes
    - Add `premise_type` column to `sales_data` table
    - Create index on `premise_type` for efficient filtering
    - Create composite index for brand-account-premise type queries

  2. Purpose
    This migration adds premise type classification to sales_data records to support
    filtering depletions by on-premise vs off-premise sales. This enables brand performance
    analysis segmented by customer type.

  3. Notes
    - Column is nullable to support gradual rollout
    - Values should be: 'on_premise', 'off_premise', 'unclassified', or NULL
    - Will be populated via JOIN with accounts table in queries
    - Index supports efficient filtering and aggregation queries
*/

-- Add premise_type column to sales_data table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_data' AND column_name = 'premise_type'
  ) THEN
    ALTER TABLE sales_data ADD COLUMN premise_type text DEFAULT NULL;
    ALTER TABLE sales_data ADD CONSTRAINT sales_data_premise_type_check 
      CHECK (premise_type IN ('on_premise', 'off_premise', 'unclassified', NULL));
  END IF;
END $$;

-- Create indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_sales_data_premise_type 
  ON sales_data(organization_id, premise_type) 
  WHERE premise_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_data_brand_account_premise 
  ON sales_data(organization_id, brand, account_name, premise_type, order_date) 
  WHERE brand IS NOT NULL AND order_date IS NOT NULL;
