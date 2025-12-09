/*
  # Remove Duplicate Records and Add Prevention Indexes

  1. Purpose
    - Remove existing duplicate sales data records
    - Add indexes to prevent future duplicates
    - Improve data integrity and query performance

  2. Changes
    - Identify and remove duplicate records (keeping the oldest record per duplicate group)
    - Add partial unique index on (organization_id, order_id) for records where order_id is not null
    - Add composite indexes to improve duplicate detection and query performance

  3. Important Notes
    - This migration removes duplicate records permanently
    - We keep the first occurrence (oldest created_at) of each duplicate
    - The unique index will prevent duplicates from being inserted in the future
*/

-- Step 1: Remove duplicate records where order_id exists
-- Keep only the oldest record (earliest created_at) for each unique (organization_id, order_id) pair
DELETE FROM sales_data
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY organization_id, order_id 
        ORDER BY created_at ASC
      ) as rn
    FROM sales_data
    WHERE order_id IS NOT NULL
  ) t
  WHERE rn > 1
);

-- Step 2: Remove duplicate records where order_id is null
-- Keep only the oldest record for each unique combination of critical fields
DELETE FROM sales_data
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY 
          organization_id, 
          order_date, 
          account_name, 
          product_name, 
          quantity,
          COALESCE(quantity_in_bottles, 0)
        ORDER BY created_at ASC
      ) as rn
    FROM sales_data
    WHERE order_id IS NULL
  ) t
  WHERE rn > 1
);

-- Step 3: Add partial unique index for records with order_id
-- This prevents the same order_id from appearing multiple times within an organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_data_unique_order_id
ON sales_data(organization_id, order_id)
WHERE order_id IS NOT NULL;

-- Step 4: Add composite index to help detect duplicates without order_id
-- This index improves performance when scanning for potential duplicates
CREATE INDEX IF NOT EXISTS idx_sales_data_duplicate_detection
ON sales_data(organization_id, order_date, account_name, product_name, quantity)
WHERE order_id IS NULL;

-- Step 5: Add index on quantity_in_bottles for better query performance
CREATE INDEX IF NOT EXISTS idx_sales_data_quantity_in_bottles
ON sales_data(organization_id, quantity_in_bottles)
WHERE quantity_in_bottles IS NOT NULL;
