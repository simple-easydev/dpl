/*
  # Add Tasks and Alerts Tables for AI-Powered Task Management

  ## New Tables Created

  ### 1. tasks
  A comprehensive task management table that stores action items generated from insights or created manually by users.

  ### 2. alerts
  Tracks alert history and monitoring triggers for business intelligence.

  ## Security (RLS Policies)

  Both tables have Row Level Security enabled with restrictive policies.
*/

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  insight_id text,
  related_account text,
  related_product text,
  related_revenue numeric(12, 2),
  due_date timestamptz,
  completed_at timestamptz,
  auto_generated boolean DEFAULT false,
  tags jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  alert_type text NOT NULL CHECK (alert_type IN ('account_lapse', 'revenue_decline', 'product_decline', 'anomaly', 'opportunity', 'forecast_variance')),
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  title text NOT NULL,
  description text NOT NULL,
  trigger_data jsonb,
  related_task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  acknowledged boolean DEFAULT false,
  acknowledged_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_organization_status ON tasks(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to_due_date ON tasks(assigned_to, due_date) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_related_account ON tasks(organization_id, related_account) WHERE related_account IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_auto_generated ON tasks(organization_id, auto_generated) WHERE auto_generated = true;

CREATE INDEX IF NOT EXISTS idx_alerts_organization_acknowledged ON alerts(organization_id, acknowledged);
CREATE INDEX IF NOT EXISTS idx_alerts_type_created ON alerts(organization_id, alert_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(organization_id, severity) WHERE acknowledged = false;

-- Enable Row Level Security
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tasks table
CREATE POLICY "Users can view tasks in their organization"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = tasks.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create tasks in their organization"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = tasks.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    (user_id = auth.uid() OR assigned_to = auth.uid())
    OR EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = tasks.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete tasks"
  ON tasks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = tasks.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role = 'admin'
    )
  );

-- RLS Policies for alerts table
CREATE POLICY "Users can view alerts in their organization"
  ON alerts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = alerts.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "System can create alerts"
  ON alerts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = alerts.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update alerts"
  ON alerts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = alerts.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );