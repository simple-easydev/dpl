export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          created_at: string
          settings: Json
          openai_api_key_encrypted: string | null
          trial_ends_at: string | null
          is_trial: boolean
          logo_url: string | null
          logo_file_path: string | null
          created_by_platform_admin: boolean
          platform_admin_notes: string | null
          deleted_at: string | null
          deleted_by: string | null
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          settings?: Json
          openai_api_key_encrypted?: string | null
          trial_ends_at?: string | null
          is_trial?: boolean
          logo_url?: string | null
          logo_file_path?: string | null
          created_by_platform_admin?: boolean
          platform_admin_notes?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          settings?: Json
          openai_api_key_encrypted?: string | null
          trial_ends_at?: string | null
          is_trial?: boolean
          logo_url?: string | null
          logo_file_path?: string | null
          created_by_platform_admin?: boolean
          platform_admin_notes?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
        }
      }
      organization_members: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          role: 'admin' | 'member' | 'viewer'
          invited_by: string | null
          joined_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          role?: 'admin' | 'member' | 'viewer'
          invited_by?: string | null
          joined_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          role?: 'admin' | 'member' | 'viewer'
          invited_by?: string | null
          joined_at?: string
        }
      }
      uploads: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          filename: string
          file_size: number
          status: 'processing' | 'completed' | 'failed' | 'needs_review' | 'needs_product_review'
          row_count: number | null
          column_mapping: Json | null
          error_message: string | null
          distributor_id: string | null
          created_at: string
          processed_at: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          filename: string
          file_size: number
          status?: 'processing' | 'completed' | 'failed' | 'needs_review' | 'needs_product_review'
          row_count?: number | null
          column_mapping?: Json | null
          error_message?: string | null
          distributor_id?: string | null
          created_at?: string
          processed_at?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          filename?: string
          file_size?: number
          status?: 'processing' | 'completed' | 'failed' | 'needs_review' | 'needs_product_review'
          row_count?: number | null
          column_mapping?: Json | null
          error_message?: string | null
          distributor_id?: string | null
          created_at?: string
          processed_at?: string | null
        }
      }
      sales_data: {
        Row: {
          id: string
          organization_id: string
          upload_id: string | null
          order_id: string | null
          order_date: string | null
          account_name: string
          product_name: string
          quantity: number | null
          revenue: number | null
          unit_price: number | null
          category: string | null
          region: string | null
          distributor: string | null
          representative: string | null
          date_of_sale: string | null
          has_revenue_data: boolean | null
          default_period: string | null
          quantity_unit: string | null
          case_size: number | null
          quantity_in_bottles: number | null
          package_type: string | null
          bottles_per_unit: number | null
          brand: string | null
          raw_data: Json | null
          inventory_processed: boolean | null
          inventory_processed_at: string | null
          inventory_transaction_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          upload_id?: string | null
          order_id?: string | null
          order_date?: string | null
          account_name: string
          product_name: string
          quantity?: number | null
          revenue?: number | null
          unit_price?: number | null
          category?: string | null
          region?: string | null
          distributor?: string | null
          representative?: string | null
          date_of_sale?: string | null
          has_revenue_data?: boolean | null
          default_period?: string | null
          quantity_unit?: string | null
          case_size?: number | null
          quantity_in_bottles?: number | null
          package_type?: string | null
          bottles_per_unit?: number | null
          brand?: string | null
          raw_data?: Json | null
          inventory_processed?: boolean | null
          inventory_processed_at?: string | null
          inventory_transaction_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          upload_id?: string | null
          order_id?: string | null
          order_date?: string | null
          account_name?: string
          product_name?: string
          quantity?: number | null
          revenue?: number | null
          unit_price?: number | null
          category?: string | null
          region?: string | null
          distributor?: string | null
          representative?: string | null
          date_of_sale?: string | null
          has_revenue_data?: boolean | null
          default_period?: string | null
          quantity_unit?: string | null
          case_size?: number | null
          quantity_in_bottles?: number | null
          package_type?: string | null
          bottles_per_unit?: number | null
          brand?: string | null
          raw_data?: Json | null
          inventory_processed?: boolean | null
          inventory_processed_at?: string | null
          inventory_transaction_id?: string | null
          created_at?: string
        }
      }
      accounts: {
        Row: {
          id: string
          organization_id: string
          account_name: string
          total_revenue: number
          total_orders: number
          first_order_date: string | null
          last_order_date: string | null
          average_order_value: number
          updated_at: string
          premise_type: 'on_premise' | 'off_premise' | 'unclassified' | 'online'
          premise_type_confidence: number
          premise_type_updated_at: string | null
          premise_type_manual_override: boolean
          manager_name: string | null
          buyer_name: string | null
          notes: string | null
          last_contact_date: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          account_name: string
          total_revenue?: number
          total_orders?: number
          first_order_date?: string | null
          last_order_date?: string | null
          average_order_value?: number
          updated_at?: string
          premise_type?: 'on_premise' | 'off_premise' | 'unclassified' | 'online'
          premise_type_confidence?: number
          premise_type_updated_at?: string | null
          premise_type_manual_override?: boolean
          manager_name?: string | null
          buyer_name?: string | null
          notes?: string | null
          last_contact_date?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          account_name?: string
          total_revenue?: number
          total_orders?: number
          first_order_date?: string | null
          last_order_date?: string | null
          average_order_value?: number
          updated_at?: string
          premise_type?: 'on_premise' | 'off_premise' | 'unclassified' | 'online'
          premise_type_confidence?: number
          premise_type_updated_at?: string | null
          premise_type_manual_override?: boolean
          manager_name?: string | null
          buyer_name?: string | null
          notes?: string | null
          last_contact_date?: string | null
        }
      }
      products: {
        Row: {
          id: string
          organization_id: string
          product_name: string
          total_revenue: number
          total_units: number
          total_orders: number
          average_price: number
          first_sale_date: string | null
          last_sale_date: string | null
          updated_at: string
          default_fob_price: number | null
          default_case_size: number | null
          available_package_types: Json | null
          default_package_type: string | null
          brand: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          product_name: string
          total_revenue?: number
          total_units?: number
          total_orders?: number
          average_price?: number
          first_sale_date?: string | null
          last_sale_date?: string | null
          updated_at?: string
          default_fob_price?: number | null
          default_case_size?: number | null
          available_package_types?: Json | null
          default_package_type?: string | null
          brand?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          product_name?: string
          total_revenue?: number
          total_units?: number
          total_orders?: number
          average_price?: number
          first_sale_date?: string | null
          last_sale_date?: string | null
          updated_at?: string
          default_fob_price?: number | null
          default_case_size?: number | null
          available_package_types?: Json | null
          default_package_type?: string | null
          brand?: string | null
        }
      }
      ai_training_configurations: {
        Row: {
          id: string
          organization_id: string | null
          distributor_id: string
          configuration_name: string
          field_mappings: Json
          parsing_instructions: string
          orientation: string
          is_active: boolean
          tested_successfully: boolean
          created_at: string
          updated_at: string
          created_by: string
          success_count: number
          failure_count: number
          last_successful_use: string | null
        }
        Insert: {
          id?: string
          organization_id?: string | null
          distributor_id: string
          configuration_name: string
          field_mappings?: Json
          parsing_instructions?: string
          orientation?: string
          is_active?: boolean
          tested_successfully?: boolean
          created_at?: string
          updated_at?: string
          created_by: string
          success_count?: number
          failure_count?: number
          last_successful_use?: string | null
        }
        Update: {
          id?: string
          organization_id?: string | null
          distributor_id?: string
          configuration_name?: string
          field_mappings?: Json
          parsing_instructions?: string
          orientation?: string
          is_active?: boolean
          tested_successfully?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string
          success_count?: number
          failure_count?: number
          last_successful_use?: string | null
        }
      }
      distributors: {
        Row: {
          id: string
          organization_id: string | null
          name: string
          state: string | null
          supports_pdf: boolean
          contact_email: string | null
          contact_phone: string | null
          active: boolean
          is_global: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id?: string | null
          name: string
          state?: string | null
          supports_pdf?: boolean
          contact_email?: string | null
          contact_phone?: string | null
          active?: boolean
          is_global?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          name?: string
          state?: string | null
          supports_pdf?: boolean
          contact_email?: string | null
          contact_phone?: string | null
          active?: boolean
          is_global?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      organization_distributors: {
        Row: {
          id: string
          organization_id: string
          distributor_id: string
          state: string | null
          added_by: string | null
          is_favorited: boolean
          last_used_at: string | null
          usage_count: number
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          distributor_id: string
          state?: string | null
          added_by?: string | null
          is_favorited?: boolean
          last_used_at?: string | null
          usage_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          distributor_id?: string
          state?: string | null
          added_by?: string | null
          is_favorited?: boolean
          last_used_at?: string | null
          usage_count?: number
          created_at?: string
        }
      }
      analytics_snapshots: {
        Row: {
          id: string
          organization_id: string
          period_type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
          period_start: string
          period_end: string
          metrics: Json
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          period_type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
          period_start: string
          period_end: string
          metrics?: Json
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          period_type?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
          period_start?: string
          period_end?: string
          metrics?: Json
          created_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          assigned_to: string | null
          title: string
          description: string | null
          status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
          priority: 'low' | 'medium' | 'high' | 'urgent'
          insight_id: string | null
          related_account: string | null
          related_product: string | null
          related_revenue: number | null
          due_date: string | null
          completed_at: string | null
          auto_generated: boolean
          tags: Json
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          assigned_to?: string | null
          title: string
          description?: string | null
          status?: 'pending' | 'in_progress' | 'completed' | 'cancelled'
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          insight_id?: string | null
          related_account?: string | null
          related_product?: string | null
          related_revenue?: number | null
          due_date?: string | null
          completed_at?: string | null
          auto_generated?: boolean
          tags?: Json
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          assigned_to?: string | null
          title?: string
          description?: string | null
          status?: 'pending' | 'in_progress' | 'completed' | 'cancelled'
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          insight_id?: string | null
          related_account?: string | null
          related_product?: string | null
          related_revenue?: number | null
          due_date?: string | null
          completed_at?: string | null
          auto_generated?: boolean
          tags?: Json
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      alerts: {
        Row: {
          id: string
          organization_id: string
          user_id: string | null
          alert_type: 'account_lapse' | 'revenue_decline' | 'product_decline' | 'anomaly' | 'opportunity' | 'forecast_variance'
          severity: 'low' | 'medium' | 'high'
          title: string
          description: string
          trigger_data: Json | null
          related_task_id: string | null
          acknowledged: boolean
          acknowledged_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id?: string | null
          alert_type: 'account_lapse' | 'revenue_decline' | 'product_decline' | 'anomaly' | 'opportunity' | 'forecast_variance'
          severity: 'low' | 'medium' | 'high'
          title: string
          description: string
          trigger_data?: Json | null
          related_task_id?: string | null
          acknowledged?: boolean
          acknowledged_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string | null
          alert_type?: 'account_lapse' | 'revenue_decline' | 'product_decline' | 'anomaly' | 'opportunity' | 'forecast_variance'
          severity?: 'low' | 'medium' | 'high'
          title?: string
          description?: string
          trigger_data?: Json | null
          related_task_id?: string | null
          acknowledged?: boolean
          acknowledged_at?: string | null
          created_at?: string
        }
      }
      invitations: {
        Row: {
          id: string
          organization_id: string
          email: string
          role: 'admin' | 'member' | 'viewer'
          invited_by: string
          token: string
          status: 'pending' | 'accepted' | 'expired' | 'revoked'
          expires_at: string | null
          accepted_at: string | null
          created_at: string
          email_sent: boolean
          email_sent_at: string | null
          supabase_user_id: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          email: string
          role?: 'admin' | 'member' | 'viewer'
          invited_by: string
          token?: string
          status?: 'pending' | 'accepted' | 'expired' | 'revoked'
          expires_at?: string | null
          accepted_at?: string | null
          created_at?: string
          email_sent?: boolean
          email_sent_at?: string | null
          supabase_user_id?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          email?: string
          role?: 'admin' | 'member' | 'viewer'
          invited_by?: string
          token?: string
          status?: 'pending' | 'accepted' | 'expired' | 'revoked'
          expires_at?: string | null
          accepted_at?: string | null
          created_at?: string
          email_sent?: boolean
          email_sent_at?: string | null
          supabase_user_id?: string | null
        }
      }
      subscriptions: {
        Row: {
          id: string
          organization_id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          status: 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete'
          plan_amount: number
          current_period_start: string | null
          current_period_end: string | null
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          status?: 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete'
          plan_amount?: number
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          status?: 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete'
          plan_amount?: number
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          organization_id: string
          user_id: string | null
          action: string
          resource_type: string
          resource_id: string | null
          metadata: Json
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id?: string | null
          action: string
          resource_type: string
          resource_id?: string | null
          metadata?: Json
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string | null
          action?: string
          resource_type?: string
          resource_id?: string | null
          metadata?: Json
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
      }
      fob_pricing_matrix: {
        Row: {
          id: string
          organization_id: string
          product_id: string
          distributor_id: string
          fob_price_override: number
          package_type: string
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          product_id: string
          distributor_id: string
          fob_price_override: number
          package_type?: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          product_id?: string
          distributor_id?: string
          fob_price_override?: number
          package_type?: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
      }
      inventory_importer: {
        Row: {
          id: string
          organization_id: string
          product_id: string
          quantity: number
          updated_by: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          product_id: string
          quantity?: number
          updated_by?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          product_id?: string
          quantity?: number
          updated_by?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      inventory_distributor: {
        Row: {
          id: string
          organization_id: string
          product_id: string
          distributor_id: string
          initial_quantity: number
          current_quantity: number
          last_updated: string
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          product_id: string
          distributor_id: string
          initial_quantity?: number
          current_quantity?: number
          last_updated?: string
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          product_id?: string
          distributor_id?: string
          initial_quantity?: number
          current_quantity?: number
          last_updated?: string
          created_at?: string
          created_by?: string | null
        }
      }
      inventory_transactions: {
        Row: {
          id: string
          organization_id: string
          product_id: string
          distributor_id: string | null
          transaction_type: 'importer_adjustment' | 'distributor_initial' | 'distributor_adjustment' | 'auto_depletion'
          quantity_change: number
          previous_quantity: number
          new_quantity: number
          reference_id: string | null
          notes: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          product_id: string
          distributor_id?: string | null
          transaction_type: 'importer_adjustment' | 'distributor_initial' | 'distributor_adjustment' | 'auto_depletion'
          quantity_change: number
          previous_quantity: number
          new_quantity: number
          reference_id?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          product_id?: string
          distributor_id?: string | null
          transaction_type?: 'importer_adjustment' | 'distributor_initial' | 'distributor_adjustment' | 'auto_depletion'
          quantity_change?: number
          previous_quantity?: number
          new_quantity?: number
          reference_id?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
      }
      platform_admin_config: {
        Row: {
          id: string
          platform_admin_user_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          platform_admin_user_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          platform_admin_user_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      brand_invitations: {
        Row: {
          id: string
          email: string
          company_name: string
          token: string
          status: 'pending' | 'accepted' | 'expired' | 'revoked'
          invited_by: string
          organization_id: string | null
          welcome_message: string | null
          expires_at: string
          accepted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          company_name: string
          token?: string
          status?: 'pending' | 'accepted' | 'expired' | 'revoked'
          invited_by: string
          organization_id?: string | null
          welcome_message?: string | null
          expires_at?: string
          accepted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          company_name?: string
          token?: string
          status?: 'pending' | 'accepted' | 'expired' | 'revoked'
          invited_by?: string
          organization_id?: string | null
          welcome_message?: string | null
          expires_at?: string
          accepted_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      account_categorizations: {
        Row: {
          id: string
          organization_id: string
          account_name: string
          category: 'large_active' | 'small_active' | 'large_loss' | 'small_loss' | 'one_time' | 'inactive'
          confidence_score: number | null
          reasoning: string | null
          categorized_at: string
          baseline_avg: number
          recent_avg: number
          trend_percent: number
          total_orders: number
          last_order_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          account_name: string
          category: 'large_active' | 'small_active' | 'large_loss' | 'small_loss' | 'one_time' | 'inactive'
          confidence_score?: number | null
          reasoning?: string | null
          categorized_at?: string
          baseline_avg?: number
          recent_avg?: number
          trend_percent?: number
          total_orders?: number
          last_order_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          account_name?: string
          category?: 'large_active' | 'small_active' | 'large_loss' | 'small_loss' | 'one_time' | 'inactive'
          confidence_score?: number | null
          reasoning?: string | null
          categorized_at?: string
          baseline_avg?: number
          recent_avg?: number
          trend_percent?: number
          total_orders?: number
          last_order_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_organization_with_owner: {
        Args: {
          org_name: string
        }
        Returns: Array<{
          id: string
          name: string
          role: string
        }>
      }
      is_organization_member: {
        Args: {
          org_id: string
          check_user_id: string
        }
        Returns: boolean
      }
      is_organization_admin: {
        Args: {
          org_id: string
          check_user_id: string
        }
        Returns: boolean
      }
      log_audit_event: {
        Args: {
          p_organization_id: string
          p_action: string
          p_resource_type: string
          p_resource_id?: string
          p_metadata?: Json
        }
        Returns: string
      }
      is_platform_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      get_platform_admin_user_id: {
        Args: Record<string, never>
        Returns: string | null
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
