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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      buildings: {
        Row: {
          color: string
          cols: number
          floors: number
          id: string
          layout: string
          name: string
          rotation: number
          rows: number
          site_id: string
          x: number
          z: number
        }
        Insert: {
          color?: string
          cols?: number
          floors?: number
          id?: string
          layout?: string
          name: string
          rotation?: number
          rows?: number
          site_id: string
          x?: number
          z?: number
        }
        Update: {
          color?: string
          cols?: number
          floors?: number
          id?: string
          layout?: string
          name?: string
          rotation?: number
          rows?: number
          site_id?: string
          x?: number
          z?: number
        }
        Relationships: [
          {
            foreignKeyName: "buildings_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          energy_kwh: number | null
          id: string
          install_year: number | null
          model: string | null
          name: string
          notes: string | null
          object_name: string
          status: string
          type: string | null
          unit_id: string
        }
        Insert: {
          energy_kwh?: number | null
          id?: string
          install_year?: number | null
          model?: string | null
          name: string
          notes?: string | null
          object_name: string
          status?: string
          type?: string | null
          unit_id: string
        }
        Update: {
          energy_kwh?: number | null
          id?: string
          install_year?: number | null
          model?: string | null
          name?: string
          notes?: string | null
          object_name?: string
          status?: string
          type?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          city: string | null
          created_at: string
          created_by: string | null
          created_by_name: string | null
          elevation: number
          id: string
          kind: string
          lat: number
          lon: number
          model_path: string | null
          name: string
          rotation: number
          scale: number
          tiles_height: number
        }
        Insert: {
          city?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          elevation?: number
          id?: string
          kind?: string
          lat?: number
          lon?: number
          model_path?: string | null
          name: string
          rotation?: number
          scale?: number
          tiles_height?: number
        }
        Update: {
          city?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          elevation?: number
          id?: string
          kind?: string
          lat?: number
          lon?: number
          model_path?: string | null
          name?: string
          rotation?: number
          scale?: number
          tiles_height?: number
        }
        Relationships: []
      }
      units: {
        Row: {
          apt_number: string
          area_sqft: number | null
          baths: number | null
          beds: number | null
          building_id: string | null
          col: number
          created_at: string
          floor: number
          id: string
          layout: string | null
          notes: string | null
          object_name: string
          rent: number | null
          row: number
          site_id: string
          status: string
        }
        Insert: {
          apt_number: string
          area_sqft?: number | null
          baths?: number | null
          beds?: number | null
          building_id?: string | null
          col?: number
          created_at?: string
          floor?: number
          id?: string
          layout?: string | null
          notes?: string | null
          object_name: string
          rent?: number | null
          row?: number
          site_id: string
          status?: string
        }
        Update: {
          apt_number?: string
          area_sqft?: number | null
          baths?: number | null
          beds?: number | null
          building_id?: string | null
          col?: number
          created_at?: string
          floor?: number
          id?: string
          layout?: string | null
          notes?: string | null
          object_name?: string
          rent?: number | null
          row?: number
          site_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_building_id_fkey"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_team_member: { Args: never; Returns: boolean }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
