/*
  # Fix Subscription Creation Trigger
  
  ## Overview
  Improves the subscription creation trigger to ensure reliable subscription record creation
  during organization signup with proper error handling and logging.
  
  ## Changes
  1. Enhanced trigger function with error handling
  2. Adds logging for successful and failed subscription creation
  3. Ensures subscription is created even if trial_ends_at is null
  4. Makes the trigger more resilient to edge cases
  
  ## Security
  - Function runs with SECURITY DEFINER to bypass RLS during creation
  - Only triggers automatically on organization insert (no direct user access)
*/

-- Drop existing trigger and function to recreate with improvements
DROP TRIGGER IF EXISTS trigger_create_subscription ON organizations;
DROP FUNCTION IF EXISTS create_subscription_for_organization();

-- Create improved function to automatically create subscription for new organizations
CREATE OR REPLACE FUNCTION create_subscription_for_organization()
RETURNS TRIGGER AS $$
DECLARE
  v_trial_end timestamptz;
BEGIN
  -- Ensure trial_ends_at has a value, default to 14 days from now if null
  v_trial_end := COALESCE(NEW.trial_ends_at, now() + interval '14 days');
  
  -- Create subscription record
  INSERT INTO subscriptions (
    organization_id, 
    status, 
    current_period_start, 
    current_period_end
  )
  VALUES (
    NEW.id,
    'trialing',
    now(),
    v_trial_end
  );
  
  -- Log successful creation
  RAISE NOTICE 'Created subscription for organization %', NEW.id;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the organization creation
    RAISE WARNING 'Failed to create subscription for organization %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-create subscription
CREATE TRIGGER trigger_create_subscription
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION create_subscription_for_organization();

-- Add comment
COMMENT ON FUNCTION create_subscription_for_organization IS 
  'Automatically creates a trialing subscription when a new organization is created. Includes error handling to prevent organization creation failures.';
