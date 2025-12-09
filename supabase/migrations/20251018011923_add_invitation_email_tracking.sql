/*
  # Add Email Tracking to Invitations Table

  1. Changes
    - Add `email_sent` column to track if invitation email was successfully sent
    - Add `email_sent_at` column to track when the email was sent
    - Add `supabase_user_id` column to link invitation to created auth.users record
  
  2. Indexes
    - Add index on `supabase_user_id` for efficient lookups
  
  3. Data Migration
    - Update existing pending invitations to mark emails as sent
*/

ALTER TABLE invitations 
ADD COLUMN IF NOT EXISTS email_sent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS email_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS supabase_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add index for querying by supabase_user_id
CREATE INDEX IF NOT EXISTS idx_invitations_supabase_user_id ON invitations(supabase_user_id);

-- Update existing invitations to mark as email sent if they're pending
UPDATE invitations 
SET email_sent = true, 
    email_sent_at = created_at 
WHERE status = 'pending' 
  AND email_sent IS NULL;