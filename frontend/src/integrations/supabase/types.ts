export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      road_reports: {
        Row: import("../../lib/road-reports").RoadReport;
        Insert: import("../../lib/road-reports").RoadReportInput & {
          user_id: string;
        };
        Update: Partial<import("../../lib/road-reports").RoadReport>;
        Relationships: [];
      };
      location_links: {
        Row: import("../../lib/companion-tracking").TrackingLink;
        Insert: Partial<import("../../lib/companion-tracking").TrackingLink> & {
          owner_id: string;
          trip_id: string;
          traveller_id: string;
          phone_number: string | null;
        };
        Update: Partial<import("../../lib/companion-tracking").TrackingLink>;
        Relationships: [];
      };
      trip_meeting_points: {
        Row: import("../../lib/companion-tracking").MeetingPoint;
        Insert: Omit<
          import("../../lib/companion-tracking").MeetingPoint,
          "id" | "created_at"
        >;
        Update: Partial<import("../../lib/companion-tracking").MeetingPoint>;
        Relationships: [];
      };
      sos_incidents: {
        Row: import("../../lib/companion-tracking").Incident;
        Insert: Omit<
          import("../../lib/companion-tracking").Incident,
          "id" | "created_at" | "resolved_at"
        >;
        Update: Partial<import("../../lib/companion-tracking").Incident>;
        Relationships: [];
      };

      crowd_reports: {
        Row: {
          id: string;
          user_id: string;
          place_key: string;
          level: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          place_key: string;
          level: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          place_key?: string;
          level?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      place_cache: {
        Row: {
          key: string;
          payload: Json;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          key: string;
          payload: Json;
          expires_at: string;
          created_at?: string;
        };
        Update: {
          key?: string;
          payload?: Json;
          expires_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      itineraries: {
        Row: {
          created_at: string;
          hours: number;
          id: string;
          interests: string[];
          pace: string;
          place: string;
          plan: Json;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          hours?: number;
          id?: string;
          interests?: string[];
          pace?: string;
          place: string;
          plan: Json;
          user_id: string;
        };
        Update: {
          created_at?: string;
          hours?: number;
          id?: string;
          interests?: string[];
          pace?: string;
          place?: string;
          plan?: Json;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          id: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          id?: string;
        };
        Relationships: [];
      };
      safety_tags: {
        Row: {
          alt_phone: string | null;
          category: string;
          created_at: string;
          description: string | null;
          guardian_name: string;
          guardian_phone: string;
          id: string;
          medical_notes: string | null;
          person_age: number | null;
          person_name: string;
          staying_at: string | null;
          token: string;
          user_id: string;
        };
        Insert: {
          alt_phone?: string | null;
          category?: string;
          created_at?: string;
          description?: string | null;
          guardian_name: string;
          guardian_phone: string;
          id?: string;
          medical_notes?: string | null;
          person_age?: number | null;
          person_name: string;
          staying_at?: string | null;
          token?: string;
          user_id: string;
        };
        Update: {
          alt_phone?: string | null;
          category?: string;
          created_at?: string;
          description?: string | null;
          guardian_name?: string;
          guardian_phone?: string;
          id?: string;
          medical_notes?: string | null;
          person_age?: number | null;
          person_name?: string;
          staying_at?: string | null;
          token?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      safety_tag_scans: {
        Row: {
          id: string;
          safety_tag_id: string;
          finder_note: string | null;
          finder_contact: string | null;
          lat: number | null;
          lng: number | null;
          delivery_status: Json;
          is_resolved: boolean;
          resolved_at: string | null;
          scanned_at: string;
        };
        Insert: {
          id?: string;
          safety_tag_id: string;
          finder_note?: string | null;
          finder_contact?: string | null;
          lat?: number | null;
          lng?: number | null;
          delivery_status?: Json;
          is_resolved?: boolean;
          resolved_at?: string | null;
          scanned_at?: string;
        };
        Update: {
          id?: string;
          safety_tag_id?: string;
          finder_note?: string | null;
          finder_contact?: string | null;
          lat?: number | null;
          lng?: number | null;
          delivery_status?: Json;
          is_resolved?: boolean;
          resolved_at?: string | null;
          scanned_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "safety_tag_scans_safety_tag_id_fkey";
            columns: ["safety_tag_id"];
            isOneToOne: false;
            referencedRelation: "safety_tags";
            referencedColumns: ["id"];
          },
        ];
      };
      saved_places: {
        Row: {
          category: string;
          created_at: string;
          id: string;
          image_url: string | null;
          lat: number | null;
          lng: number | null;
          notes: string | null;
          place_name: string;
          planned_date: string | null;
          priority: number;
          status: "want" | "planned" | "visited";
          tags: string[];
          updated_at: string;
          user_id: string;
          visited_at: string | null;
        };
        Insert: {
          category?: string;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          lat?: number | null;
          lng?: number | null;
          notes?: string | null;
          place_name: string;
          planned_date?: string | null;
          priority?: number;
          status?: "want" | "planned" | "visited";
          tags?: string[];
          updated_at?: string;
          user_id: string;
          visited_at?: string | null;
        };
        Update: {
          category?: string;
          created_at?: string;
          id?: string;
          image_url?: string | null;
          lat?: number | null;
          lng?: number | null;
          notes?: string | null;
          place_name?: string;
          planned_date?: string | null;
          priority?: number;
          status?: "want" | "planned" | "visited";
          tags?: string[];
          updated_at?: string;
          user_id?: string;
          visited_at?: string | null;
        };
        Relationships: [];
      };
      saved_routes: {
        Row: {
          created_at: string;
          destination: Json;
          id: string;
          mode: string;
          name: string;
          origin: Json;
          user_id: string;
          waypoints: Json;
        };
        Insert: {
          created_at?: string;
          destination: Json;
          id?: string;
          mode?: string;
          name: string;
          origin: Json;
          user_id: string;
          waypoints?: Json;
        };
        Update: {
          created_at?: string;
          destination?: Json;
          id?: string;
          mode?: string;
          name?: string;
          origin?: Json;
          user_id?: string;
          waypoints?: Json;
        };
        Relationships: [];
      };
      travellers: {
        Row: {
          age: number | null;
          category: string;
          created_at: string;
          id: string;
          name: string;
          trip_id: string;
          user_id: string;
          phone_number: string | null;
        };
        Insert: {
          age?: number | null;
          category?: string;
          created_at?: string;
          id?: string;
          name: string;
          trip_id: string;
          user_id: string;
          phone_number?: string | null;
        };
        Update: {
          age?: number | null;
          category?: string;
          created_at?: string;
          id?: string;
          name?: string;
          trip_id?: string;
          user_id?: string;
          phone_number?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "travellers_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      trips: {
        Row: {
          created_at: string;
          days: number;
          destination: string;
          id: string;
          phone_number: string | null;
          start_date: string | null;
          travel_style: string;
          traveller_name: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          days?: number;
          destination: string;
          id?: string;
          phone_number?: string | null;
          start_date?: string | null;
          travel_style?: string;
          traveller_name: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          days?: number;
          destination?: string;
          id?: string;
          phone_number?: string | null;
          start_date?: string | null;
          travel_style?: string;
          traveller_name?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      save_trip_with_travellers: {
        Args: { _trip: Json; _travellers: Json; _trip_id?: string | null };
        Returns: string;
      };
      get_safety_tag: {
        Args: { _token: string };
        Returns: {
          alt_phone: string;
          category: string;
          description: string;
          guardian_name: string;
          guardian_phone: string;
          medical_notes: string;
          person_age: number;
          person_name: string;
          staying_at: string;
        }[];
      };
      check_safety_tag: {
        Args: { _token: string };
        Returns: {
          tag_id: string;
          category: string;
          is_active: boolean;
        }[];
      };
      notify_safety_tag: {
        Args: {
          _token: string;
          _finder_note?: string | null;
          _finder_contact?: string | null;
        };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
