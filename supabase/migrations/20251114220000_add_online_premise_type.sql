/*
  # Add Online Premise Type for E-commerce Sales

  1. Changes
    - Modify premise_type check constraint to include 'online' as a valid value
    - Update existing constraint to support on_premise, off_premise, unclassified, and online

  2. Purpose
    This migration adds support for classifying accounts as "online" to properly
    categorize e-commerce, direct-to-consumer web sales, and other online sales channels.
    This is essential for brands that sell through multiple channels including traditional
    retail (on/off-premise) and online platforms.

  3. Notes
    - Existing accounts retain their current premise_type values
    - The new 'online' type can be set manually or auto-detected by AI
    - All existing functionality remains backward compatible
*/

-- Drop the existing premise_type check constraint
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS premise_type_check;

-- Add the new constraint with 'online' included
ALTER TABLE accounts ADD CONSTRAINT premise_type_check
  CHECK (premise_type IN ('on_premise', 'off_premise', 'unclassified', 'online'));
