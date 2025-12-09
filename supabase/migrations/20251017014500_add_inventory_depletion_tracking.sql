/*
  # Add Inventory Depletion Tracking to Sales Data

  1. Changes
    - Add `inventory_processed` boolean field to track if order has been processed for inventory depletion
    - Add `inventory_processed_at` timestamp to track when inventory depletion was processed
    - Add `inventory_transaction_id` to link to the inventory transaction record
    - Add index for efficient querying of unprocessed orders

  2. Notes
    - Existing records will default to NULL for inventory_processed (unknown state)
    - New records will explicitly track their inventory processing state
    - This enables backfilling historical orders and preventing double-processing
*/

-- Add inventory depletion tracking fields to sales_data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_data' AND column_name = 'inventory_processed'
  ) THEN
    ALTER TABLE sales_data ADD COLUMN inventory_processed boolean DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_data' AND column_name = 'inventory_processed_at'
  ) THEN
    ALTER TABLE sales_data ADD COLUMN inventory_processed_at timestamptz DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_data' AND column_name = 'inventory_transaction_id'
  ) THEN
    ALTER TABLE sales_data ADD COLUMN inventory_transaction_id uuid REFERENCES inventory_transactions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for efficient querying of unprocessed orders
CREATE INDEX IF NOT EXISTS idx_sales_data_inventory_processed ON sales_data(organization_id, inventory_processed) WHERE inventory_processed IS NULL OR inventory_processed = false;

-- Create index for linking to inventory transactions
CREATE INDEX IF NOT EXISTS idx_sales_data_inventory_transaction ON sales_data(inventory_transaction_id);
