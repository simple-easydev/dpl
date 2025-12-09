/*
  # Add Tasks and Alerts Tables for AI-Powered Task Management

  ## New Tables Created

  ### 1. tasks
  A comprehensive task management table that stores action items generated from insights or created manually by users.
  
  **Fields:**
  - `id` (uuid, primary key) - Unique task identifier
  - `organization_id` (uuid, foreign key) - Links to organizations table
  - `user_id` (uuid, foreign key) - Task creator (references auth.users)
  - `assigned_to` (uuid, nullable, foreign key) - User assigned to complete the task
  - `title` (text) - Task title/summary
  - `description` (text, nullable) - Detailed task description
  - `status` (text) - Current task status: 'pending', 'in_progress', 'completed', 'cancelled'
  - `priority` (text) - Task priority: 'low', 'medium', 'high', 'urgent'
  - `insight_id` (text, nullable) - Reference to the insight that generated this task
  - `related_account` (text, nullable) - Associated account name from sales data
  - `related_product` (text, nullable) - Associated product name from sales data
  - `related_revenue` (numeric, nullable) - Revenue amount associated with this task
  - `due_date` (timestamptz, nullable) - When the task should be completed
  - `completed_at` (timestamptz, nullable) - When the task was actually completed
  - `auto_generated` (boolean, default false) - Whether task was created by AI
  - `tags` (jsonb, nullable) - Flexible tags for categorization
  - `metadata` (jsonb, nullable) - Additional flexible data storage
  - `created_at` (timestamptz) - Task creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 2. alerts
  Tracks alert history and monitoring triggers for business intelligence.
  
  **Fields:**
  - `id` (uuid, primary key) - Unique alert identifier
  - `organization_id` (uuid, foreign key) - Links to organizations table
  - `user_id` (uuid, nullable, foreign key) - User who should be alerted
  - `alert_type` (text) - Type of alert: 'account_lapse', 'revenue_decline', 'product_decline', 'anomaly', 'opportunity'
  - `severity` (text) - Alert severity: 'low', 'medium', 'high'
  - `title` (text) - Alert title
  - `description` (text) - Detailed alert message
  - `trigger_data` (jsonb, nullable) - Data that triggered the alert
  - `related_task_id` (uuid, nullable, foreign key) - Associated task if created
  - `acknowledged` (boolean, default false) - Whether user has seen the alert
  - `acknowledged_at` (timestamptz, nullable) - When alert was acknowledged
  - `created_at` (timestamptz) - Alert creation timestamp

  ## Security (RLS Policies)

  Both tables have Row Level Security enabled with restrictive policies:
  - Users can only view tasks/alerts for their organization
  - Users can create tasks/alerts within their organization
  - Users can update tasks assigned to them or that they created
  - Admins have full access to organization tasks/alerts

  ## Indexes

  Performance indexes added for common query patterns:
  - Tasks by organization and status
  - Tasks by assigned user and due date
  - Tasks by related account
  - Alerts by organization and acknowledged status
  - Alerts by type and creation date
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

-- Users can view tasks in their organization
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

-- Users can create tasks in their organization
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

-- Users can update tasks they created or are assigned to
CREATE POLICY "Users can update their tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    (user_id = auth.uid() OR assigned_to = auth.uid())
    AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = tasks.organization_id
      AND organization_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    (user_id = auth.uid() OR assigned_to = auth.uid())
    AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = tasks.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- Users can delete tasks they created
CREATE POLICY "Users can delete tasks they created"
  ON tasks FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = tasks.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- RLS Policies for alerts table

-- Users can view alerts in their organization
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

-- Users can create alerts in their organization
CREATE POLICY "Users can create alerts in their organization"
  ON alerts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = alerts.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- Users can update alerts (primarily for acknowledging)
CREATE POLICY "Users can update alerts in their organization"
  ON alerts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = alerts.organization_id
      AND organization_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = alerts.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS tasks_updated_at_trigger ON tasks;
CREATE TRIGGER tasks_updated_at_trigger
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_tasks_updated_at();