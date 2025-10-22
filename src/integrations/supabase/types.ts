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
  public: {
    Tables: {
      company_settings: {
        Row: {
          brand_color_hex: string | null
          company_name: string
          created_at: string | null
          default_film_id: string | null
          id: string
          logo_url: string | null
          pdf_footer_terms: string | null
          roll_config: Json | null
          tagline: string | null
          theme_style: string | null
          updated_at: string | null
        }
        Insert: {
          brand_color_hex?: string | null
          company_name?: string
          created_at?: string | null
          default_film_id?: string | null
          id?: string
          logo_url?: string | null
          pdf_footer_terms?: string | null
          roll_config?: Json | null
          tagline?: string | null
          theme_style?: string | null
          updated_at?: string | null
        }
        Update: {
          brand_color_hex?: string | null
          company_name?: string
          created_at?: string | null
          default_film_id?: string | null
          id?: string
          logo_url?: string | null
          pdf_footer_terms?: string | null
          roll_config?: Json | null
          tagline?: string | null
          theme_style?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_default_film_id_fkey"
            columns: ["default_film_id"]
            isOneToOne: false
            referencedRelation: "film_usage_ranking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_settings_default_film_id_fkey"
            columns: ["default_film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
      films: {
        Row: {
          active: boolean | null
          brand: string
          cost_per_sqft: number
          created_at: string | null
          created_by: string | null
          id: string
          is_featured: boolean
          name: string
          notes: string | null
          security_film: boolean
          sell_per_sqft: number
          series: string
          sku: string | null
          updated_at: string | null
          vlt: number | null
        }
        Insert: {
          active?: boolean | null
          brand: string
          cost_per_sqft: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_featured?: boolean
          name: string
          notes?: string | null
          security_film?: boolean
          sell_per_sqft: number
          series: string
          sku?: string | null
          updated_at?: string | null
          vlt?: number | null
        }
        Update: {
          active?: boolean | null
          brand?: string
          cost_per_sqft?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_featured?: boolean
          name?: string
          notes?: string | null
          security_film?: boolean
          sell_per_sqft?: number
          series?: string
          sku?: string | null
          updated_at?: string | null
          vlt?: number | null
        }
        Relationships: []
      }
      integration_jobber_tokens: {
        Row: {
          access_token: string
          account_id: string
          created_at: string | null
          expires_at: string
          id: string
          jobber_account_id: string | null
          refresh_token: string
          updated_at: string | null
        }
        Insert: {
          access_token: string
          account_id: string
          created_at?: string | null
          expires_at: string
          id?: string
          jobber_account_id?: string | null
          refresh_token: string
          updated_at?: string | null
        }
        Update: {
          access_token?: string
          account_id?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          jobber_account_id?: string | null
          refresh_token?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_jobber_tokens_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      job_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string | null
          id: string
          job_date: string
          quote_id: string
          updated_at: string | null
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string | null
          id?: string
          job_date: string
          quote_id: string
          updated_at?: string | null
        }
        Update: {
          assigned_by?: string | null
          created_at?: string | null
          id?: string
          job_date?: string
          quote_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_assignments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: true
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          active: boolean
          cost_per_linear_ft: number
          created_at: string | null
          id: string
          key: string
          name: string
          sell_per_linear_ft: number
          unit: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          cost_per_linear_ft: number
          created_at?: string | null
          id?: string
          key: string
          name: string
          sell_per_linear_ft: number
          unit?: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          cost_per_linear_ft?: number
          created_at?: string | null
          id?: string
          key?: string
          name?: string
          sell_per_linear_ft?: number
          unit?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      quotes: {
        Row: {
          created_at: string | null
          created_by: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          customer_type: string | null
          deposit_percent: number | null
          discount_flat: number | null
          discount_percent: number | null
          global_film_id: string | null
          id: string
          is_price_overridden: boolean | null
          manual_override_total: number | null
          notes_customer: string | null
          notes_internal: string | null
          quote_no: number
          quote_number: string
          site_address: string | null
          status: string | null
          tax_percent: number | null
          travel_fee: number | null
          travel_taxable: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          customer_type?: string | null
          deposit_percent?: number | null
          discount_flat?: number | null
          discount_percent?: number | null
          global_film_id?: string | null
          id?: string
          is_price_overridden?: boolean | null
          manual_override_total?: number | null
          notes_customer?: string | null
          notes_internal?: string | null
          quote_no?: number
          quote_number: string
          site_address?: string | null
          status?: string | null
          tax_percent?: number | null
          travel_fee?: number | null
          travel_taxable?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          customer_type?: string | null
          deposit_percent?: number | null
          discount_flat?: number | null
          discount_percent?: number | null
          global_film_id?: string | null
          id?: string
          is_price_overridden?: boolean | null
          manual_override_total?: number | null
          notes_customer?: string | null
          notes_internal?: string | null
          quote_no?: number
          quote_number?: string
          site_address?: string | null
          status?: string | null
          tax_percent?: number | null
          travel_fee?: number | null
          travel_taxable?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_global_film_id_fkey"
            columns: ["global_film_id"]
            isOneToOne: false
            referencedRelation: "film_usage_ranking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_global_film_id_fkey"
            columns: ["global_film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string | null
          id: string
          is_common: boolean | null
          is_featured: boolean
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_common?: boolean | null
          is_featured?: boolean
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_common?: boolean | null
          is_featured?: boolean
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sections: {
        Row: {
          created_at: string | null
          custom_room_name: string | null
          id: string
          name: string
          position: number | null
          quote_id: string
          room_id: string | null
          section_film_id: string | null
          section_notes: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          custom_room_name?: string | null
          id?: string
          name: string
          position?: number | null
          quote_id: string
          room_id?: string | null
          section_film_id?: string | null
          section_notes?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          custom_room_name?: string | null
          id?: string
          name?: string
          position?: number | null
          quote_id?: string
          room_id?: string | null
          section_film_id?: string | null
          section_notes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sections_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sections_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "room_usage_ranking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sections_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sections_section_film_id_fkey"
            columns: ["section_film_id"]
            isOneToOne: false
            referencedRelation: "film_usage_ranking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sections_section_film_id_fkey"
            columns: ["section_film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          pin: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          pin: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          pin?: string
          updated_at?: string
        }
        Relationships: []
      }
      windows: {
        Row: {
          created_at: string | null
          film_removal_fee_per_sqft: number | null
          height_in: number
          id: string
          label: string
          notes: string | null
          override_sell_per_sqft: number | null
          position: number | null
          quantity: number | null
          quote_height_in: number | null
          quote_width_in: number | null
          section_id: string
          updated_at: string | null
          waste_factor_percent: number | null
          width_in: number
          window_film_id: string | null
        }
        Insert: {
          created_at?: string | null
          film_removal_fee_per_sqft?: number | null
          height_in: number
          id?: string
          label: string
          notes?: string | null
          override_sell_per_sqft?: number | null
          position?: number | null
          quantity?: number | null
          quote_height_in?: number | null
          quote_width_in?: number | null
          section_id: string
          updated_at?: string | null
          waste_factor_percent?: number | null
          width_in: number
          window_film_id?: string | null
        }
        Update: {
          created_at?: string | null
          film_removal_fee_per_sqft?: number | null
          height_in?: number
          id?: string
          label?: string
          notes?: string | null
          override_sell_per_sqft?: number | null
          position?: number | null
          quantity?: number | null
          quote_height_in?: number | null
          quote_width_in?: number | null
          section_id?: string
          updated_at?: string | null
          waste_factor_percent?: number | null
          width_in?: number
          window_film_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "windows_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "windows_window_film_id_fkey"
            columns: ["window_film_id"]
            isOneToOne: false
            referencedRelation: "film_usage_ranking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "windows_window_film_id_fkey"
            columns: ["window_film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      film_usage_ranking: {
        Row: {
          active: boolean | null
          brand: string | null
          cost_per_sqft: number | null
          global_usage: number | null
          id: string | null
          name: string | null
          notes: string | null
          section_usage: number | null
          security_film: boolean | null
          sell_per_sqft: number | null
          series: string | null
          sku: string | null
          usage_score: number | null
          vlt: number | null
          window_usage: number | null
        }
        Relationships: []
      }
      room_usage_ranking: {
        Row: {
          id: string | null
          is_common: boolean | null
          name: string | null
          usage_score: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      quote_exists: { Args: { _quote_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "tinter"
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
  public: {
    Enums: {
      app_role: ["admin", "tinter"],
    },
  },
} as const
