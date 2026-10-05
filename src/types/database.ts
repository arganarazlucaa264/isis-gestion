// Placeholder de la Etapa 0. Este archivo se REGENERA con `npm run db:types`
// (supabase gen types typescript --local) cuando existan tablas (Etapa 1 en adelante).
// No editar a mano.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
