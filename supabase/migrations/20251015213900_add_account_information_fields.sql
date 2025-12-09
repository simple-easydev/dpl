/*
  # Add Account Information Fields

  1. Changes
    - Add `manager_name` (text, nullable) - Name of the account manager
    - Add `buyer_name` (text, nullable) - Name of the buyer/decision maker
    - Add `notes` (text, nullable) - General notes about the account
    - Add `last_contact_date` (date, nullable) - Last time contact was made with the account
  
  2. Purpose
    This migration adds custom fields to the accounts table to allow users to track
    important relationship information such as key contacts, notes, and interaction history.
  
  3. Notes
    - All fields are nullable to allow gradual data entry
    - No RLS changes needed as existing policies already cover these columns
    - Fields can be updated by organization members with appropriate permissions
*/

-- Add custom account information fields
ALTER TABLE accounts 
  ADD COLUMN IF NOT EXISTS manager_name text,
  ADD COLUMN IF NOT EXISTS buyer_name text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS last_contact_date date;
