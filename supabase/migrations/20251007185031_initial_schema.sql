/*
  # Sales Data Platform - Initial Schema

  ## Overview
  This migration creates the complete database schema for a multi-tenant sales analytics platform
  with AI-powered file processing. The schema supports multiple organizations with team members,
  file uploads, and comprehensive sales data tracking.

  ## 1. New Tables

  ### `organizations`
  Represents brands/companies using the platform
  - `id` (uuid, primary key)
  - `name` (text) - Company/brand name
  - `created_at` (timestamptz) - Account creation date
  - `settings` (jsonb) - Organization preferences (timezone, currency, etc.)

  ### `organization_members`
  Manages multi-user access to organizations with role-based permissions
  - `id` (uuid, primary key)
  - `organization_id` (uuid, foreign key) - Links to organizations
  - `user_id` (uuid, foreign key) - Links to auth.users
  - `role` (text) - User role: 'admin', 'member', or 'viewer'
  - `invited_by` (uuid) - User who sent the invitation
  - `joined_at` (timestamptz) - When user accepted invitation

  ### `uploads`
  Tracks all file uploads with processing status
  - `id` (uuid, primary key)
  - `organization_id` (uuid, foreign key)
  - `user_id` (uuid, foreign key) - User who uploaded
  - `filename` (text) - Original filename
  - `file_size` (integer) - Size in bytes
  - `status` (text) - 'processing', 'completed', 'failed'
  - `row_count` (integer) - Number of rows processed
  - `column_mapping` (jsonb) - AI-detected column mappings
  - `error_message` (text) - Error details if failed
  - `created_at` (timestamptz)
  - `processed_at` (timestamptz)

  ### `sales_data`
  Stores all parsed sales records from uploads
  - `id` (uuid, primary key)
  - `organization_id` (uuid, foreign key)
  - `upload_id` (uuid, foreign key)
  - `order_id` (text) - Order/transaction identifier
  - `order_date` (date) - Date of sale
  - `account_name` (text) - Customer/account name
  - `product_name` (text) - Product/SKU name
  - `quantity` (numeric) - Units sold
  - `revenue` (numeric) - Sale amount
  - `unit_price` (numeric) - Price per unit
  - `category` (text) - Product category if available
  - `region` (text) - Geographic region if available
  - `raw_data` (jsonb) - Original row data for reference
  - `created_at` (timestamptz)

  ### `accounts`
  Aggregated customer account data across all uploads
  - `id` (uuid, primary key)
  - `organization_id` (uuid, foreign key)
  - `account_name` (text) - Normalized customer name
  - `total_revenue` (numeric) - Lifetime value
  - `total_orders` (integer) - Total number of orders
  - `first_order_date` (date) - First purchase date
  - `last_order_date` (date) - Most recent purchase
  - `average_order_value` (numeric) - AOV
  - `updated_at` (timestamptz)

  ### `products`
  Aggregated product performance data
  - `id` (uuid, primary key)
  - `organization_id` (uuid, foreign key)
  - `product_name` (text) - Normalized product name
  - `total_revenue` (numeric) - Total sales
  - `total_units` (numeric) - Total units sold
  - `total_orders` (integer) - Number of orders
  - `average_price` (numeric) - Average unit price
  - `first_sale_date` (date)
  - `last_sale_date` (date)
  - `updated_at` (timestamptz)

  ### `analytics_snapshots`
  Cached computed metrics for faster dashboard loading
  - `id` (uuid, primary key)
  - `organization_id` (uuid, foreign key)
  - `period_type` (text) - 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'
  - `period_start` (date)
  - `period_end` (date)
  - `metrics` (jsonb) - Computed metrics (revenue, orders, accounts, etc.)
  - `created_at` (timestamptz)

  ## 2. Security

  ### Row Level Security (RLS)
  All tables have RLS enabled with policies ensuring users can only access data 
  from organizations they belong to.

  ### Policies
  - Organizations: Users can view organizations they are members of
  - Organization Members: Users can view members of their organizations; admins can manage
  - Uploads: Users can view uploads from their organizations; members can create
  - Sales Data: Users can view sales data from their organizations
  - Accounts: Users can view accounts from their organizations
  - Products: Users can view products from their organizations
  - Analytics Snapshots: Users can view snapshots from their organizations

  ## 3. Indexes

  Performance indexes on frequently queried columns:
  - organization_id on all tables for data isolation
  - user_id for user-specific queries
  - order_date for time-range queries
  - account_name and product_name for search and aggregation
  - Composite indexes for common query patterns

  ## 4. Important Notes

  - All monetary values use numeric type for precision
  - Timestamps use timestamptz for timezone awareness
  - Default values ensure data consistency
  - Foreign key constraints maintain referential integrity
  - Unique constraints prevent duplicate records
*/

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  settings jsonb DEFAULT '{
    "timezone": "UTC",
    "currency": "USD",
    "date_format": "YYYY-MM-DD"
  }'::jsonb
);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Create organization_members table
CREATE TABLE IF NOT EXISTS organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
  invited_by uuid REFERENCES auth.users(id),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON organization_members(user_id);

