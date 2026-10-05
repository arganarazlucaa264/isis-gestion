// Tipos de la base. Escritos a mano en la Etapa 1 con el mismo formato que genera el CLI.
// Se REEMPLAZAN al correr `npm run db:types` (requiere Docker + Supabase local). No editar a mano
// después de eso.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string
          role: Database['public']['Enums']['app_role']
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      audit_log: {
        Row: {
          id: number
          table_name: string
          record_id: string | null
          action: string
          old_data: Json | null
          new_data: Json | null
          user_id: string | null
          at: string
        }
        Insert: never
        Update: never
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          value: Json
          description: string
          updated_at: string
          updated_by: string | null
        }
        Insert: never
        Update: never
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      auth_role: {
        Args: Record<string, never>
        Returns: Database['public']['Enums']['app_role'] | null
      }
      has_role: {
        Args: { roles: Database['public']['Enums']['app_role'][] }
        Returns: boolean
      }
      admin_update_profile: {
        Args: {
          p_user_id: string
          p_full_name: string
          p_role: Database['public']['Enums']['app_role']
          p_active: boolean
        }
        Returns: Database['public']['Tables']['profiles']['Row']
      }
      update_own_profile: {
        Args: { p_full_name: string }
        Returns: Database['public']['Tables']['profiles']['Row']
      }
      set_app_setting: {
        Args: { p_key: string; p_value: Json }
        Returns: Database['public']['Tables']['app_settings']['Row']
      }
      business_date: {
        Args: { ts?: string }
        Returns: string
      }
    }
    Enums: {
      app_role: 'owner' | 'manager' | 'cashier' | 'stock_clerk' | 'viewer'
    }
    CompositeTypes: Record<string, never>
  }
}
