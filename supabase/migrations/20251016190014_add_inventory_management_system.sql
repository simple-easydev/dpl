/*
  # Inventory Management System

  1. New Tables
    - `inventory_importer`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key to organizations)
      - `product_id` (uuid, foreign key to products)
      - `quantity` (numeric) - Current quantity available at importer level
      - `updated_by` (uuid, foreign key to auth.users) - Last user who updated
      - `notes` (text) - Optional notes about the inventory update
      - `created_at` (timestamptz) - When record was created
      - `updated_at` (timestamptz) - When record was last updated

    - `inventory_distributor`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key to organizations)
      - `product_id` (uuid, foreign key to products)
      - `distributor_id` (uuid, foreign key to distributors)
      - `initial_quantity` (numeric) - Starting inventory quantity
      - `current_quantity` (numeric) - Current quantity after depletions
      - `last_updated` (timestamptz) - When inventory was last modified
      - `created_at` (timestamptz) - When record was created
      - `created_by` (uuid, foreign key to auth.users) - User who initialized

    - `inventory_transactions`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key to organizations)
      - `product_id` (uuid, foreign key to products)
      - `distributor_id` (uuid, foreign key to distributors, nullable)
      - `transaction_type` (text) - Type: 'importer_adjustment', 'distributor_initial', 'distributor_adjustment', 'auto_depletion'
      - `quantity_change` (numeric) - Amount changed (positive or negative)
      - `previous_quantity` (numeric) - Quantity before change
      - `new_quantity` (numeric) - Quantity after change
      - `reference_id` (uuid, nullable) - Reference to sales_data id if auto_depletion
      - `notes` (text) - Optional notes about transaction
      - `created_by` (uuid, foreign key to auth.users) - User who made change
      - `created_at` (timestamptz) - When transaction occurred

  2. Security
    - Enable RLS on all tables
    - Add policies for organization members to access their inventory data
    - Add policies for admins to modify inventory data

  3. Indexes
    - Add indexes for efficient querying by organization, product, and distributor
*/

-- Create inventory_importer table
CREATE TABLE IF NOT EXISTS inventory_importer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 0,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, product_id)
);

-- Create inventory_distributor table
CREATE TABLE IF NOT EXISTS inventory_distributor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  distributor_id uuid NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  initial_quantity numeric NOT NULL DEFAULT 0,
  current_quantity numeric NOT NULL DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(organization_id, product_id, distributor_id)
);

-- Create inventory_transactions table
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  distributor_id uuid REFERENCES distributors(id) ON DELETE SET NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('importer_adjustment', 'distributor_initial', 'distributor_adjustment', 'auto_depletion')),
  quantity_change numeric NOT NULL,
  previous_quantity numeric NOT NULL,
  new_quantity numeric NOT NULL,
  reference_id uuid,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_inventory_importer_organization ON inventory_importer(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_importer_product ON inventory_importer(product_id);

CREATE INDEX IF NOT EXISTS idx_inventory_distributor_organization ON inventory_distributor(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_distributor_product ON inventory_distributor(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_distributor_distributor ON inventory_distributor(distributor_id);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_organization ON inventory_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_product ON inventory_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_distributor ON inventory_transactions(distributor_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created_at ON inventory_transactions(created_at DESC);

-- Enable Row Level Security
ALTER TABLE inventory_importer ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_distributor ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for inventory_importer
CREATE POLICY "Users can view importer inventory for their organization"
  ON inventory_importer FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = inventory_importer.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert importer inventory for their organization"
  ON inventory_importer FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = inventory_importer.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update importer inventory for their organization"
  ON inventory_importer FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = inventory_importer.organization_id
      AND organization_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = inventory_importer.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete importer inventory for their organization"
  ON inventory_importer FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = inventory_importer.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- RLS Policies for inventory_distributor
CREATE POLICY "Users can view distributor inventory for their organization"
  ON inventory_distributor FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = inventory_distributor.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert distributor inventory for their organization"
  ON inventory_distributor FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = inventory_distributor.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update distributor inventory for their organization"
  ON inventory_distributor FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = inventory_distributor.organization_id
      AND organization_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = inventory_distributor.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete distributor inventory for their organization"
  ON inventory_distributor FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = inventory_distributor.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

-- RLS Policies for inventory_transactions
CREATE POLICY "Users can view inventory transactions for their organization"
  ON inventory_transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = inventory_transactions.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert inventory transactions for their organization"
  ON inventory_transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = inventory_transactions.organization_id
      AND organization_members.user_id = auth.uid()
    )
  );