-- Create uploads table
CREATE TABLE IF NOT EXISTS uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  filename text NOT NULL,
  file_size integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  row_count integer DEFAULT 0,
  column_mapping jsonb,
  error_message text,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_uploads_org_id ON uploads(organization_id);
CREATE INDEX IF NOT EXISTS idx_uploads_user_id ON uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_uploads_status ON uploads(status);
CREATE INDEX IF NOT EXISTS idx_uploads_created_at ON uploads(created_at DESC);

-- Create sales_data table
CREATE TABLE IF NOT EXISTS sales_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  upload_id uuid NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
  order_id text,
  order_date date NOT NULL,
  account_name text NOT NULL,
  product_name text NOT NULL,
  quantity numeric DEFAULT 1,
  revenue numeric NOT NULL,
  unit_price numeric,
  category text,
  region text,
  raw_data jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sales_data ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sales_data_org_id ON sales_data(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_data_upload_id ON sales_data(upload_id);
CREATE INDEX IF NOT EXISTS idx_sales_data_order_date ON sales_data(order_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_data_account_name ON sales_data(account_name);
CREATE INDEX IF NOT EXISTS idx_sales_data_product_name ON sales_data(product_name);
CREATE INDEX IF NOT EXISTS idx_sales_data_org_date ON sales_data(organization_id, order_date DESC);

-- Create accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_name text NOT NULL,
  total_revenue numeric DEFAULT 0,
  total_orders integer DEFAULT 0,
  first_order_date date,
  last_order_date date,
  average_order_value numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, account_name)
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_accounts_org_id ON accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_accounts_total_revenue ON accounts(total_revenue DESC);
CREATE INDEX IF NOT EXISTS idx_accounts_name ON accounts(account_name);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  total_revenue numeric DEFAULT 0,
  total_units numeric DEFAULT 0,
  total_orders integer DEFAULT 0,
  average_price numeric DEFAULT 0,
  first_sale_date date,
  last_sale_date date,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, product_name)
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_products_org_id ON products(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_total_revenue ON products(total_revenue DESC);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(product_name);

-- Create analytics_snapshots table
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_type text NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, period_type, period_start)
);

ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_snapshots_org_id ON analytics_snapshots(organization_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_period ON analytics_snapshots(period_type, period_start DESC);

-- RLS Policies for organizations
CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert organizations"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update their organizations"
  ON organizations FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for organization_members
CREATE POLICY "Users can view members of their organizations"
  ON organization_members FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert themselves as members"
  ON organization_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can insert members"
  ON organization_members FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update members"
  ON organization_members FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete members"
  ON organization_members FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for uploads
CREATE POLICY "Users can view uploads from their organizations"
  ON uploads FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Members can create uploads"
  ON uploads FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can update their own uploads"
  ON uploads FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for sales_data
CREATE POLICY "Users can view sales data from their organizations"
  ON sales_data FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Members can insert sales data"
  ON sales_data FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('admin', 'member')
    )
  );

CREATE POLICY "Admins can update sales data"
  ON sales_data FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete sales data"
  ON sales_data FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for accounts
CREATE POLICY "Users can view accounts from their organizations"
  ON accounts FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage accounts"
  ON accounts FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for products
CREATE POLICY "Users can view products from their organizations"
  ON products FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage products"
  ON products FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for analytics_snapshots
CREATE POLICY "Users can view snapshots from their organizations"
  ON analytics_snapshots FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage snapshots"
  ON analytics_snapshots FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );