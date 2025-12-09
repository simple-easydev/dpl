/*
  # Fix AI Training Configuration Read Access
  
  1. Problem
    - Current RLS policies restrict SELECT to platform admins only
    - Brands need to READ configurations when uploading files for their distributors
    - Without read access, the FileUpload component cannot fetch AI training configs
  
  2. Solution
    - Allow ALL authenticated users to read AI training configurations
    - Keep write operations (INSERT, UPDATE, DELETE) restricted to platform admins only
    - This matches the intended workflow: Platform admin creates, brands use
  
  3. Security
    - Read-only access for brands is safe - configs contain no sensitive data
    - Only parsing instructions and field mapping hints
    - Write operations remain platform admin only
*/

-- Drop the restrictive SELECT policy
DROP POLICY IF EXISTS "Platform admin can view all ai_training_configurations" ON ai_training_configurations;

-- Allow all authenticated users to read AI training configurations
CREATE POLICY "All authenticated users can read ai_training_configurations"
  ON ai_training_configurations FOR SELECT
  TO authenticated
  USING (true);

-- Keep write policies restricted to platform admins (already exist, just confirming)
-- Platform admin can create ai_training_configurations
-- Platform admin can update ai_training_configurations  
-- Platform admin can delete ai_training_configurations
