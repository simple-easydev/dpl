export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      account_categorizations: {
        Row: {
          account_name: string
          baseline_avg: number | null
          categorized_at: string
          category: string
          confidence_score: number | null
          created_at: string | null
          id: string
          last_order_date: string | null
          organization_id: string
          reasoning: string | null
          recent_avg: number | null
          total_orders: number | null
          trend_percent: number | null
          updated_at: string | null
        }
        Insert: {
          account_name: string
          baseline_avg?: number | null
          categorized_at?: string
          category: string
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          last_order_date?: string | null
          organization_id: string
          reasoning?: string | null
          recent_avg?: number | null
          total_orders?: number | null
          trend_percent?: number | null
          updated_at?: string | null
        }
        Update: {
          account_name?: string
          baseline_avg?: number | null
          categorized_at?: string
          category?: string
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          last_order_date?: string | null
          organization_id?: string
          reasoning?: string | null
          recent_avg?: number | null
          total_orders?: number | null
          trend_percent?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_categorizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          account_name: string
          average_order_value: number | null
          buyer_name: string | null
          first_order_date: string | null
          id: string
          last_contact_date: string | null
          last_order_date: string | null
          manager_name: string | null
          notes: string | null
          organization_id: string
          premise_type: string | null
          premise_type_confidence: number | null
          premise_type_manual_override: boolean | null
          premise_type_updated_at: string | null
          state: string | null
          total_orders: number | null
          total_revenue: number | null
          updated_at: string | null
        }
        Insert: {
          account_name: string
          average_order_value?: number | null
          buyer_name?: string | null
          first_order_date?: string | null
          id?: string
          last_contact_date?: string | null
          last_order_date?: string | null
          manager_name?: string | null
          notes?: string | null
          organization_id: string
          premise_type?: string | null
          premise_type_confidence?: number | null
          premise_type_manual_override?: boolean | null
          premise_type_updated_at?: string | null
          state?: string | null
          total_orders?: number | null
          total_revenue?: number | null
          updated_at?: string | null
        }
        Update: {
          account_name?: string
          average_order_value?: number | null
          buyer_name?: string | null
          first_order_date?: string | null
          id?: string
          last_contact_date?: string | null
          last_order_date?: string | null
          manager_name?: string | null
          notes?: string | null
          organization_id?: string
          premise_type?: string | null
          premise_type_confidence?: number | null
          premise_type_manual_override?: boolean | null
          premise_type_updated_at?: string | null
          state?: string | null
          total_orders?: number | null
          total_revenue?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_training_configurations: {
        Row: {
          configuration_name: string
          created_at: string | null
          created_by: string
          distributor_id: string
          extraction_stats: Json | null
          failure_count: number | null
          field_mappings: Json | null
          id: string
          is_active: boolean | null
          last_successful_use: string | null
          organization_id: string | null
          orientation: string | null
          parsing_instructions: string | null
          success_count: number | null
          updated_at: string | null
        }
        Insert: {
          configuration_name: string
          created_at?: string | null
          created_by: string
          distributor_id: string
          extraction_stats?: Json | null
          failure_count?: number | null
          field_mappings?: Json | null
          id?: string
          is_active?: boolean | null
          last_successful_use?: string | null
          organization_id?: string | null
          orientation?: string | null
          parsing_instructions?: string | null
          success_count?: number | null
          updated_at?: string | null
        }
        Update: {
          configuration_name?: string
          created_at?: string | null
          created_by?: string
          distributor_id?: string
          extraction_stats?: Json | null
          failure_count?: number | null
          field_mappings?: Json | null
          id?: string
          is_active?: boolean | null
          last_successful_use?: string | null
          organization_id?: string | null
          orientation?: string | null
          parsing_instructions?: string | null
          success_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_training_configurations_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "distributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_training_configurations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          acknowledged: boolean | null
          acknowledged_at: string | null
          alert_type: string
          created_at: string | null
          description: string
          id: string
          organization_id: string
          related_task_id: string | null
          severity: string
          title: string
          trigger_data: Json | null
          user_id: string | null
        }
        Insert: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          alert_type: string
          created_at?: string | null
          description: string
          id?: string
          organization_id: string
          related_task_id?: string | null
          severity: string
          title: string
          trigger_data?: Json | null
          user_id?: string | null
        }
        Update: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          alert_type?: string
          created_at?: string | null
          description?: string
          id?: string
          organization_id?: string
          related_task_id?: string | null
          severity?: string
          title?: string
          trigger_data?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_related_task_id_fkey"
            columns: ["related_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_snapshots: {
        Row: {
          created_at: string | null
          id: string
          metrics: Json
          organization_id: string
          period_end: string
          period_start: string
          period_type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          metrics?: Json
          organization_id: string
          period_end: string
          period_start: string
          period_type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          metrics?: Json
          organization_id?: string
          period_end?: string
          period_start?: string
          period_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          organization_id: string
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          organization_id: string
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          organization_id?: string
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_invitations: {
        Row: {
          accepted_at: string | null
          company_name: string
          created_at: string | null
          email: string
          expires_at: string | null
          id: string
          invited_by: string | null
          organization_id: string | null
          status: string
          token: string
          updated_at: string | null
          welcome_message: string | null
        }
        Insert: {
          accepted_at?: string | null
          company_name: string
          created_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          organization_id?: string | null
          status?: string
          token?: string
          updated_at?: string | null
          welcome_message?: string | null
        }
        Update: {
          accepted_at?: string | null
          company_name?: string
          created_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          organization_id?: string | null
          status?: string
          token?: string
          updated_at?: string | null
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      column_mapping_history: {
        Row: {
          confidence_score: number | null
          created_at: string | null
          detected_columns: Json
          detection_method: string | null
          distributor_id: string | null
          filename_pattern: string | null
          final_mapping: Json
          id: string
          organization_id: string
          rows_processed: number | null
          success_rate: number | null
          upload_id: string | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string | null
          detected_columns: Json
          detection_method?: string | null
          distributor_id?: string | null
          filename_pattern?: string | null
          final_mapping: Json
          id?: string
          organization_id: string
          rows_processed?: number | null
          success_rate?: number | null
          upload_id?: string | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string | null
          detected_columns?: Json
          detection_method?: string | null
          distributor_id?: string | null
          filename_pattern?: string | null
          final_mapping?: Json
          id?: string
          organization_id?: string
          rows_processed?: number | null
          success_rate?: number | null
          upload_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "column_mapping_history_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "distributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "column_mapping_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "column_mapping_history_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      distributor_creation_audit: {
        Row: {
          created_at: string | null
          created_by_organization_id: string
          created_by_user_id: string
          distributor_id: string
          id: string
        }
        Insert: {
          created_at?: string | null
          created_by_organization_id: string
          created_by_user_id: string
          distributor_id: string
          id?: string
        }
        Update: {
          created_at?: string | null
          created_by_organization_id?: string
          created_by_user_id?: string
          distributor_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "distributor_creation_audit_created_by_organization_id_fkey"
            columns: ["created_by_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distributor_creation_audit_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "distributors"
            referencedColumns: ["id"]
          },
        ]
      }
      distributor_stats: {
        Row: {
          created_at: string | null
          distributor_id: string
          fob_revenue: number | null
          id: string
          last_calculated_at: string | null
          organization_id: string
          total_orders: number | null
          total_revenue: number | null
        }
        Insert: {
          created_at?: string | null
          distributor_id: string
          fob_revenue?: number | null
          id?: string
          last_calculated_at?: string | null
          organization_id: string
          total_orders?: number | null
          total_revenue?: number | null
        }
        Update: {
          created_at?: string | null
          distributor_id?: string
          fob_revenue?: number | null
          id?: string
          last_calculated_at?: string | null
          organization_id?: string
          total_orders?: number | null
          total_revenue?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "distributor_stats_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "distributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distributor_stats_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      distributors: {
        Row: {
          active: boolean | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          created_by_organization_id: string | null
          id: string
          is_global: boolean | null
          name: string
          organization_id: string | null
          state: string | null
          supports_pdf: boolean | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by_organization_id?: string | null
          id?: string
          is_global?: boolean | null
          name: string
          organization_id?: string | null
          state?: string | null
          supports_pdf?: boolean | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by_organization_id?: string | null
          id?: string
          is_global?: boolean | null
          name?: string
          organization_id?: string | null
          state?: string | null
          supports_pdf?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "distributors_created_by_organization_id_fkey"
            columns: ["created_by_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distributors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      duplicate_review_queue: {
        Row: {
          ai_analysis: Json | null
          created_at: string | null
          id: string
          organization_id: string
          potential_matches: Json
          product_name: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          upload_id: string
          user_decision: Json | null
        }
        Insert: {
          ai_analysis?: Json | null
          created_at?: string | null
          id?: string
          organization_id: string
          potential_matches?: Json
          product_name: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          upload_id: string
          user_decision?: Json | null
        }
        Update: {
          ai_analysis?: Json | null
          created_at?: string | null
          id?: string
          organization_id?: string
          potential_matches?: Json
          product_name?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          upload_id?: string
          user_decision?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "duplicate_review_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplicate_review_queue_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      field_synonyms: {
        Row: {
          confidence_weight: number | null
          created_at: string | null
          field_type: string
          id: string
          is_active: boolean | null
          organization_id: string | null
          synonym: string
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          confidence_weight?: number | null
          created_at?: string | null
          field_type: string
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          synonym: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          confidence_weight?: number | null
          created_at?: string | null
          field_type?: string
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          synonym?: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "field_synonyms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fob_pricing_matrix: {
        Row: {
          created_at: string | null
          created_by: string | null
          distributor_id: string
          fob_price_override: number
          id: string
          organization_id: string
          package_type: string | null
          product_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          distributor_id: string
          fob_price_override: number
          id?: string
          organization_id: string
          package_type?: string | null
          product_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          distributor_id?: string
          fob_price_override?: number
          id?: string
          organization_id?: string
          package_type?: string | null
          product_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fob_pricing_matrix_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "distributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fob_pricing_matrix_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fob_pricing_matrix_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_distributor: {
        Row: {
          created_at: string | null
          created_by: string | null
          current_quantity: number
          distributor_id: string
          id: string
          initial_quantity: number
          last_updated: string | null
          organization_id: string
          product_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          current_quantity?: number
          distributor_id: string
          id?: string
          initial_quantity?: number
          last_updated?: string | null
          organization_id: string
          product_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          current_quantity?: number
          distributor_id?: string
          id?: string
          initial_quantity?: number
          last_updated?: string | null
          organization_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_distributor_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "distributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_distributor_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_distributor_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_importer: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          organization_id: string
          product_id: string
          quantity: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          product_id: string
          quantity?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          product_id?: string
          quantity?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_importer_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_importer_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transactions: {
        Row: {
          created_at: string | null
          created_by: string | null
          distributor_id: string | null
          id: string
          new_quantity: number
          notes: string | null
          organization_id: string
          previous_quantity: number
          product_id: string
          quantity_change: number
          reference_id: string | null
          transaction_type: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          distributor_id?: string | null
          id?: string
          new_quantity: number
          notes?: string | null
          organization_id: string
          previous_quantity: number
          product_id: string
          quantity_change: number
          reference_id?: string | null
          transaction_type: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          distributor_id?: string | null
          id?: string
          new_quantity?: number
          notes?: string | null
          organization_id?: string
          previous_quantity?: number
          product_id?: string
          quantity_change?: number
          reference_id?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "distributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          email_sent: boolean | null
          email_sent_at: string | null
          expires_at: string | null
          id: string
          invited_by: string
          organization_id: string
          role: string
          status: string
          supabase_user_id: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          email_sent?: boolean | null
          email_sent_at?: string | null
          expires_at?: string | null
          id?: string
          invited_by: string
          organization_id: string
          role?: string
          status?: string
          supabase_user_id?: string | null
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          email_sent?: boolean | null
          email_sent_at?: string | null
          expires_at?: string | null
          id?: string
          invited_by?: string
          organization_id?: string
          role?: string
          status?: string
          supabase_user_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      merge_audit_log: {
        Row: {
          ai_reasoning: string | null
          can_undo: boolean | null
          confidence_score: number | null
          id: string
          merge_type: string
          organization_id: string
          performed_at: string | null
          performed_by: string | null
          records_affected: number | null
          source_product_names: string[]
          target_canonical_name: string
          undone_at: string | null
          undone_by: string | null
          upload_id: string | null
        }
        Insert: {
          ai_reasoning?: string | null
          can_undo?: boolean | null
          confidence_score?: number | null
          id?: string
          merge_type: string
          organization_id: string
          performed_at?: string | null
          performed_by?: string | null
          records_affected?: number | null
          source_product_names: string[]
          target_canonical_name: string
          undone_at?: string | null
          undone_by?: string | null
          upload_id?: string | null
        }
        Update: {
          ai_reasoning?: string | null
          can_undo?: boolean | null
          confidence_score?: number | null
          id?: string
          merge_type?: string
          organization_id?: string
          performed_at?: string | null
          performed_by?: string | null
          records_affected?: number | null
          source_product_names?: string[]
          target_canonical_name?: string
          undone_at?: string | null
          undone_by?: string | null
          upload_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merge_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merge_audit_log_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_distributors: {
        Row: {
          added_at: string | null
          added_by: string | null
          created_at: string | null
          distributor_id: string
          id: string
          is_favorited: boolean | null
          last_used_at: string | null
          organization_id: string
          state: string | null
          usage_count: number | null
        }
        Insert: {
          added_at?: string | null
          added_by?: string | null
          created_at?: string | null
          distributor_id: string
          id?: string
          is_favorited?: boolean | null
          last_used_at?: string | null
          organization_id: string
          state?: string | null
          usage_count?: number | null
        }
        Update: {
          added_at?: string | null
          added_by?: string | null
          created_at?: string | null
          distributor_id?: string
          id?: string
          is_favorited?: boolean | null
          last_used_at?: string | null
          organization_id?: string
          state?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_distributors_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "distributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_distributors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          id: string
          invited_by: string | null
          joined_at: string | null
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          auto_merge_threshold: number | null
          created_at: string | null
          created_by_admin_user_id: string | null
          created_by_platform_admin: boolean | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_trial: boolean | null
          logo_file_path: string | null
          logo_url: string | null
          name: string
          openai_api_key_encrypted: string | null
          platform_admin_notes: string | null
          settings: Json | null
          trial_ends_at: string | null
        }
        Insert: {
          auto_merge_threshold?: number | null
          created_at?: string | null
          created_by_admin_user_id?: string | null
          created_by_platform_admin?: boolean | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_trial?: boolean | null
          logo_file_path?: string | null
          logo_url?: string | null
          name: string
          openai_api_key_encrypted?: string | null
          platform_admin_notes?: string | null
          settings?: Json | null
          trial_ends_at?: string | null
        }
        Update: {
          auto_merge_threshold?: number | null
          created_at?: string | null
          created_by_admin_user_id?: string | null
          created_by_platform_admin?: boolean | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_trial?: boolean | null
          logo_file_path?: string | null
          logo_url?: string | null
          name?: string
          openai_api_key_encrypted?: string | null
          platform_admin_notes?: string | null
          settings?: Json | null
          trial_ends_at?: string | null
        }
        Relationships: []
      }
      pending_distributors: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          id: string
          name: string
          reason: string | null
          requested_by_organization_id: string
          requested_by_user_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          similar_distributor_ids: string[] | null
          similarity_scores: Json | null
          state: string | null
          status: string
          supports_pdf: boolean | null
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          name: string
          reason?: string | null
          requested_by_organization_id: string
          requested_by_user_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          similar_distributor_ids?: string[] | null
          similarity_scores?: Json | null
          state?: string | null
          status?: string
          supports_pdf?: boolean | null
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          name?: string
          reason?: string | null
          requested_by_organization_id?: string
          requested_by_user_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          similar_distributor_ids?: string[] | null
          similarity_scores?: Json | null
          state?: string | null
          status?: string
          supports_pdf?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_distributors_requested_by_organization_id_fkey"
            columns: ["requested_by_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admin_config: {
        Row: {
          created_at: string | null
          id: string
          platform_admin_user_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          platform_admin_user_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          platform_admin_user_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      product_mappings: {
        Row: {
          canonical_name: string
          confidence_score: number
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          last_used_at: string | null
          organization_id: string
          product_variant: string
          source: string
          usage_count: number | null
        }
        Insert: {
          canonical_name: string
          confidence_score?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          organization_id: string
          product_variant: string
          source?: string
          usage_count?: number | null
        }
        Update: {
          canonical_name?: string
          confidence_score?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          organization_id?: string
          product_variant?: string
          source?: string
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          available_package_types: Json | null
          average_price: number | null
          brand: string | null
          default_case_size: number | null
          default_fob_price: number | null
          default_package_type: string | null
          first_sale_date: string | null
          id: string
          last_sale_date: string | null
          manual_brand: boolean
          organization_id: string
          product_name: string
          total_orders: number | null
          total_revenue: number | null
          total_units: number | null
          updated_at: string | null
        }
        Insert: {
          available_package_types?: Json | null
          average_price?: number | null
          brand?: string | null
          default_case_size?: number | null
          default_fob_price?: number | null
          default_package_type?: string | null
          first_sale_date?: string | null
          id?: string
          last_sale_date?: string | null
          manual_brand?: boolean
          organization_id: string
          product_name: string
          total_orders?: number | null
          total_revenue?: number | null
          total_units?: number | null
          updated_at?: string | null
        }
        Update: {
          available_package_types?: Json | null
          average_price?: number | null
          brand?: string | null
          default_case_size?: number | null
          default_fob_price?: number | null
          default_package_type?: string | null
          first_sale_date?: string | null
          id?: string
          last_sale_date?: string | null
          manual_brand?: boolean
          organization_id?: string
          product_name?: string
          total_orders?: number | null
          total_revenue?: number | null
          total_units?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_data: {
        Row: {
          account_name: string
          account_state: string | null
          bottles_per_unit: number | null
          brand: string | null
          canonical_product_id: string | null
          case_size: number | null
          category: string | null
          created_at: string | null
          date_of_sale: string | null
          default_period: string | null
          distributor: string | null
          has_revenue_data: boolean | null
          id: string
          inventory_processed: boolean | null
          inventory_processed_at: string | null
          inventory_transaction_id: string | null
          normalized_name: string | null
          order_date: string | null
          order_id: string | null
          organization_id: string
          package_type: string | null
          premise_type: string | null
          product_name: string
          quantity: number | null
          quantity_in_bottles: number | null
          quantity_unit: string | null
          raw_data: Json | null
          region: string | null
          representative: string | null
          revenue: number | null
          unit_price: number | null
          upload_id: string | null
        }
        Insert: {
          account_name: string
          account_state?: string | null
          bottles_per_unit?: number | null
          brand?: string | null
          canonical_product_id?: string | null
          case_size?: number | null
          category?: string | null
          created_at?: string | null
          date_of_sale?: string | null
          default_period?: string | null
          distributor?: string | null
          has_revenue_data?: boolean | null
          id?: string
          inventory_processed?: boolean | null
          inventory_processed_at?: string | null
          inventory_transaction_id?: string | null
          normalized_name?: string | null
          order_date?: string | null
          order_id?: string | null
          organization_id: string
          package_type?: string | null
          premise_type?: string | null
          product_name: string
          quantity?: number | null
          quantity_in_bottles?: number | null
          quantity_unit?: string | null
          raw_data?: Json | null
          region?: string | null
          representative?: string | null
          revenue?: number | null
          unit_price?: number | null
          upload_id?: string | null
        }
        Update: {
          account_name?: string
          account_state?: string | null
          bottles_per_unit?: number | null
          brand?: string | null
          canonical_product_id?: string | null
          case_size?: number | null
          category?: string | null
          created_at?: string | null
          date_of_sale?: string | null
          default_period?: string | null
          distributor?: string | null
          has_revenue_data?: boolean | null
          id?: string
          inventory_processed?: boolean | null
          inventory_processed_at?: string | null
          inventory_transaction_id?: string | null
          normalized_name?: string | null
          order_date?: string | null
          order_id?: string | null
          organization_id?: string
          package_type?: string | null
          premise_type?: string | null
          product_name?: string
          quantity?: number | null
          quantity_in_bottles?: number | null
          quantity_unit?: string | null
          raw_data?: Json | null
          region?: string | null
          representative?: string | null
          revenue?: number | null
          unit_price?: number | null
          upload_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_data_canonical_product_id_fkey"
            columns: ["canonical_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_data_inventory_transaction_id_fkey"
            columns: ["inventory_transaction_id"]
            isOneToOne: false
            referencedRelation: "inventory_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_data_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_data_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          canceled_at: string | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          organization_id: string
          plan_amount: number | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          organization_id: string
          plan_amount?: number | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          organization_id?: string
          plan_amount?: number | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          auto_generated: boolean | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          insight_id: string | null
          metadata: Json | null
          organization_id: string
          priority: string
          related_account: string | null
          related_product: string | null
          related_revenue: number | null
          status: string
          tags: Json | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          auto_generated?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          insight_id?: string | null
          metadata?: Json | null
          organization_id: string
          priority?: string
          related_account?: string | null
          related_product?: string | null
          related_revenue?: number | null
          status?: string
          tags?: Json | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          auto_generated?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          insight_id?: string | null
          metadata?: Json | null
          organization_id?: string
          priority?: string
          related_account?: string | null
          related_product?: string | null
          related_revenue?: number | null
          status?: string
          tags?: Json | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      uploads: {
        Row: {
          column_mapping: Json | null
          created_at: string | null
          distributor_id: string | null
          error_message: string | null
          file_path: string | null
          file_size: number
          filename: string
          id: string
          is_reprocessable: boolean | null
          organization_id: string
          original_upload_id: string | null
          processed_at: string | null
          reprocessed_at: string | null
          reprocessed_count: number | null
          reprocessing_results: Json | null
          row_count: number | null
          status: string
          unit_type: string | null
          user_id: string
        }
        Insert: {
          column_mapping?: Json | null
          created_at?: string | null
          distributor_id?: string | null
          error_message?: string | null
          file_path?: string | null
          file_size?: number
          filename: string
          id?: string
          is_reprocessable?: boolean | null
          organization_id: string
          original_upload_id?: string | null
          processed_at?: string | null
          reprocessed_at?: string | null
          reprocessed_count?: number | null
          reprocessing_results?: Json | null
          row_count?: number | null
          status?: string
          unit_type?: string | null
          user_id: string
        }
        Update: {
          column_mapping?: Json | null
          created_at?: string | null
          distributor_id?: string | null
          error_message?: string | null
          file_path?: string | null
          file_size?: number
          filename?: string
          id?: string
          is_reprocessable?: boolean | null
          organization_id?: string
          original_upload_id?: string | null
          processed_at?: string | null
          reprocessed_at?: string | null
          reprocessed_count?: number | null
          reprocessing_results?: Json | null
          row_count?: number | null
          status?: string
          unit_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "uploads_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "distributors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uploads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uploads_original_upload_id_fkey"
            columns: ["original_upload_id"]
            isOneToOne: false
            referencedRelation: "uploads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_distributor_duplicates: {
        Args: { distributor_name: string }
        Returns: {
          distributor_id: string
          distributor_name_match: string
          similarity_score: number
        }[]
      }
      clean_old_duplicate_queue_entries: { Args: never; Returns: undefined }
      create_organization_with_admin: {
        Args: { admin_user_id: string; org_name: string }
        Returns: string
      }
      create_organization_with_owner: {
        Args: { org_name: string }
        Returns: {
          id: string
          name: string
          role: string
        }[]
      }
      get_platform_admin_user_id: { Args: never; Returns: string }
      get_user_admin_organization_ids: {
        Args: never
        Returns: {
          organization_id: string
        }[]
      }
      get_user_email: { Args: { user_id: string }; Returns: string }
      get_user_emails: {
        Args: { user_ids: string[] }
        Returns: {
          email: string
          id: string
        }[]
      }
      get_user_organization_ids: {
        Args: never
        Returns: {
          organization_id: string
        }[]
      }
      increment_mapping_usage: {
        Args: { mapping_id: string }
        Returns: undefined
      }
      is_organization_admin:
        | { Args: { org_id: string }; Returns: boolean }
        | { Args: { check_user_id: string; org_id: string }; Returns: boolean }
      is_organization_member:
        | { Args: { org_id: string }; Returns: boolean }
        | { Args: { check_user_id: string; org_id: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      log_audit_event: {
        Args: {
          p_action: string
          p_metadata?: Json
          p_organization_id: string
          p_resource_id?: string
          p_resource_type: string
        }
        Returns: string
      }
      refresh_all_distributor_stats: {
        Args: { org_id: string }
        Returns: undefined
      }
      refresh_distributor_stats: {
        Args: { dist_id: string; org_id: string }
        Returns: undefined
      }
      restore_organization: { Args: { org_id: string }; Returns: boolean }
      soft_delete_organization: {
        Args: { deletion_reason?: string; org_id: string }
        Returns: boolean
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
