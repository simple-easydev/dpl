/*
  # Add State Field to Sales Data and Accounts

  1. Changes
    - Add `account_state` field to `sales_data` table to track geographic location of sales
    - Add `state` field to `accounts` table for account location tracking
    - Create indexes on state fields for efficient filtering
    - Add index on order_date for efficient date-based aggregation

  2. Notes
    - State values should use full state names (e.g., "California", "New York")
    - Existing records will have NULL state values until populated
    - Supports filtering and aggregation by geographic region
*/

-- Add state field to sales_data table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_data' AND column_name = 'account_state'
  ) THEN
    ALTER TABLE sales_data ADD COLUMN account_state text DEFAULT NULL;
  END IF;
END $$;

-- Add state field to accounts table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'state'
  ) THEN
    ALTER TABLE accounts ADD COLUMN state text DEFAULT NULL;
  END IF;
END $$;

-- Create indexes for efficient filtering and aggregation
CREATE INDEX IF NOT EXISTS idx_sales_data_account_state ON sales_data(organization_id, account_state) WHERE account_state IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_data_order_date_brand ON sales_data(organization_id, order_date, brand) WHERE order_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounts_state ON accounts(organization_id, state) WHERE state IS NOT NULL;