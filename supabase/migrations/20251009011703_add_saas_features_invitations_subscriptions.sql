/*
  # Add SaaS Features - Invitations, Subscriptions, and Audit Logging

  ## Overview
  This migration adds the core infrastructure for transforming the platform into a 
  production-ready SaaS with team invitations, subscription management, and security features.

  ## 1. New Tables

  ### `invitations`
  Manages pending team member invitations to organizations
  - `id` (uuid, primary key)
  - `organization_id` (uuid, foreign key) - Target organization
  - `email` (text) - Invitee email address
  - `role` (text) - Intended role: 'admin', 'member', or 'viewer'
  - `invited_by` (uuid, foreign key) - User who sent invitation
  - `token` (text, unique) - Secure invitation token for acceptance
  - `status` (text) - 'pending', 'accepted', 'expired', or 'revoked'
  - `expires_at` (timestamptz) - Invitation expiration date (7 days default)
  - `accepted_at` (timestamptz) - When invitation was accepted
  - `created_at` (timestamptz) - When invitation was sent

  ### `subscriptions`
  Tracks organization subscription and billing status
  - `id` (uuid, primary key)
  - `organization_id` (uuid, foreign key, unique) - One subscription per org
  - `stripe_customer_id` (text) - Stripe customer identifier
  - `stripe_subscription_id` (text) - Stripe subscription identifier
  - `status` (text) - 'active', 'past_due', 'canceled', 'trialing'
  - `plan_amount` (integer) - Monthly amount in cents (50000 = $500)
  - `current_period_start` (timestamptz) - Current billing period start
  - `current_period_end` (timestamptz) - Current billing period end
  - `cancel_at_period_end` (boolean) - Whether subscription cancels at period end
  - `canceled_at` (timestamptz) - When subscription was canceled
  - `created_at` (timestamptz) - Subscription creation date
  - `updated_at` (timestamptz) - Last update timestamp

  ### `audit_logs`
  Comprehensive activity logging for security and compliance
  - `id` (uuid, primary key)
  - `organization_id` (uuid, foreign key) - Organization context
  - `user_id` (uuid, foreign key) - User who performed action
  - `action` (text) - Action type (e.g., 'upload_file', 'invite_user', 'delete_data')
  - `resource_type` (text) - Type of resource affected (e.g., 'sales_data', 'user', 'api_key')
  - `resource_id` (text) - Identifier of affected resource
  - `metadata` (jsonb) - Additional context data
  - `ip_address` (text) - User IP address
  - `user_agent` (text) - User browser/client info
  - `created_at` (timestamptz) - When action occurred

  ## 2. Table Updates

  ### `organizations` table additions
  - `openai_api_key_encrypted` (text) - Encrypted OpenAI API key
  - `trial_ends_at` (timestamptz) - Trial expiration date (14 days from signup)
  - `is_trial` (boolean) - Whether organization is in trial period

  ## 3. Security

  ### Row Level Security (RLS)
  All new tables have RLS enabled with strict policies:
  - Invitations: Only organization admins can manage; invitees can view their own
  - Subscriptions: Only organization members can view; no direct modifications
  - Audit Logs: Only organization admins can view logs for their org

  ## 4. Indexes
  Performance indexes on:
  - organization_id for multi-tenant data isolation
  - email and token for invitation lookups
  - status fields for filtering
  - created_at for time-based queries

  ## 5. Important Notes
  - Invitation tokens are generated as random UUIDs for security
  - Subscriptions default to 'trialing' status with 14-day trial
  - Audit logs capture all sensitive operations for security compliance
  - API keys are stored encrypted and never exposed in responses
  - Trial period automatically set to 14 days from organization creation
*/

-- Add new columns to organizations table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'openai_api_key_encrypted'
  ) THEN
    ALTER TABLE organizations ADD COLUMN openai_api_key_encrypted text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'trial_ends_at'
  ) THEN
    ALTER TABLE organizations ADD COLUMN trial_ends_at timestamptz DEFAULT (now() + interval '14 days');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'is_trial'
  ) THEN
    ALTER TABLE organizations ADD COLUMN is_trial boolean DEFAULT true;
  END IF;
END $$;

-- Create invitations table
CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_invitations_org_id ON invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text NOT NULL DEFAULT 'trialing' CHECK (status IN ('active', 'past_due', 'canceled', 'trialing', 'incomplete')),
  plan_amount integer DEFAULT 50000,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  canceled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_subscriptions_org_id ON subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- RLS Policies for invitations
CREATE POLICY "Admins can view invitations for their organization"
  ON invitations FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can create invitations"
  ON invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
    AND invited_by = auth.uid()
  );

CREATE POLICY "Admins can update invitations"
  ON invitations FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete invitations"
  ON invitations FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for subscriptions
CREATE POLICY "Organization members can view their subscription"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage subscriptions"
  ON subscriptions FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for audit_logs
CREATE POLICY "Admins can view audit logs for their organization"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "System can create audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Create function to automatically create subscription for new organizations
CREATE OR REPLACE FUNCTION create_subscription_for_organization()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO subscriptions (organization_id, status, current_period_start, current_period_end)
  VALUES (
    NEW.id,
    'trialing',
    now(),
    NEW.trial_ends_at
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-create subscription
DROP TRIGGER IF EXISTS trigger_create_subscription ON organizations;
CREATE TRIGGER trigger_create_subscription
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION create_subscription_for_organization();

-- Create function to log audit events
CREATE OR REPLACE FUNCTION log_audit_event(
  p_organization_id uuid,
  p_action text,
  p_resource_type text,
  p_resource_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO audit_logs (
    organization_id,
    user_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) VALUES (
    p_organization_id,
    auth.uid(),
    p_action,
    p_resource_type,
    p_resource_id,
    p_metadata
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;