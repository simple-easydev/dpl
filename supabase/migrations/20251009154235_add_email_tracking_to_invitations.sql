/*
  # Add Email Tracking to Invitations

  ## Overview
  Adds email delivery tracking fields to the invitations table to monitor when
  invitation emails are sent through Supabase Auth.

  ## Changes
  
  ### Columns Added to `invitations` table
  - `email_sent` (boolean) - Whether the invitation email was successfully sent
  - `email_sent_at` (timestamptz) - Timestamp when email was sent
  - `supabase_user_id` (uuid) - Link to the invited user's auth.users record (if created)
  
  ## Indexes
  - Index on `email_sent` for filtering sent/unsent invitations
  - Index on `supabase_user_id` for quick user lookups
  
  ## Notes
  - `email_sent` defaults to false for backward compatibility
  - `supabase_user_id` is nullable since not all invites create users immediately
  - These fields help track invitation email delivery status
*/

-- Add email tracking fields to invitations table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invitations' AND column_name = 'email_sent'
  ) THEN
    ALTER TABLE invitations ADD COLUMN email_sent boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invitations' AND column_name = 'email_sent_at'
  ) THEN
    ALTER TABLE invitations ADD COLUMN email_sent_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invitations' AND column_name = 'supabase_user_id'
  ) THEN
    ALTER TABLE invitations ADD COLUMN supabase_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_invitations_email_sent ON invitations(email_sent);
CREATE INDEX IF NOT EXISTS idx_invitations_supabase_user_id ON invitations(supabase_user_id);