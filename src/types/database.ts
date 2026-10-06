export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      app_settings: {
        Row: {
          description: string
          key: string
          updated_at: string
          updated_by: string | null
          value: NonNullable<Json>
        }
        Insert: {
          description?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: NonNullable<Json>
        }
        Update: {
          description?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: NonNullable<Json>
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          at: string
          id: number
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      brands: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      cash_movements: {
        Row: {
          affects_physical_cash: boolean
          amount: number
          cash_session_id: string
          created_at: string
          created_by: string | null
          description: string | null
          direction: string
          id: number
          kind: Database['public']['Enums']['cash_movement_kind']
          payment_method_id: string
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          affects_physical_cash: boolean
          amount: number
          cash_session_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          direction: string
          id?: never
          kind: Database['public']['Enums']['cash_movement_kind']
          payment_method_id: string
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          affects_physical_cash?: boolean
          amount?: number
          cash_session_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          direction?: string
          id?: never
          kind?: Database['public']['Enums']['cash_movement_kind']
          payment_method_id?: string
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'cash_movements_cash_session_id_fkey'
            columns: ['cash_session_id']
            isOneToOne: false
            referencedRelation: 'cash_sessions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cash_movements_cash_session_id_fkey'
            columns: ['cash_session_id']
            isOneToOne: false
            referencedRelation: 'v_cash_sessions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cash_movements_payment_method_id_fkey'
            columns: ['payment_method_id']
            isOneToOne: false
            referencedRelation: 'payment_methods'
            referencedColumns: ['id']
          },
        ]
      }
      cash_registers: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      cash_session_totals: {
        Row: {
          expected: number
          payment_method_id: string
          reported: number | null
          session_id: string
          total_in: number
          total_out: number
        }
        Insert: {
          expected: number
          payment_method_id: string
          reported?: number | null
          session_id: string
          total_in: number
          total_out: number
        }
        Update: {
          expected?: number
          payment_method_id?: string
          reported?: number | null
          session_id?: string
          total_in?: number
          total_out?: number
        }
        Relationships: [
          {
            foreignKeyName: 'cash_session_totals_payment_method_id_fkey'
            columns: ['payment_method_id']
            isOneToOne: false
            referencedRelation: 'payment_methods'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cash_session_totals_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'cash_sessions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cash_session_totals_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'v_cash_sessions'
            referencedColumns: ['id']
          },
        ]
      }
      cash_sessions: {
        Row: {
          cash_difference: number | null
          closed_at: string | null
          closed_by: string | null
          closing_notes: string | null
          counted_cash: number | null
          expected_cash: number | null
          id: string
          number: number
          opened_at: string
          opened_by: string
          opening_amount: number
          opening_notes: string | null
          register_id: string
          reopened_count: number
          status: string
          updated_at: string
        }
        Insert: {
          cash_difference?: number | null
          closed_at?: string | null
          closed_by?: string | null
          closing_notes?: string | null
          counted_cash?: number | null
          expected_cash?: number | null
          id?: string
          number?: never
          opened_at?: string
          opened_by?: string
          opening_amount: number
          opening_notes?: string | null
          register_id: string
          reopened_count?: number
          status?: string
          updated_at?: string
        }
        Update: {
          cash_difference?: number | null
          closed_at?: string | null
          closed_by?: string | null
          closing_notes?: string | null
          counted_cash?: number | null
          expected_cash?: number | null
          id?: string
          number?: never
          opened_at?: string
          opened_by?: string
          opening_amount?: number
          opening_notes?: string | null
          register_id?: string
          reopened_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'cash_sessions_closed_by_fkey'
            columns: ['closed_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cash_sessions_opened_by_fkey'
            columns: ['opened_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cash_sessions_register_id_fkey'
            columns: ['register_id']
            isOneToOne: false
            referencedRelation: 'cash_registers'
            referencedColumns: ['id']
          },
        ]
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'categories_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
        ]
      }
      colors: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          hex: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          hex?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          hex?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      cost_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: number
          new_avg_cost: number
          new_last_cost: number
          old_avg_cost: number | null
          old_last_cost: number | null
          variant_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: never
          new_avg_cost: number
          new_last_cost: number
          old_avg_cost?: number | null
          old_last_cost?: number | null
          variant_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: never
          new_avg_cost?: number
          new_last_cost?: number
          old_avg_cost?: number | null
          old_last_cost?: number | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'cost_history_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_variants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cost_history_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'v_variants'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'cost_history_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'v_variants_all'
            referencedColumns: ['variant_id']
          },
        ]
      }
      customers: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          document: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          document?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          cash_session_id: string | null
          category_id: string
          created_at: string
          created_by: string
          description: string
          expense_date: string
          id: string
          notes: string | null
          number: number
          paid_from_register: boolean
          payment_method_id: string
          receipt_ref: string | null
          supplier_id: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount: number
          cash_session_id?: string | null
          category_id: string
          created_at?: string
          created_by?: string
          description: string
          expense_date?: string
          id?: string
          notes?: string | null
          number?: never
          paid_from_register?: boolean
          payment_method_id: string
          receipt_ref?: string | null
          supplier_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number
          cash_session_id?: string | null
          category_id?: string
          created_at?: string
          created_by?: string
          description?: string
          expense_date?: string
          id?: string
          notes?: string | null
          number?: never
          paid_from_register?: boolean
          payment_method_id?: string
          receipt_ref?: string | null
          supplier_id?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'expenses_cash_session_id_fkey'
            columns: ['cash_session_id']
            isOneToOne: false
            referencedRelation: 'cash_sessions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'expenses_cash_session_id_fkey'
            columns: ['cash_session_id']
            isOneToOne: false
            referencedRelation: 'v_cash_sessions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'expenses_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'expense_categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'expenses_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'expenses_payment_method_id_fkey'
            columns: ['payment_method_id']
            isOneToOne: false
            referencedRelation: 'payment_methods'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'expenses_supplier_id_fkey'
            columns: ['supplier_id']
            isOneToOne: false
            referencedRelation: 'suppliers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'expenses_supplier_id_fkey'
            columns: ['supplier_id']
            isOneToOne: false
            referencedRelation: 'v_supplier_balances'
            referencedColumns: ['supplier_id']
          },
          {
            foreignKeyName: 'expenses_voided_by_fkey'
            columns: ['voided_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      import_batch_rows: {
        Row: {
          action: string | null
          batch_id: string
          errors: NonNullable<Json>
          id: number
          parsed: Json | null
          raw: NonNullable<Json>
          row_number: number
          status: string
          variant_id: string | null
          warnings: NonNullable<Json>
        }
        Insert: {
          action?: string | null
          batch_id: string
          errors?: NonNullable<Json>
          id?: never
          parsed?: Json | null
          raw: NonNullable<Json>
          row_number: number
          status?: string
          variant_id?: string | null
          warnings?: NonNullable<Json>
        }
        Update: {
          action?: string | null
          batch_id?: string
          errors?: NonNullable<Json>
          id?: never
          parsed?: Json | null
          raw?: NonNullable<Json>
          row_number?: number
          status?: string
          variant_id?: string | null
          warnings?: NonNullable<Json>
        }
        Relationships: [
          {
            foreignKeyName: 'import_batch_rows_batch_id_fkey'
            columns: ['batch_id']
            isOneToOne: false
            referencedRelation: 'import_batches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'import_batch_rows_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_variants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'import_batch_rows_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'v_variants'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'import_batch_rows_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'v_variants_all'
            referencedColumns: ['variant_id']
          },
        ]
      }
      import_batches: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          created_at: string
          created_by: string
          error_rows: number
          file_name: string | null
          id: string
          mode: string
          number: number
          ok_rows: number
          options: NonNullable<Json>
          status: string
          summary: Json | null
          total_rows: number
          validated_at: string | null
          warning_rows: number
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string | null
          created_at?: string
          created_by?: string
          error_rows?: number
          file_name?: string | null
          id?: string
          mode: string
          number?: never
          ok_rows?: number
          options?: NonNullable<Json>
          status?: string
          summary?: Json | null
          total_rows?: number
          validated_at?: string | null
          warning_rows?: number
        }
        Update: {
          applied_at?: string | null
          applied_by?: string | null
          created_at?: string
          created_by?: string
          error_rows?: number
          file_name?: string | null
          id?: string
          mode?: string
          number?: never
          ok_rows?: number
          options?: NonNullable<Json>
          status?: string
          summary?: Json | null
          total_rows?: number
          validated_at?: string | null
          warning_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: 'import_batches_applied_by_fkey'
            columns: ['applied_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'import_batches_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      inventory_count_items: {
        Row: {
          applied_movement_id: number | null
          count_id: string
          counted_at: string | null
          counted_by: string | null
          counted_qty: number | null
          difference: number | null
          expected_qty: number
          id: string
          notes: string | null
          system_qty_at_count: number | null
          variant_id: string
        }
        Insert: {
          applied_movement_id?: number | null
          count_id: string
          counted_at?: string | null
          counted_by?: string | null
          counted_qty?: number | null
          difference?: number | null
          expected_qty: number
          id?: string
          notes?: string | null
          system_qty_at_count?: number | null
          variant_id: string
        }
        Update: {
          applied_movement_id?: number | null
          count_id?: string
          counted_at?: string | null
          counted_by?: string | null
          counted_qty?: number | null
          difference?: number | null
          expected_qty?: number
          id?: string
          notes?: string | null
          system_qty_at_count?: number | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'inventory_count_items_count_id_fkey'
            columns: ['count_id']
            isOneToOne: false
            referencedRelation: 'inventory_counts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'inventory_count_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_variants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'inventory_count_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'v_variants'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'inventory_count_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'v_variants_all'
            referencedColumns: ['variant_id']
          },
        ]
      }
      inventory_counts: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          category_id: string | null
          created_by: string | null
          id: string
          name: string
          notes: string | null
          number: number
          scope: string
          started_at: string
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          category_id?: string | null
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          number?: never
          scope: string
          started_at?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          applied_at?: string | null
          applied_by?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          category_id?: string | null
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          number?: never
          scope?: string
          started_at?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'inventory_counts_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
        ]
      }
      payment_methods: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          id: string
          is_cash: boolean
          is_system: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_cash: boolean
          is_system?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_cash?: boolean
          is_system?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      price_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: number
          new_price: number
          old_price: number | null
          variant_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: never
          new_price: number
          old_price?: number | null
          variant_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: never
          new_price?: number
          old_price?: number | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'price_history_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_variants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'price_history_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'v_variants'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'price_history_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'v_variants_all'
            referencedColumns: ['variant_id']
          },
        ]
      }
      product_variants: {
        Row: {
          active: boolean
          color_id: string
          created_at: string
          created_by: string | null
          ean: string | null
          id: string
          min_stock: number
          price: number
          product_id: string
          size_id: string
          sku: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          color_id: string
          created_at?: string
          created_by?: string | null
          ean?: string | null
          id?: string
          min_stock?: number
          price?: number
          product_id: string
          size_id: string
          sku: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          color_id?: string
          created_at?: string
          created_by?: string | null
          ean?: string | null
          id?: string
          min_stock?: number
          price?: number
          product_id?: string
          size_id?: string
          sku?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'product_variants_color_id_fkey'
            columns: ['color_id']
            isOneToOne: false
            referencedRelation: 'colors'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'product_variants_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'product_variants_size_id_fkey'
            columns: ['size_id']
            isOneToOne: false
            referencedRelation: 'sizes'
            referencedColumns: ['id']
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          brand_id: string | null
          category_id: string | null
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          brand_id?: string | null
          category_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          brand_id?: string | null
          category_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'products_brand_id_fkey'
            columns: ['brand_id']
            isOneToOne: false
            referencedRelation: 'brands'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_supplier_id_fkey'
            columns: ['supplier_id']
            isOneToOne: false
            referencedRelation: 'suppliers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_supplier_id_fkey'
            columns: ['supplier_id']
            isOneToOne: false
            referencedRelation: 'v_supplier_balances'
            referencedColumns: ['supplier_id']
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          full_name: string
          id: string
          role: Database['public']['Enums']['app_role']
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          role?: Database['public']['Enums']['app_role']
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          role?: Database['public']['Enums']['app_role']
          updated_at?: string
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          color_name: string
          id: string
          line_total: number
          product_name: string
          purchase_id: string
          quantity: number
          size_name: string
          sku: string
          unit_cost: number
          variant_id: string
        }
        Insert: {
          color_name: string
          id?: string
          line_total: number
          product_name: string
          purchase_id: string
          quantity: number
          size_name: string
          sku: string
          unit_cost: number
          variant_id: string
        }
        Update: {
          color_name?: string
          id?: string
          line_total?: number
          product_name?: string
          purchase_id?: string
          quantity?: number
          size_name?: string
          sku?: string
          unit_cost?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'purchase_items_purchase_id_fkey'
            columns: ['purchase_id']
            isOneToOne: false
            referencedRelation: 'purchases'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'purchase_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_variants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'purchase_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'v_variants'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'purchase_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'v_variants_all'
            referencedColumns: ['variant_id']
          },
        ]
      }
      purchases: {
        Row: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string
          discount_amount: number
          due_date: string | null
          id: string
          invoice_number: string | null
          notes: string | null
          number: number
          paid_amount: number
          payment_status: string
          purchase_date: string
          received_at: string | null
          received_by: string | null
          status: string
          subtotal: number
          supplier_id: string
          supplier_name: string | null
          tax_amount: number
          total: number
          updated_at: string
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string
          discount_amount?: number
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          number?: never
          paid_amount?: number
          payment_status?: string
          purchase_date?: string
          received_at?: string | null
          received_by?: string | null
          status?: string
          subtotal?: number
          supplier_id: string
          supplier_name?: string | null
          tax_amount?: number
          total?: number
          updated_at?: string
        }
        Update: {
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string
          discount_amount?: number
          due_date?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          number?: never
          paid_amount?: number
          payment_status?: string
          purchase_date?: string
          received_at?: string | null
          received_by?: string | null
          status?: string
          subtotal?: number
          supplier_id?: string
          supplier_name?: string | null
          tax_amount?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'purchases_cancelled_by_fkey'
            columns: ['cancelled_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'purchases_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'purchases_received_by_fkey'
            columns: ['received_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'purchases_supplier_id_fkey'
            columns: ['supplier_id']
            isOneToOne: false
            referencedRelation: 'suppliers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'purchases_supplier_id_fkey'
            columns: ['supplier_id']
            isOneToOne: false
            referencedRelation: 'v_supplier_balances'
            referencedColumns: ['supplier_id']
          },
        ]
      }
      sale_item_costs: {
        Row: {
          sale_item_id: string
          unit_cost: number
        }
        Insert: {
          sale_item_id: string
          unit_cost: number
        }
        Update: {
          sale_item_id?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: 'sale_item_costs_sale_item_id_fkey'
            columns: ['sale_item_id']
            isOneToOne: true
            referencedRelation: 'sale_items'
            referencedColumns: ['id']
          },
        ]
      }
      sale_items: {
        Row: {
          color_name: string
          discount_amount: number
          ean: string | null
          id: string
          line_total: number
          product_code: string
          product_name: string
          quantity: number
          sale_id: string
          size_name: string
          sku: string
          unit_price: number
          variant_id: string
        }
        Insert: {
          color_name: string
          discount_amount?: number
          ean?: string | null
          id?: string
          line_total: number
          product_code: string
          product_name: string
          quantity: number
          sale_id: string
          size_name: string
          sku: string
          unit_price: number
          variant_id: string
        }
        Update: {
          color_name?: string
          discount_amount?: number
          ean?: string | null
          id?: string
          line_total?: number
          product_code?: string
          product_name?: string
          quantity?: number
          sale_id?: string
          size_name?: string
          sku?: string
          unit_price?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sale_items_sale_id_fkey'
            columns: ['sale_id']
            isOneToOne: false
            referencedRelation: 'sales'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sale_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_variants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sale_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'v_variants'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'sale_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'v_variants_all'
            referencedColumns: ['variant_id']
          },
        ]
      }
      sale_payments: {
        Row: {
          amount: number
          amount_tendered: number | null
          change_given: number
          id: string
          installments: number | null
          is_cash: boolean
          method_name: string
          payment_method_id: string
          reference: string | null
          sale_id: string
        }
        Insert: {
          amount: number
          amount_tendered?: number | null
          change_given?: number
          id?: string
          installments?: number | null
          is_cash: boolean
          method_name: string
          payment_method_id: string
          reference?: string | null
          sale_id: string
        }
        Update: {
          amount?: number
          amount_tendered?: number | null
          change_given?: number
          id?: string
          installments?: number | null
          is_cash?: boolean
          method_name?: string
          payment_method_id?: string
          reference?: string | null
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sale_payments_payment_method_id_fkey'
            columns: ['payment_method_id']
            isOneToOne: false
            referencedRelation: 'payment_methods'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sale_payments_sale_id_fkey'
            columns: ['sale_id']
            isOneToOne: false
            referencedRelation: 'sales'
            referencedColumns: ['id']
          },
        ]
      }
      sale_return_items: {
        Row: {
          id: string
          quantity: number
          refund_amount: number
          return_id: string
          sale_item_id: string
          variant_id: string
        }
        Insert: {
          id?: string
          quantity: number
          refund_amount: number
          return_id: string
          sale_item_id: string
          variant_id: string
        }
        Update: {
          id?: string
          quantity?: number
          refund_amount?: number
          return_id?: string
          sale_item_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sale_return_items_return_id_fkey'
            columns: ['return_id']
            isOneToOne: false
            referencedRelation: 'sale_returns'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sale_return_items_sale_item_id_fkey'
            columns: ['sale_item_id']
            isOneToOne: false
            referencedRelation: 'sale_items'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sale_return_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_variants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sale_return_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'v_variants'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'sale_return_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'v_variants_all'
            referencedColumns: ['variant_id']
          },
        ]
      }
      sale_returns: {
        Row: {
          cash_session_id: string
          created_at: string
          created_by: string
          id: string
          number: number
          reason: string
          refund_amount: number
          refund_method_id: string
          restock: boolean
          sale_id: string
        }
        Insert: {
          cash_session_id: string
          created_at?: string
          created_by?: string
          id?: string
          number?: never
          reason: string
          refund_amount: number
          refund_method_id: string
          restock?: boolean
          sale_id: string
        }
        Update: {
          cash_session_id?: string
          created_at?: string
          created_by?: string
          id?: string
          number?: never
          reason?: string
          refund_amount?: number
          refund_method_id?: string
          restock?: boolean
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sale_returns_cash_session_id_fkey'
            columns: ['cash_session_id']
            isOneToOne: false
            referencedRelation: 'cash_sessions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sale_returns_cash_session_id_fkey'
            columns: ['cash_session_id']
            isOneToOne: false
            referencedRelation: 'v_cash_sessions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sale_returns_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sale_returns_refund_method_id_fkey'
            columns: ['refund_method_id']
            isOneToOne: false
            referencedRelation: 'payment_methods'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sale_returns_sale_id_fkey'
            columns: ['sale_id']
            isOneToOne: false
            referencedRelation: 'sales'
            referencedColumns: ['id']
          },
        ]
      }
      sales: {
        Row: {
          cash_session_id: string
          client_request_id: string
          created_at: string
          created_by: string
          customer_id: string | null
          discount_amount: number
          id: string
          notes: string | null
          number: number
          seller_name: string | null
          status: string
          subtotal: number
          total: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          cash_session_id: string
          client_request_id: string
          created_at?: string
          created_by?: string
          customer_id?: string | null
          discount_amount?: number
          id?: string
          notes?: string | null
          number?: number
          seller_name?: string | null
          status?: string
          subtotal: number
          total: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          cash_session_id?: string
          client_request_id?: string
          created_at?: string
          created_by?: string
          customer_id?: string | null
          discount_amount?: number
          id?: string
          notes?: string | null
          number?: number
          seller_name?: string | null
          status?: string
          subtotal?: number
          total?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'sales_cash_session_id_fkey'
            columns: ['cash_session_id']
            isOneToOne: false
            referencedRelation: 'cash_sessions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sales_cash_session_id_fkey'
            columns: ['cash_session_id']
            isOneToOne: false
            referencedRelation: 'v_cash_sessions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sales_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sales_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sales_voided_by_fkey'
            columns: ['voided_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      sizes: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          name: string
          size_group: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          size_group?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          size_group?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      stock_levels: {
        Row: {
          quantity: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          quantity?: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          quantity?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'stock_levels_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: true
            referencedRelation: 'product_variants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'stock_levels_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: true
            referencedRelation: 'v_variants'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'stock_levels_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: true
            referencedRelation: 'v_variants_all'
            referencedColumns: ['variant_id']
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: number
          movement_type: Database['public']['Enums']['stock_movement_type']
          notes: string | null
          quantity: number
          reason: string | null
          reference_id: string | null
          reference_type: string | null
          stock_after: number
          stock_before: number
          unit_cost: number | null
          variant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: never
          movement_type: Database['public']['Enums']['stock_movement_type']
          notes?: string | null
          quantity: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          stock_after: number
          stock_before: number
          unit_cost?: number | null
          variant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: never
          movement_type?: Database['public']['Enums']['stock_movement_type']
          notes?: string | null
          quantity?: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          stock_after?: number
          stock_before?: number
          unit_cost?: number | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'stock_movements_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'product_variants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'stock_movements_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'v_variants'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'stock_movements_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'v_variants_all'
            referencedColumns: ['variant_id']
          },
        ]
      }
      supplier_ledger: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          entry_date: string
          entry_type: Database['public']['Enums']['supplier_ledger_type']
          id: number
          notes: string | null
          reference_id: string | null
          reference_type: string | null
          supplier_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          entry_date?: string
          entry_type: Database['public']['Enums']['supplier_ledger_type']
          id?: never
          notes?: string | null
          reference_id?: string | null
          reference_type?: string | null
          supplier_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          entry_date?: string
          entry_type?: Database['public']['Enums']['supplier_ledger_type']
          id?: never
          notes?: string | null
          reference_id?: string | null
          reference_type?: string | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'supplier_ledger_supplier_id_fkey'
            columns: ['supplier_id']
            isOneToOne: false
            referencedRelation: 'suppliers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'supplier_ledger_supplier_id_fkey'
            columns: ['supplier_id']
            isOneToOne: false
            referencedRelation: 'v_supplier_balances'
            referencedColumns: ['supplier_id']
          },
        ]
      }
      supplier_payment_allocations: {
        Row: {
          amount: number
          payment_id: string
          purchase_id: string
        }
        Insert: {
          amount: number
          payment_id: string
          purchase_id: string
        }
        Update: {
          amount?: number
          payment_id?: string
          purchase_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'supplier_payment_allocations_payment_id_fkey'
            columns: ['payment_id']
            isOneToOne: false
            referencedRelation: 'supplier_payments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'supplier_payment_allocations_purchase_id_fkey'
            columns: ['purchase_id']
            isOneToOne: false
            referencedRelation: 'purchases'
            referencedColumns: ['id']
          },
        ]
      }
      supplier_payments: {
        Row: {
          amount: number
          cash_session_id: string | null
          created_at: string
          created_by: string
          id: string
          notes: string | null
          number: number
          paid_at: string
          payment_method_id: string
          reference: string | null
          supplier_id: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount: number
          cash_session_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          number?: never
          paid_at?: string
          payment_method_id: string
          reference?: string | null
          supplier_id: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number
          cash_session_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          number?: never
          paid_at?: string
          payment_method_id?: string
          reference?: string | null
          supplier_id?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'supplier_payments_cash_session_id_fkey'
            columns: ['cash_session_id']
            isOneToOne: false
            referencedRelation: 'cash_sessions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'supplier_payments_cash_session_id_fkey'
            columns: ['cash_session_id']
            isOneToOne: false
            referencedRelation: 'v_cash_sessions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'supplier_payments_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'supplier_payments_payment_method_id_fkey'
            columns: ['payment_method_id']
            isOneToOne: false
            referencedRelation: 'payment_methods'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'supplier_payments_supplier_id_fkey'
            columns: ['supplier_id']
            isOneToOne: false
            referencedRelation: 'suppliers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'supplier_payments_supplier_id_fkey'
            columns: ['supplier_id']
            isOneToOne: false
            referencedRelation: 'v_supplier_balances'
            referencedColumns: ['supplier_id']
          },
          {
            foreignKeyName: 'supplier_payments_voided_by_fkey'
            columns: ['voided_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          address: string | null
          contact: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          payment_terms_days: number
          phone: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          contact?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          payment_terms_days?: number
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          contact?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          payment_terms_days?: number
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      variant_costs: {
        Row: {
          avg_cost: number
          last_cost: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          avg_cost?: number
          last_cost?: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          avg_cost?: number
          last_cost?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'variant_costs_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: true
            referencedRelation: 'product_variants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'variant_costs_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: true
            referencedRelation: 'v_variants'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'variant_costs_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: true
            referencedRelation: 'v_variants_all'
            referencedColumns: ['variant_id']
          },
        ]
      }
    }
    Views: {
      v_cash_method_totals: {
        Row: {
          code: string | null
          is_cash: boolean | null
          name: string | null
          net: number | null
          payment_method_id: string | null
          session_id: string | null
          sort_order: number | null
          total_in: number | null
          total_out: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'cash_movements_cash_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'cash_sessions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cash_movements_cash_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'v_cash_sessions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cash_movements_payment_method_id_fkey'
            columns: ['payment_method_id']
            isOneToOne: false
            referencedRelation: 'payment_methods'
            referencedColumns: ['id']
          },
        ]
      }
      v_cash_sessions: {
        Row: {
          cash_difference: number | null
          closed_at: string | null
          closed_by: string | null
          closing_notes: string | null
          counted_cash: number | null
          expected_cash: number | null
          expected_cash_live: number | null
          id: string | null
          number: number | null
          opened_at: string | null
          opened_by: string | null
          opening_amount: number | null
          opening_notes: string | null
          register_id: string | null
          reopened_count: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          cash_difference?: number | null
          closed_at?: string | null
          closed_by?: string | null
          closing_notes?: string | null
          counted_cash?: number | null
          expected_cash?: number | null
          expected_cash_live?: never
          id?: string | null
          number?: number | null
          opened_at?: string | null
          opened_by?: string | null
          opening_amount?: number | null
          opening_notes?: string | null
          register_id?: string | null
          reopened_count?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          cash_difference?: number | null
          closed_at?: string | null
          closed_by?: string | null
          closing_notes?: string | null
          counted_cash?: number | null
          expected_cash?: number | null
          expected_cash_live?: never
          id?: string | null
          number?: number | null
          opened_at?: string | null
          opened_by?: string | null
          opening_amount?: number | null
          opening_notes?: string | null
          register_id?: string | null
          reopened_count?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'cash_sessions_closed_by_fkey'
            columns: ['closed_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cash_sessions_opened_by_fkey'
            columns: ['opened_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cash_sessions_register_id_fkey'
            columns: ['register_id']
            isOneToOne: false
            referencedRelation: 'cash_registers'
            referencedColumns: ['id']
          },
        ]
      }
      v_stock_audit: {
        Row: {
          difference: number | null
          ledger_quantity: number | null
          level_quantity: number | null
          variant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'stock_levels_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: true
            referencedRelation: 'product_variants'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'stock_levels_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: true
            referencedRelation: 'v_variants'
            referencedColumns: ['variant_id']
          },
          {
            foreignKeyName: 'stock_levels_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: true
            referencedRelation: 'v_variants_all'
            referencedColumns: ['variant_id']
          },
        ]
      }
      v_supplier_balances: {
        Row: {
          active: boolean | null
          balance: number | null
          name: string | null
          next_due_date: string | null
          overdue_amount: number | null
          payment_terms_days: number | null
          supplier_id: string | null
        }
        Relationships: []
      }
      v_supplier_statement: {
        Row: {
          amount: number | null
          created_at: string | null
          created_by: string | null
          entry_date: string | null
          entry_type: Database['public']['Enums']['supplier_ledger_type'] | null
          id: number | null
          notes: string | null
          reference_id: string | null
          reference_type: string | null
          running_balance: number | null
          supplier_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'supplier_ledger_supplier_id_fkey'
            columns: ['supplier_id']
            isOneToOne: false
            referencedRelation: 'suppliers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'supplier_ledger_supplier_id_fkey'
            columns: ['supplier_id']
            isOneToOne: false
            referencedRelation: 'v_supplier_balances'
            referencedColumns: ['supplier_id']
          },
        ]
      }
      v_variants: {
        Row: {
          active: boolean | null
          brand_id: string | null
          brand_name: string | null
          category_id: string | null
          category_name: string | null
          color_hex: string | null
          color_id: string | null
          color_name: string | null
          ean: string | null
          min_stock: number | null
          price: number | null
          product_active: boolean | null
          product_code: string | null
          product_id: string | null
          product_name: string | null
          size_id: string | null
          size_name: string | null
          size_order: number | null
          sku: string | null
          stock: number | null
          supplier_id: string | null
          variant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'product_variants_color_id_fkey'
            columns: ['color_id']
            isOneToOne: false
            referencedRelation: 'colors'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'product_variants_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'product_variants_size_id_fkey'
            columns: ['size_id']
            isOneToOne: false
            referencedRelation: 'sizes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_brand_id_fkey'
            columns: ['brand_id']
            isOneToOne: false
            referencedRelation: 'brands'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_supplier_id_fkey'
            columns: ['supplier_id']
            isOneToOne: false
            referencedRelation: 'suppliers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_supplier_id_fkey'
            columns: ['supplier_id']
            isOneToOne: false
            referencedRelation: 'v_supplier_balances'
            referencedColumns: ['supplier_id']
          },
        ]
      }
      v_variants_all: {
        Row: {
          active: boolean | null
          avg_cost: number | null
          brand_name: string | null
          category_name: string | null
          color_name: string | null
          ean: string | null
          last_cost: number | null
          min_stock: number | null
          price: number | null
          product_active: boolean | null
          product_code: string | null
          product_name: string | null
          size_name: string | null
          size_order: number | null
          sku: string | null
          stock: number | null
          variant_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_import_rows: { Args: { p_batch_id: string; p_rows: Json }; Returns: number }
      add_supplier_ledger_entry: {
        Args: {
          p_amount: number
          p_notes: string
          p_supplier_id: string
          p_type: Database['public']['Enums']['supplier_ledger_type']
        }
        Returns: {
          amount: number
          created_at: string
          created_by: string | null
          entry_date: string
          entry_type: Database['public']['Enums']['supplier_ledger_type']
          id: number
          notes: string | null
          reference_id: string | null
          reference_type: string | null
          supplier_id: string
        }
        SetofOptions: {
          from: '*'
          to: 'supplier_ledger'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      adjust_stock: {
        Args: {
          p_notes?: string
          p_quantity: number
          p_reason: string
          p_type: Database['public']['Enums']['stock_movement_type']
          p_variant_id: string
        }
        Returns: {
          created_at: string
          created_by: string | null
          id: number
          movement_type: Database['public']['Enums']['stock_movement_type']
          notes: string | null
          quantity: number
          reason: string | null
          reference_id: string | null
          reference_type: string | null
          stock_after: number
          stock_before: number
          unit_cost: number | null
          variant_id: string
        }
        SetofOptions: {
          from: '*'
          to: 'stock_movements'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_update_profile: {
        Args: {
          p_active: boolean
          p_full_name: string
          p_role: Database['public']['Enums']['app_role']
          p_user_id: string
        }
        Returns: {
          active: boolean
          created_at: string
          email: string | null
          full_name: string
          id: string
          role: Database['public']['Enums']['app_role']
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'profiles'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_import_batch: {
        Args: { p_batch_id: string; p_only_valid?: boolean }
        Returns: {
          applied_at: string | null
          applied_by: string | null
          created_at: string
          created_by: string
          error_rows: number
          file_name: string | null
          id: string
          mode: string
          number: number
          ok_rows: number
          options: NonNullable<Json>
          status: string
          summary: Json | null
          total_rows: number
          validated_at: string | null
          warning_rows: number
        }
        SetofOptions: {
          from: '*'
          to: 'import_batches'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_inventory_count: {
        Args: { p_count_id: string }
        Returns: {
          applied_at: string | null
          applied_by: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          category_id: string | null
          created_by: string | null
          id: string
          name: string
          notes: string | null
          number: number
          scope: string
          started_at: string
          status: string
          submitted_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'inventory_counts'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      auth_role: {
        Args: Record<PropertyKey, never>
        Returns: Database['public']['Enums']['app_role']
      }
      business_date: { Args: { ts?: string }; Returns: string }
      cancel_inventory_count: {
        Args: { p_count_id: string; p_reason: string }
        Returns: {
          applied_at: string | null
          applied_by: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          category_id: string | null
          created_by: string | null
          id: string
          name: string
          notes: string | null
          number: number
          scope: string
          started_at: string
          status: string
          submitted_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'inventory_counts'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_purchase: {
        Args: { p_purchase_id: string; p_reason: string }
        Returns: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string
          discount_amount: number
          due_date: string | null
          id: string
          invoice_number: string | null
          notes: string | null
          number: number
          paid_amount: number
          payment_status: string
          purchase_date: string
          received_at: string | null
          received_by: string | null
          status: string
          subtotal: number
          supplier_id: string
          supplier_name: string | null
          tax_amount: number
          total: number
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'purchases'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      close_cash_session: {
        Args: { p_counted_cash: number; p_notes?: string; p_reported?: Json; p_session_id: string }
        Returns: {
          cash_difference: number | null
          closed_at: string | null
          closed_by: string | null
          closing_notes: string | null
          counted_cash: number | null
          expected_cash: number | null
          id: string
          number: number
          opened_at: string
          opened_by: string
          opening_amount: number
          opening_notes: string | null
          register_id: string
          reopened_count: number
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'cash_sessions'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_import_batch: {
        Args: { p_file_name?: string; p_mode: string; p_options?: Json }
        Returns: {
          applied_at: string | null
          applied_by: string | null
          created_at: string
          created_by: string
          error_rows: number
          file_name: string | null
          id: string
          mode: string
          number: number
          ok_rows: number
          options: NonNullable<Json>
          status: string
          summary: Json | null
          total_rows: number
          validated_at: string | null
          warning_rows: number
        }
        SetofOptions: {
          from: '*'
          to: 'import_batches'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_inventory_count: {
        Args: {
          p_category_id?: string
          p_name: string
          p_notes?: string
          p_scope: string
          p_variant_ids?: string[]
        }
        Returns: {
          applied_at: string | null
          applied_by: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          category_id: string | null
          created_by: string | null
          id: string
          name: string
          notes: string | null
          number: number
          scope: string
          started_at: string
          status: string
          submitted_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'inventory_counts'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_variant: {
        Args: {
          p_color_id: string
          p_cost?: number
          p_ean?: string
          p_initial_stock?: number
          p_min_stock?: number
          p_price?: number
          p_product_id: string
          p_size_id: string
          p_sku: string
        }
        Returns: {
          active: boolean
          color_id: string
          created_at: string
          created_by: string | null
          ean: string | null
          id: string
          min_stock: number
          price: number
          product_id: string
          size_id: string
          sku: string
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'product_variants'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      dashboard_summary: { Args: Record<PropertyKey, never>; Returns: Json }
      discard_import_batch: {
        Args: { p_batch_id: string }
        Returns: {
          applied_at: string | null
          applied_by: string | null
          created_at: string
          created_by: string
          error_rows: number
          file_name: string | null
          id: string
          mode: string
          number: number
          ok_rows: number
          options: NonNullable<Json>
          status: string
          summary: Json | null
          total_rows: number
          validated_at: string | null
          warning_rows: number
        }
        SetofOptions: {
          from: '*'
          to: 'import_batches'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      find_variant_by_code: {
        Args: { p_code: string }
        Returns: {
          active: boolean | null
          brand_id: string | null
          brand_name: string | null
          category_id: string | null
          category_name: string | null
          color_hex: string | null
          color_id: string | null
          color_name: string | null
          ean: string | null
          min_stock: number | null
          price: number | null
          product_active: boolean | null
          product_code: string | null
          product_id: string | null
          product_name: string | null
          size_id: string | null
          size_name: string | null
          size_order: number | null
          sku: string | null
          stock: number | null
          supplier_id: string | null
          variant_id: string | null
        }[]
        SetofOptions: {
          from: '*'
          to: 'v_variants'
          isOneToOne: false
          isSetofReturn: true
        }
      }
      harden_privileges: { Args: Record<PropertyKey, never>; Returns: undefined }
      has_role: { Args: { roles: Database['public']['Enums']['app_role'][] }; Returns: boolean }
      internal_find_open_session: { Args: { p_session_id?: string }; Returns: string }
      internal_post_cash_movement: {
        Args: {
          p_amount: number
          p_description?: string
          p_direction: string
          p_kind: Database['public']['Enums']['cash_movement_kind']
          p_method_id: string
          p_ref_id?: string
          p_ref_type?: string
          p_session_id: string
        }
        Returns: number
      }
      internal_post_stock_movement: {
        Args: {
          p_notes?: string
          p_quantity: number
          p_reason?: string
          p_ref_id?: string
          p_ref_type?: string
          p_type: Database['public']['Enums']['stock_movement_type']
          p_unit_cost?: number
          p_variant_id: string
        }
        Returns: number
      }
      internal_post_supplier_ledger: {
        Args: {
          p_amount: number
          p_notes?: string
          p_ref_id?: string
          p_ref_type?: string
          p_supplier_id: string
          p_type: Database['public']['Enums']['supplier_ledger_type']
        }
        Returns: number
      }
      internal_refresh_purchase_payment: { Args: { p_purchase_id: string }; Returns: undefined }
      internal_register_supplier_payment: {
        Args: {
          p_allocations: Json
          p_amount: number
          p_from_register: boolean
          p_notes: string
          p_paid_at: string
          p_payment_method_id: string
          p_reference: string
          p_session_id: string
          p_supplier_id: string
        }
        Returns: {
          amount: number
          cash_session_id: string | null
          created_at: string
          created_by: string
          id: string
          notes: string | null
          number: number
          paid_at: string
          payment_method_id: string
          reference: string | null
          supplier_id: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: '*'
          to: 'supplier_payments'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      internal_report_guard: { Args: Record<PropertyKey, never>; Returns: undefined }
      internal_resolve_variant: {
        Args: { p_ean?: string; p_sku?: string; p_variant_id?: string }
        Returns: string
      }
      internal_sales_facts: {
        Args: { p_from: string; p_to: string }
        Returns: {
          cogs: number
          day: string
          kind: string
          qty: number
          revenue: number
          sale_id: string
          variant_id: string
        }[]
      }
      internal_validate_import: { Args: { p_batch_id: string }; Returns: undefined }
      is_valid_gtin: { Args: { p_code: string }; Returns: boolean }
      normalize_ean: { Args: { p_code: string }; Returns: string }
      open_cash_session: {
        Args: { p_notes?: string; p_opening_amount: number; p_register_id: string }
        Returns: {
          cash_difference: number | null
          closed_at: string | null
          closed_by: string | null
          closing_notes: string | null
          counted_cash: number | null
          expected_cash: number | null
          id: string
          number: number
          opened_at: string
          opened_by: string
          opening_amount: number
          opening_notes: string | null
          register_id: string
          reopened_count: number
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'cash_sessions'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      parse_import_bool: { Args: { p_text: string }; Returns: boolean }
      parse_import_number: { Args: { p_text: string }; Returns: number }
      receive_purchase: {
        Args: { p_payment?: Json; p_purchase_id: string }
        Returns: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string
          discount_amount: number
          due_date: string | null
          id: string
          invoice_number: string | null
          notes: string | null
          number: number
          paid_amount: number
          payment_status: string
          purchase_date: string
          received_at: string | null
          received_by: string | null
          status: string
          subtotal: number
          supplier_id: string
          supplier_name: string | null
          tax_amount: number
          total: number
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'purchases'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_inventory_count: {
        Args: {
          p_count_id: string
          p_counted_qty: number
          p_mode?: string
          p_notes?: string
          p_variant_id: string
        }
        Returns: {
          applied_movement_id: number | null
          count_id: string
          counted_at: string | null
          counted_by: string | null
          counted_qty: number | null
          difference: number | null
          expected_qty: number
          id: string
          notes: string | null
          system_qty_at_count: number | null
          variant_id: string
        }
        SetofOptions: {
          from: '*'
          to: 'inventory_count_items'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_inventory_counts_bulk: {
        Args: { p_count_id: string; p_mode?: string; p_rows: Json }
        Returns: Json
      }
      register_cash_movement: {
        Args: {
          p_amount: number
          p_description: string
          p_kind: Database['public']['Enums']['cash_movement_kind']
          p_payment_method_id: string
          p_session_id?: string
        }
        Returns: {
          affects_physical_cash: boolean
          amount: number
          cash_session_id: string
          created_at: string
          created_by: string | null
          description: string | null
          direction: string
          id: number
          kind: Database['public']['Enums']['cash_movement_kind']
          payment_method_id: string
          reference_id: string | null
          reference_type: string | null
        }
        SetofOptions: {
          from: '*'
          to: 'cash_movements'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      register_expense: {
        Args: {
          p_amount: number
          p_category_id: string
          p_description: string
          p_expense_date: string
          p_notes?: string
          p_paid_from_register: boolean
          p_payment_method_id: string
          p_receipt_ref?: string
          p_session_id?: string
          p_supplier_id?: string
        }
        Returns: {
          amount: number
          cash_session_id: string | null
          category_id: string
          created_at: string
          created_by: string
          description: string
          expense_date: string
          id: string
          notes: string | null
          number: number
          paid_from_register: boolean
          payment_method_id: string
          receipt_ref: string | null
          supplier_id: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: '*'
          to: 'expenses'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      register_return: {
        Args: {
          p_items: Json
          p_reason: string
          p_refund_method_id: string
          p_restock?: boolean
          p_sale_id: string
          p_session_id?: string
        }
        Returns: {
          cash_session_id: string
          created_at: string
          created_by: string
          id: string
          number: number
          reason: string
          refund_amount: number
          refund_method_id: string
          restock: boolean
          sale_id: string
        }
        SetofOptions: {
          from: '*'
          to: 'sale_returns'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      register_sale: {
        Args: {
          p_client_request_id: string
          p_customer_id?: string
          p_discount_amount?: number
          p_items: Json
          p_notes?: string
          p_payments: Json
          p_session_id?: string
        }
        Returns: {
          cash_session_id: string
          client_request_id: string
          created_at: string
          created_by: string
          customer_id: string | null
          discount_amount: number
          id: string
          notes: string | null
          number: number
          seller_name: string | null
          status: string
          subtotal: number
          total: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: '*'
          to: 'sales'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      register_supplier_payment: {
        Args: {
          p_allocations?: Json
          p_amount: number
          p_from_register?: boolean
          p_notes?: string
          p_paid_at?: string
          p_payment_method_id: string
          p_reference?: string
          p_session_id?: string
          p_supplier_id: string
        }
        Returns: {
          amount: number
          cash_session_id: string | null
          created_at: string
          created_by: string
          id: string
          notes: string | null
          number: number
          paid_at: string
          payment_method_id: string
          reference: string | null
          supplier_id: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: '*'
          to: 'supplier_payments'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reopen_cash_session: {
        Args: { p_reason: string; p_session_id: string }
        Returns: {
          cash_difference: number | null
          closed_at: string | null
          closed_by: string | null
          closing_notes: string | null
          counted_cash: number | null
          expected_cash: number | null
          id: string
          number: number
          opened_at: string
          opened_by: string
          opening_amount: number
          opening_notes: string | null
          register_id: string
          reopened_count: number
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'cash_sessions'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reopen_inventory_count: {
        Args: { p_count_id: string }
        Returns: {
          applied_at: string | null
          applied_by: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          category_id: string | null
          created_by: string | null
          id: string
          name: string
          notes: string | null
          number: number
          scope: string
          started_at: string
          status: string
          submitted_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'inventory_counts'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      report_expenses_by_category: {
        Args: { p_from: string; p_to: string }
        Returns: {
          category_name: string
          expenses_count: number
          total: number
        }[]
      }
      report_profit: {
        Args: { p_from: string; p_to: string }
        Returns: {
          cogs: number
          estimated_result: number
          expenses: number
          gross_margin: number
          margin_pct: number
          net_sales: number
        }[]
      }
      report_purchases_by_supplier: {
        Args: { p_from: string; p_to: string }
        Returns: {
          name: string
          paid: number
          pending: number
          purchases_count: number
          supplier_id: string
          total: number
        }[]
      }
      report_sales_by_category: {
        Args: { p_from: string; p_to: string }
        Returns: {
          category_name: string
          cogs: number
          margin: number
          net_amount: number
          units: number
        }[]
      }
      report_sales_by_day: {
        Args: { p_from: string; p_to: string }
        Returns: {
          cogs: number
          day: string
          margin: number
          net_amount: number
          returns_amount: number
          sales_amount: number
          tickets: number
          units: number
        }[]
      }
      report_sales_by_payment_method: {
        Args: { p_from: string; p_to: string }
        Returns: {
          code: string
          collected: number
          is_cash: boolean
          name: string
          net: number
          payment_method_id: string
          refunded: number
        }[]
      }
      report_sales_by_product: {
        Args: { p_from: string; p_to: string }
        Returns: {
          category_name: string
          cogs: number
          color_name: string
          margin: number
          net_amount: number
          product_code: string
          product_name: string
          size_name: string
          sku: string
          units: number
          variant_id: string
        }[]
      }
      report_stock: {
        Args: Record<PropertyKey, never>
        Returns: {
          avg_cost: number
          category_name: string
          color_name: string
          ean: string
          min_stock: number
          price: number
          product_code: string
          product_name: string
          size_name: string
          sku: string
          stock: number
          stock_status: string
          value_cost: number
          value_price: number
          variant_id: string
        }[]
      }
      report_supplier_debts: {
        Args: Record<PropertyKey, never>
        Returns: {
          balance: number
          name: string
          next_due_date: string
          not_due: number
          overdue_1_30: number
          overdue_31_60: number
          overdue_61_plus: number
          supplier_id: string
        }[]
      }
      require_role: {
        Args: { roles: Database['public']['Enums']['app_role'][] }
        Returns: undefined
      }
      save_purchase: {
        Args: {
          p_discount_amount: number
          p_due_date: string
          p_invoice_number: string
          p_items: Json
          p_notes: string
          p_purchase_date: string
          p_purchase_id: string
          p_supplier_id: string
          p_tax_amount: number
        }
        Returns: {
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string
          discount_amount: number
          due_date: string | null
          id: string
          invoice_number: string | null
          notes: string | null
          number: number
          paid_amount: number
          payment_status: string
          purchase_date: string
          received_at: string | null
          received_by: string | null
          status: string
          subtotal: number
          supplier_id: string
          supplier_name: string | null
          tax_amount: number
          total: number
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'purchases'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      search_variants: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          active: boolean | null
          brand_id: string | null
          brand_name: string | null
          category_id: string | null
          category_name: string | null
          color_hex: string | null
          color_id: string | null
          color_name: string | null
          ean: string | null
          min_stock: number | null
          price: number | null
          product_active: boolean | null
          product_code: string | null
          product_id: string | null
          product_name: string | null
          size_id: string | null
          size_name: string | null
          size_order: number | null
          sku: string | null
          stock: number | null
          supplier_id: string | null
          variant_id: string | null
        }[]
        SetofOptions: {
          from: '*'
          to: 'v_variants'
          isOneToOne: false
          isSetofReturn: true
        }
      }
      secure_table: {
        Args: {
          p_read?: Database['public']['Enums']['app_role'][]
          p_table: unknown
          p_write?: Database['public']['Enums']['app_role'][]
        }
        Returns: undefined
      }
      set_app_setting: {
        Args: { p_key: string; p_value: Json }
        Returns: {
          description: string
          key: string
          updated_at: string
          updated_by: string | null
          value: NonNullable<Json>
        }
        SetofOptions: {
          from: '*'
          to: 'app_settings'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_variant_cost: {
        Args: { p_cost: number; p_variant_id: string }
        Returns: {
          avg_cost: number
          last_cost: number
          updated_at: string
          variant_id: string
        }
        SetofOptions: {
          from: '*'
          to: 'variant_costs'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_inventory_review: {
        Args: { p_count_id: string }
        Returns: {
          applied_at: string | null
          applied_by: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          category_id: string | null
          created_by: string | null
          id: string
          name: string
          notes: string | null
          number: number
          scope: string
          started_at: string
          status: string
          submitted_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'inventory_counts'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_own_profile: {
        Args: { p_full_name: string }
        Returns: {
          active: boolean
          created_at: string
          email: string | null
          full_name: string
          id: string
          role: Database['public']['Enums']['app_role']
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'profiles'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      validate_import_batch: {
        Args: { p_batch_id: string }
        Returns: {
          applied_at: string | null
          applied_by: string | null
          created_at: string
          created_by: string
          error_rows: number
          file_name: string | null
          id: string
          mode: string
          number: number
          ok_rows: number
          options: NonNullable<Json>
          status: string
          summary: Json | null
          total_rows: number
          validated_at: string | null
          warning_rows: number
        }
        SetofOptions: {
          from: '*'
          to: 'import_batches'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      void_expense: {
        Args: { p_expense_id: string; p_reason: string }
        Returns: {
          amount: number
          cash_session_id: string | null
          category_id: string
          created_at: string
          created_by: string
          description: string
          expense_date: string
          id: string
          notes: string | null
          number: number
          paid_from_register: boolean
          payment_method_id: string
          receipt_ref: string | null
          supplier_id: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: '*'
          to: 'expenses'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      void_sale: {
        Args: { p_reason: string; p_sale_id: string }
        Returns: {
          cash_session_id: string
          client_request_id: string
          created_at: string
          created_by: string
          customer_id: string | null
          discount_amount: number
          id: string
          notes: string | null
          number: number
          seller_name: string | null
          status: string
          subtotal: number
          total: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: '*'
          to: 'sales'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      void_supplier_payment: {
        Args: { p_payment_id: string; p_reason: string }
        Returns: {
          amount: number
          cash_session_id: string | null
          created_at: string
          created_by: string
          id: string
          notes: string | null
          number: number
          paid_at: string
          payment_method_id: string
          reference: string | null
          supplier_id: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: '*'
          to: 'supplier_payments'
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: 'owner' | 'manager' | 'cashier' | 'stock_clerk' | 'viewer'
      cash_movement_kind:
        | 'opening_float'
        | 'sale'
        | 'sale_void'
        | 'sale_refund'
        | 'income'
        | 'expense'
        | 'expense_void'
        | 'withdrawal'
        | 'supplier_payment'
        | 'supplier_payment_void'
        | 'adjustment'
      stock_movement_type:
        | 'purchase_in'
        | 'sale_out'
        | 'sale_return_in'
        | 'sale_void_in'
        | 'purchase_return_out'
        | 'adjustment_in'
        | 'adjustment_out'
        | 'inventory_adjustment'
        | 'import_adjustment'
        | 'initial_load'
        | 'damage_out'
        | 'theft_out'
        | 'internal_use_out'
      supplier_ledger_type:
        'purchase' | 'payment' | 'payment_void' | 'credit_note' | 'adjustment' | 'opening_balance'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ['owner', 'manager', 'cashier', 'stock_clerk', 'viewer'],
      cash_movement_kind: [
        'opening_float',
        'sale',
        'sale_void',
        'sale_refund',
        'income',
        'expense',
        'expense_void',
        'withdrawal',
        'supplier_payment',
        'supplier_payment_void',
        'adjustment',
      ],
      stock_movement_type: [
        'purchase_in',
        'sale_out',
        'sale_return_in',
        'sale_void_in',
        'purchase_return_out',
        'adjustment_in',
        'adjustment_out',
        'inventory_adjustment',
        'import_adjustment',
        'initial_load',
        'damage_out',
        'theft_out',
        'internal_use_out',
      ],
      supplier_ledger_type: [
        'purchase',
        'payment',
        'payment_void',
        'credit_note',
        'adjustment',
        'opening_balance',
      ],
    },
  },
} as const
