/*
  # Backfill Account State Data from Distributors

  1. Purpose
    - Populate account_state field in sales_data table for existing records
    - Populate state field in accounts table based on distributor information
    - Enable state-based filtering in the application

  2. Changes
    - Update sales_data.account_state by matching distributor names to distributors.state
    - Handle organization-specific distributor state overrides from organization_distributors
    - Update accounts.state based on their associated sales data
    - Maintain data integrity with proper null handling

  3. Data Safety
    - Only updates null values, preserves existing data
    - Uses LEFT JOINs to handle all records safely
    - COALESCE prioritizes organization-specific states over global states

  4. Expected Impact
    - ~749 sales_data records will get account_state populated
    - Multiple accounts will get state field populated
    - State filter dropdown will immediately show available states
*/

-- Step 1: Update sales_data.account_state from distributors
-- This matches the distributor name in sales_data to the distributors table
-- and pulls the state, prioritizing organization-specific overrides

UPDATE sales_data sd
SET account_state = dist_state.state
FROM (
  SELECT 
    d.name as distributor_name,
    sd_inner.organization_id,
    COALESCE(od.state, d.state) as state
  FROM sales_data sd_inner
  JOIN distributors d ON sd_inner.distributor = d.name
  LEFT JOIN organization_distributors od ON 
    od.distributor_id = d.id 
    AND od.organization_id = sd_inner.organization_id
  WHERE sd_inner.account_state IS NULL
    AND d.state IS NOT NULL
  GROUP BY d.name, sd_inner.organization_id, COALESCE(od.state, d.state)
) dist_state
WHERE sd.distributor = dist_state.distributor_name
  AND sd.organization_id = dist_state.organization_id
  AND sd.account_state IS NULL;

-- Step 2: Update accounts.state based on the most common state from their sales data
-- This aggregates sales data per account and assigns the most frequent state

WITH account_states AS (
  SELECT 
    account_name,
    organization_id,
    account_state,
    COUNT(*) as state_count,
    ROW_NUMBER() OVER (
      PARTITION BY account_name, organization_id 
      ORDER BY COUNT(*) DESC
    ) as rn
  FROM sales_data
  WHERE account_state IS NOT NULL
  GROUP BY account_name, organization_id, account_state
)
UPDATE accounts a
SET state = ast.account_state
FROM account_states ast
WHERE a.account_name = ast.account_name
  AND a.organization_id = ast.organization_id
  AND ast.rn = 1
  AND a.state IS NULL;

-- Step 3: Create an index on account_state for better query performance
CREATE INDEX IF NOT EXISTS idx_sales_data_account_state 
ON sales_data(account_state) 
WHERE account_state IS NOT NULL;

-- Step 4: Create an index on accounts.state for better query performance
CREATE INDEX IF NOT EXISTS idx_accounts_state 
ON accounts(state) 
WHERE state IS NOT NULL;
